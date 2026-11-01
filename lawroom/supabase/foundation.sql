-- Lawroom foundation. Applied via Dashboard SQL editor; no migration history entry.
-- Existing website tables are intentionally untouched.
begin;
create schema lawroom_private;
revoke all on schema lawroom_private from public, anon, authenticated;
create table public.lr_accounts (
 user_id uuid primary key references auth.users(id), display_name text not null,
 role text not null check(role in ('admin','lawyer','client')),
 status text not null default 'pending' check(status in ('pending','active','suspended')),
 created_at timestamptz not null default now()
);
create table public.lr_organizations (
 id uuid primary key default gen_random_uuid(), name text not null,
 kind text not null check(kind in ('individual','firm')),
 status text not null default 'pending' check(status in ('pending','active','suspended')),
 created_at timestamptz not null default now()
);
create table public.lr_memberships (
 organization_id uuid references public.lr_organizations(id), user_id uuid references public.lr_accounts(user_id),
 role text not null check(role in ('owner','lawyer')), active boolean not null default false,
 primary key(organization_id,user_id)
);
create table public.lr_applications (
 id uuid primary key default gen_random_uuid(), applicant_id uuid not null references auth.users(id),
 kind text not null check(kind in ('lawyer','firm','client')), display_name text not null,
 bar_number text, organization_name text, referred_lawyer_id uuid references public.lr_accounts(user_id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), unique(applicant_id,kind)
);
create table public.lr_relationships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 lawyer_id uuid not null, client_id uuid not null references public.lr_accounts(user_id),
 status text not null default 'lawyer_review' check(status in ('lawyer_review','accepted','rejected','revoked')),
 foreign key(organization_id,lawyer_id) references public.lr_memberships(organization_id,user_id),
 unique(organization_id,lawyer_id,client_id), unique(id,organization_id)
);
create table public.lr_matters (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.lr_organizations(id),
 owner_id uuid not null, title text not null check(length(trim(title))>0),
 matter_type text not null, reference text, court text, stage text not null default 'Hazırlık',
 next_action text, target_date date, client_summary text not null default '',
 archived_at timestamptz, created_at timestamptz not null default now(),
 foreign key(organization_id,owner_id) references public.lr_memberships(organization_id,user_id),
 unique(id,organization_id)
);
create table public.lr_matter_clients (
 matter_id uuid not null, organization_id uuid not null, relationship_id uuid not null,
 shared boolean not null default false,
 foreign key(matter_id,organization_id) references public.lr_matters(id,organization_id),
 foreign key(relationship_id,organization_id) references public.lr_relationships(id,organization_id),
 primary key(matter_id,relationship_id)
);
create table public.lr_events (
 id uuid primary key default gen_random_uuid(), matter_id uuid not null references public.lr_matters(id),
 title text not null, occurred_on date not null, shared boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.lr_tasks (
 id uuid primary key default gen_random_uuid(), matter_id uuid not null references public.lr_matters(id),
 title text not null, due_on date, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.lr_internal_notes (
 id uuid primary key default gen_random_uuid(), matter_id uuid not null references public.lr_matters(id),
 body text not null, created_at timestamptz not null default now()
);
create table public.lr_messages (
 id uuid primary key default gen_random_uuid(), matter_id uuid not null references public.lr_matters(id),
 sender_id uuid not null references public.lr_accounts(user_id),
 body text not null check(length(trim(body)) between 1 and 8000), created_at timestamptz not null default now()
);
create table public.lr_deadlines (
 id uuid primary key default gen_random_uuid(), matter_id uuid not null references public.lr_matters(id),
 title text not null, trigger_date date, service_method text, legal_basis text, source_reference text,
 proposed_due_at timestamptz, verified_due_at timestamptz, verified_by uuid references public.lr_accounts(user_id),
 verified_at timestamptz, rule_version text,
 check((verified_at is null and verified_by is null and verified_due_at is null) or
 (verified_at is not null and verified_by is not null and verified_due_at is not null and legal_basis is not null and source_reference is not null))
);
create table public.lr_documents (
 id uuid primary key default gen_random_uuid(), matter_id uuid not null references public.lr_matters(id),
 name text not null, object_path text not null unique, media_type text, shared boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.lr_audit_events (
 id bigint generated always as identity primary key, actor_id uuid, action text not null,
 entity_type text not null, entity_id uuid, created_at timestamptz not null default now()
);
create table public.lr_notification_outbox (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.lr_accounts(user_id),
 event_key text not null unique, kind text not null, status text not null default 'pending'
 check(status in ('pending','sending','sent','failed','cancelled')), attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create function lawroom_private.has_role(expected text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.lr_accounts where user_id=auth.uid() and role=expected and status='active');
$$;
create function lawroom_private.is_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select lawroom_private.has_role('lawyer') and exists(select 1 from public.lr_memberships m join public.lr_organizations o on o.id=m.organization_id where m.organization_id=org and m.user_id=auth.uid() and m.active and o.status='active');
$$;
create function lawroom_private.can_write(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.lr_matters m where m.id=mid and m.owner_id=auth.uid() and lawroom_private.is_member(m.organization_id));
$$;
create function lawroom_private.can_read(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select lawroom_private.can_write(mid) or (lawroom_private.has_role('client') and exists(
 select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id
 join public.lr_matters m on m.id=mc.matter_id join public.lr_organizations o on o.id=m.organization_id
 join public.lr_memberships mem on mem.organization_id=m.organization_id and mem.user_id=m.owner_id
 join public.lr_accounts a on a.user_id=m.owner_id
 where mc.matter_id=mid and mc.shared and r.client_id=auth.uid() and r.status='accepted'
 and r.lawyer_id=m.owner_id and mem.active and a.status='active' and a.role='lawyer' and o.status='active'));
$$;
revoke all on all functions in schema lawroom_private from public, anon, authenticated;
grant usage on schema lawroom_private to authenticated;
grant execute on all functions in schema lawroom_private to authenticated;
do $$ declare t text; begin
 foreach t in array array['lr_accounts','lr_organizations','lr_memberships','lr_applications','lr_relationships','lr_matters','lr_matter_clients','lr_events','lr_tasks','lr_internal_notes','lr_messages','lr_deadlines','lr_documents','lr_audit_events','lr_notification_outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop; end $$;
grant select on public.lr_accounts,public.lr_organizations,public.lr_memberships,public.lr_applications,public.lr_relationships,public.lr_matters,public.lr_matter_clients,public.lr_events,public.lr_tasks,public.lr_internal_notes,public.lr_messages,public.lr_deadlines,public.lr_documents to authenticated;
grant insert on public.lr_applications,public.lr_matters,public.lr_events,public.lr_tasks,public.lr_internal_notes,public.lr_messages to authenticated;
grant update(title,matter_type,reference,court,stage,next_action,target_date,client_summary,archived_at) on public.lr_matters to authenticated;
grant update(title,occurred_on,shared) on public.lr_events to authenticated;
grant update(title,due_on,completed_at) on public.lr_tasks to authenticated;
grant update(body) on public.lr_internal_notes to authenticated;
create policy account_self on public.lr_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy organization_member on public.lr_organizations for select to authenticated using(lawroom_private.is_member(id));
create policy membership_self on public.lr_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy application_read on public.lr_applications for select to authenticated using(applicant_id=(select auth.uid()) or lawroom_private.has_role('admin'));
create policy application_submit on public.lr_applications for insert to authenticated with check(applicant_id=(select auth.uid()) and status='pending');
create policy relationship_read on public.lr_relationships for select to authenticated using((client_id=(select auth.uid()) and lawroom_private.has_role('client')) or (lawyer_id=(select auth.uid()) and lawroom_private.is_member(organization_id)));
create policy matter_read on public.lr_matters for select to authenticated using(lawroom_private.can_read(id));
create policy matter_create on public.lr_matters for insert to authenticated with check(owner_id=(select auth.uid()) and lawroom_private.is_member(organization_id));
create policy matter_update on public.lr_matters for update to authenticated using(lawroom_private.can_write(id)) with check(owner_id=(select auth.uid()) and lawroom_private.is_member(organization_id));
create policy matter_client_read on public.lr_matter_clients for select to authenticated using(lawroom_private.can_write(matter_id));
create policy event_read on public.lr_events for select to authenticated using(lawroom_private.can_write(matter_id) or (shared and lawroom_private.can_read(matter_id)));
create policy event_create on public.lr_events for insert to authenticated with check(lawroom_private.can_write(matter_id));
create policy event_update on public.lr_events for update to authenticated using(lawroom_private.can_write(matter_id)) with check(lawroom_private.can_write(matter_id));
do $$ declare t text; begin foreach t in array array['lr_tasks','lr_internal_notes'] loop
 execute format('create policy lawyer_read on public.%I for select to authenticated using(lawroom_private.can_write(matter_id))',t);
 execute format('create policy lawyer_insert on public.%I for insert to authenticated with check(lawroom_private.can_write(matter_id))',t);
 execute format('create policy lawyer_update on public.%I for update to authenticated using(lawroom_private.can_write(matter_id)) with check(lawroom_private.can_write(matter_id))',t);
 end loop; end $$;
create policy message_read on public.lr_messages for select to authenticated using(lawroom_private.can_read(matter_id));
create policy message_send on public.lr_messages for insert to authenticated with check(sender_id=(select auth.uid()) and lawroom_private.can_read(matter_id));
create policy deadline_read on public.lr_deadlines for select to authenticated using(lawroom_private.can_write(matter_id));
create policy document_read on public.lr_documents for select to authenticated using(lawroom_private.can_write(matter_id) or (shared and lawroom_private.can_read(matter_id)));
create index lr_memberships_user on public.lr_memberships(user_id,organization_id);
create index lr_matters_owner_date on public.lr_matters(owner_id,target_date);
create index lr_relationships_client on public.lr_relationships(client_id,status);
create index lr_events_matter on public.lr_events(matter_id,occurred_on);
create index lr_tasks_matter on public.lr_tasks(matter_id,due_on);
create index lr_notes_matter on public.lr_internal_notes(matter_id);
create index lr_messages_matter on public.lr_messages(matter_id,created_at);
create index lr_deadlines_matter on public.lr_deadlines(matter_id);
create index lr_documents_matter on public.lr_documents(matter_id);
commit;
