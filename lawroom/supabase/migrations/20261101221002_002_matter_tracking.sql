-- Candidate only: apply after the recorded foundation baseline and the three
-- identity/documents/delivery migrations. Never replay foundation remotely.
begin;
do $$ begin
 if to_regclass('public.lr_referral_codes') is null or to_regclass('public.lr_delivery_attempts') is null
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='lr_documents' and column_name='upload_status') then
  raise exception 'tracking_002_requires_identity_documents_delivery_migrations';
 end if;
 if (select udt_name from information_schema.columns where table_schema='public' and table_name='lr_documents' and column_name='uploaded_by') is distinct from 'uuid' then
  raise exception 'uploaded_by_schema_mismatch';
 end if;
end $$;

create table public.lr_stage_templates(
 key text not null,version text not null,snapshot jsonb not null,
 primary key(key,version),check(jsonb_typeof(snapshot)='object' and snapshot->>'key'=key and snapshot->>'version'=version
 and snapshot->>'unverified'='true' and snapshot->>'verifiedByLawyer'='false')
);
create table public.lr_event_types(key text primary key,definition jsonb not null check(jsonb_typeof(definition)='object'));
alter table public.lr_matters
 add column subtype text,add column status text not null default 'active' check(status in('active','on_hold','closed','archived')),
 add column priority text not null default 'normal' check(priority in('normal','high','critical')),
 add column stage_key text,add column template_key text,add column template_version text,add column template_snapshot jsonb,
 add column internal_ref text,add column closed_reason text,add column closed_on date,
 add column last_activity_at timestamptz not null default now(),add column updated_at timestamptz not null default now(),
 add column revision bigint not null default 0,
 add foreign key(template_key,template_version) references public.lr_stage_templates(key,version);
-- Preserve archived state. A stage/verification is not inferred from legacy text.
update public.lr_matters set status='archived' where archived_at is not null;

create table public.lr_matter_members(
 matter_id uuid not null,organization_id uuid not null,user_id uuid not null,
 role text not null check(role in('responsible','collaborator','viewer')),
 added_by uuid references public.lr_accounts(user_id),created_at timestamptz not null default now(),
 primary key(matter_id,user_id),
 foreign key(matter_id,organization_id) references public.lr_matters(id,organization_id),
 foreign key(organization_id,user_id) references public.lr_memberships(organization_id,user_id)
);
create unique index lr_one_responsible on public.lr_matter_members(matter_id) where role='responsible';
create index lr_matter_member_user on public.lr_matter_members(user_id,matter_id);
insert into public.lr_matter_members(matter_id,organization_id,user_id,role)
 select id,organization_id,owner_id,'responsible' from public.lr_matters;

create table public.lr_matter_numbers(
 id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.lr_matters(id),
 kind text not null check(kind in('esas','karar','icra_takip','sorusturma','istinaf_esas','temyiz_esas','arabuluculuk','diger')),
 value text not null check(length(trim(value))>0),normalized text not null,authority text,
 is_primary boolean not null default false,valid_from date,created_at timestamptz not null default now()
);
create unique index lr_matter_numbers_primary on public.lr_matter_numbers(matter_id) where is_primary;
create unique index lr_number_per_matter on public.lr_matter_numbers(matter_id,kind,normalized) where normalized<>'';
create index lr_matter_numbers_norm on public.lr_matter_numbers(normalized);
create table public.lr_stage_history(
 id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.lr_matters(id),
 from_stage text,to_stage text not null,changed_by uuid references public.lr_accounts(user_id),
 note text,changed_at timestamptz not null default now()
);
alter table public.lr_events add column event_type text not null default 'diger',add column note text,
 add column served_on date,add column service_method text,add column source_reference text,
 add column source_document_id uuid references public.lr_documents(id),add column created_by uuid references public.lr_accounts(user_id),
 add column corrects_event_id uuid references public.lr_events(id),add column correction_reason text,
 add column client_summary text not null default '',add column details jsonb not null default '{}';
alter table public.lr_tasks add column assignee_id uuid references public.lr_accounts(user_id),
 add column priority text not null default 'normal' check(priority in('normal','high','critical')),
 add column status text not null default 'open' check(status in('open','review','completed','cancelled')),
 add column kind text not null default 'work' check(kind in('work','client_document_request','hearing_preparation')),
 add column source_event_id uuid references public.lr_events(id),add column deadline_id uuid references public.lr_deadlines(id),
 add column shared_with_client boolean not null default false,add column requested_client_id uuid references public.lr_accounts(user_id),
 add column created_by uuid references public.lr_accounts(user_id),add column completed_by uuid references public.lr_accounts(user_id),
 add column postponed_reason text,add column postponements jsonb not null default '[]',
 add column cancellation_reason text,add column cancelled_at timestamptz,add column note text;
update public.lr_tasks set status='completed' where completed_at is not null;
update public.lr_tasks t set assignee_id=m.owner_id from public.lr_matters m where m.id=t.matter_id;
alter table public.lr_tasks add constraint lr_task_completion check(status<>'completed' or completed_at is not null);

alter table public.lr_deadlines add column status text not null default 'proposed' check(status in('proposed','verified','invalidated','met','missed','waived')),
 add column rule_key text,add column source_event_id uuid references public.lr_events(id),
 add column proposed_due_on date,add column verified_due_on date,
 add column calculation jsonb not null default '{}',add column resolution_note text,
 add column resolved_at timestamptz,add column resolved_by uuid references public.lr_accounts(user_id),
 add column invalidated_at timestamptz,add column invalidated_by_event_id uuid references public.lr_events(id),
 add column created_at timestamptz not null default now();
-- Legacy proof is retained; missing proof stays proposed for lawyer review.
update public.lr_deadlines set status='verified' where verified_due_at is not null and verified_at is not null
 and verified_by is not null and nullif(trim(legal_basis),'') is not null and nullif(trim(source_reference),'') is not null
 and nullif(trim(rule_version),'') is not null and trigger_date is not null and nullif(trim(service_method),'') is not null;
alter table public.lr_deadlines drop constraint lr_deadlines_check;
alter table public.lr_deadlines add constraint lr_verified_deadline_proof check(status not in('verified','met','missed') or(
 (verified_due_on is not null or verified_due_at is not null) and verified_at is not null and verified_by is not null
 and nullif(trim(legal_basis),'') is not null and nullif(trim(source_reference),'') is not null
 and nullif(trim(rule_version),'') is not null and trigger_date is not null and nullif(trim(service_method),'') is not null));

create table public.lr_agenda_items(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.lr_organizations(id),
 matter_id uuid not null,owner_id uuid not null references public.lr_accounts(user_id),
 kind text not null check(kind in('hearing','discovery','expert','client_meeting','mediation','followup','internal')),
 title text not null check(length(trim(title)) between 1 and 200),starts_at timestamptz,ends_at timestamptz,
 all_day boolean not null default false,all_day_date date,location text,online_url text,
 status text not null default 'planned' check(status in('planned','done','postponed','cancelled')),
 shared_with_client boolean not null default false,outcome_event_id uuid references public.lr_events(id),
 cancellation_reason text,created_at timestamptz not null default now(),
 foreign key(matter_id,organization_id) references public.lr_matters(id,organization_id),
 check((all_day and all_day_date is not null and starts_at is null and ends_at is null) or(not all_day and starts_at is not null and ends_at is not null and ends_at>starts_at))
);
alter table public.lr_tasks add column agenda_item_id uuid references public.lr_agenda_items(id);
create index lr_agenda_owner_time on public.lr_agenda_items(owner_id,starts_at) where status='planned';
create index lr_agenda_matter on public.lr_agenda_items(matter_id);
create index lr_task_assignee_due on public.lr_tasks(assignee_id,due_on) where status in('open','review');
create index lr_deadline_status on public.lr_deadlines(matter_id,status);
create table public.lr_parties(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.lr_organizations(id),
 kind text not null check(kind in('person','institution')),display_name text not null check(length(trim(display_name)) between 1 and 200),
 identifier_note text,contact_note text,created_at timestamptz not null default now(),unique(id,organization_id)
);
create table public.lr_matter_parties(
 matter_id uuid not null,organization_id uuid not null,party_id uuid not null,
 role text not null,is_client_side boolean not null default false,primary key(matter_id,party_id,role),
 foreign key(matter_id,organization_id) references public.lr_matters(id,organization_id),
 foreign key(party_id,organization_id) references public.lr_parties(id,organization_id)
);
create table public.lr_matter_links(
 from_matter uuid not null,to_matter uuid not null,organization_id uuid not null,
 kind text not null check(kind in('derived_from','enforcement_of','appeal_of','related')),
 primary key(from_matter,to_matter,kind),check(from_matter<>to_matter),
 foreign key(from_matter,organization_id) references public.lr_matters(id,organization_id),
 foreign key(to_matter,organization_id) references public.lr_matters(id,organization_id)
);
alter table public.lr_documents add column category text not null default 'diger',
 add column source_event_id uuid references public.lr_events(id),add column request_task_id uuid references public.lr_tasks(id);
-- uploaded_by comes from private_documents: deliberately NOT added a second time.
create table public.lr_document_versions(
 id uuid primary key default gen_random_uuid(),document_id uuid not null references public.lr_documents(id),
 version integer not null check(version>0),object_path text not null unique,
 sha256 text,sha256_verified boolean not null default false,is_legacy boolean not null default false,
 size_bytes bigint,media_type text,uploaded_by uuid references public.lr_accounts(user_id),
 upload_status text not null default 'uploading' check(upload_status in('uploading','ready','archived')),
 created_at timestamptz not null default now(),unique(document_id,version),
 check(is_legacy or(sha256 is not null and size_bytes is not null and sha256~'^[a-f0-9]{64}$' and size_bytes between 1 and 20971520))
);
insert into public.lr_document_versions(document_id,version,object_path,is_legacy,size_bytes,media_type,uploaded_by,upload_status,created_at)
 select id,1,object_path,true,size_bytes,media_type,uploaded_by,upload_status,created_at from public.lr_documents;
create table public.lr_expenses(
 id uuid primary key default gen_random_uuid(),matter_id uuid not null references public.lr_matters(id),
 category text not null,amount_minor bigint not null check(amount_minor>=0),currency text not null check(currency in('TRY','USD','EUR')),
 spent_on date not null,paid_by text not null check(paid_by in('office','client')),billable_to_client boolean not null default false,
 receipt_document_id uuid references public.lr_documents(id),shared_with_client boolean not null default false,
 note text,reverses_id uuid references public.lr_expenses(id),reversal_reason text,
 created_by uuid references public.lr_accounts(user_id),created_at timestamptz not null default now()
);
create unique index lr_expense_single_reversal on public.lr_expenses(reverses_id) where reverses_id is not null;
create table public.lr_saved_views(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.lr_accounts(user_id),
 name text not null check(length(trim(name)) between 1 and 80),filters jsonb not null default '{}',
 sort text,is_default boolean not null default false,pinned boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz
);
create unique index lr_saved_default on public.lr_saved_views(user_id) where is_default and deleted_at is null;
create unique index lr_saved_name on public.lr_saved_views(user_id,lower(name)) where deleted_at is null;
create table public.lr_deadline_rules(
 key text not null,version integer not null,title text not null,matter_types text[] not null,trigger_event text not null,
 offset_value integer not null,offset_unit text not null check(offset_unit in('day','week','month')),
 end_on_non_business_day text not null default 'unknown',judicial_recess text not null default 'unknown',
 legal_basis text not null,verified_by_lawyer boolean not null default false,verified_note text,
 effective_from date not null,effective_to date,primary key(key,version)
);
create table public.lr_holidays(day date not null,kind text not null check(kind in('official','half_day','judicial_recess')),source text not null,primary key(day,kind));
-- No legal rules/holidays are seeded or certified by this migration.
alter table public.lr_audit_events add column matter_id uuid references public.lr_matters(id),
 add column details jsonb not null default '{}',add column command_key uuid;
create unique index lr_audit_command on public.lr_audit_events(actor_id,command_key) where command_key is not null;
create index lr_audit_matter on public.lr_audit_events(matter_id,created_at);
create table public.lr_import_batches(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.lr_organizations(id),
 actor_id uuid not null references public.lr_accounts(user_id),created_at timestamptz not null default now(),undone_at timestamptz,
 count integer not null check(count between 1 and 500)
);
alter table public.lr_matters add column import_batch_id uuid references public.lr_import_batches(id),
 add column import_row integer,add column import_revision bigint;

-- Keep object creation, RLS and privilege revocation in this SAME transaction.
do $$ declare t text; begin foreach t in array array['lr_stage_templates','lr_event_types','lr_matter_members','lr_matter_numbers','lr_stage_history','lr_agenda_items','lr_parties','lr_matter_parties','lr_matter_links','lr_document_versions','lr_expenses','lr_saved_views','lr_deadline_rules','lr_holidays','lr_import_batches'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop; end $$;
-- Shared rows have internal columns. Do not rely on an allow-list in JavaScript.
revoke all on public.lr_matters,public.lr_events,public.lr_documents,public.lr_tasks,public.lr_internal_notes,public.lr_deadlines,public.lr_messages from public,anon,authenticated;
-- These raw surfaces are INTERNAL only through their RLS. Client DTO is separate.
grant select on public.lr_tasks,public.lr_internal_notes,public.lr_deadlines to authenticated;
-- REVOKE at table level does not reliably express a column-grant audit. Remove
-- foundation column UPDATE privileges explicitly as part of the same cutover.
do $$declare t text;cols text;begin foreach t in array array['lr_matters','lr_events','lr_documents','lr_tasks','lr_internal_notes','lr_deadlines','lr_messages'] loop
 select string_agg(format('%I',attname),',') into cols from pg_attribute where attrelid=('public.'||t)::regclass and attnum>0 and not attisdropped;
 execute format('revoke all (%s) on public.%I from public,anon,authenticated',cols,t);
end loop;end $$;

create or replace function lawroom_private.can_view_internal(mid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.lr_matter_members mm join public.lr_matters m on m.id=mm.matter_id and m.organization_id=mm.organization_id
  join public.lr_memberships mem on mem.organization_id=mm.organization_id and mem.user_id=mm.user_id and mem.active
  join public.lr_accounts a on a.user_id=mm.user_id and a.role='lawyer' and a.status='active'
  join public.lr_organizations o on o.id=m.organization_id and o.status='active'
  where mm.matter_id=mid and mm.user_id=auth.uid());
$$;
create or replace function lawroom_private.can_write(mid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select lawroom_private.can_view_internal(mid) and exists(select 1 from public.lr_matter_members mm
 join public.lr_matters m on m.id=mm.matter_id where mm.matter_id=mid and mm.user_id=auth.uid()
 and mm.role in('responsible','collaborator') and m.archived_at is null and m.status in('active','on_hold'));
$$;
create or replace function lawroom_private.client_can_read(mid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select lawroom_private.has_role('client') and exists(
 select 1 from public.lr_matter_clients mc join public.lr_matters m on m.id=mc.matter_id and m.organization_id=mc.organization_id
 join public.lr_relationships r on r.id=mc.relationship_id and r.organization_id=m.organization_id and r.status='accepted'
 join public.lr_matter_members mm on mm.matter_id=m.id and mm.user_id=r.lawyer_id and mm.role in('responsible','collaborator')
 join public.lr_memberships mem on mem.organization_id=m.organization_id and mem.user_id=mm.user_id and mem.active
 join public.lr_accounts a on a.user_id=mm.user_id and a.role='lawyer' and a.status='active'
 join public.lr_organizations o on o.id=m.organization_id and o.status='active'
 where mc.matter_id=mid and mc.shared and r.client_id=auth.uid() and m.archived_at is null and m.status in('active','on_hold'));
$$;
create or replace function lawroom_private.can_read(mid uuid) returns boolean
language sql stable security definer set search_path='' as $$select lawroom_private.can_view_internal(mid) or lawroom_private.client_can_read(mid)$$;
create function lawroom_private.require_writer(mid uuid) returns void language plpgsql stable security definer set search_path='' as $$begin
 if not lawroom_private.can_write(mid) then raise exception 'matter_writer_required' using errcode='42501'; end if;
end $$;
create function lawroom_private.required_text(value text,maximum integer) returns text language plpgsql immutable set search_path='' as $$begin
 if value is null or length(trim(value)) not between 1 and maximum then raise exception 'invalid_required_text'; end if;return trim(value);
end $$;
create function lawroom_private.input_day(value text,optional boolean default false) returns date language plpgsql immutable set search_path='' as $$declare d date;begin
 if nullif(trim(value),'') is null and optional then return null;end if;
 if value is null or value!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid_iso_date';end if;
 d:=value::date;if to_char(d,'YYYY-MM-DD')<>value then raise exception 'invalid_calendar_date';end if;return d;
end $$;
create function lawroom_private.input_stamp(value text) returns timestamptz language plpgsql immutable set search_path='' as $$begin
 if value is null or value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'explicit_timezone_required';end if;
 return value::timestamptz;
end $$;
create function lawroom_private.normalized_number(value text) returns text language plpgsql immutable set search_path='' as $$declare parts text[];begin
 parts:=regexp_match(trim(value),'^([0-9]{4})[[:space:]]*[/—–-][[:space:]]*([0-9]{1,12})[[:space:]]*([eEkK]|[eE][sS][aA][sS]|[kK][aA][rR][aA][rR])?\.?$');
 if parts is null then parts:=regexp_match(trim(value),'^([0-9]{4})[[:space:]]+([0-9]{1,12})[[:space:]]*([eEkK]|[eE][sS][aA][sS]|[kK][aA][rR][aA][rR])?\.?$');end if;
 if parts is null then return null;end if;return parts[1]||'/'||(parts[2]::numeric)::text;
end $$;
create function lawroom_private.validate_keys(p jsonb,allowed text[]) returns void language plpgsql immutable set search_path='' as $$begin
 if p is null or jsonb_typeof(p)<>'object' or exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then raise exception 'unsupported_payload_fields';end if;
end $$;
create function lawroom_private.audit(mid uuid,action text,entity uuid,details jsonb default '{}',key uuid default null) returns void language sql security definer set search_path='' as $$
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id,matter_id,details,command_key)
 values(auth.uid(),action,'tracking',entity,mid,details,key);
$$;
create function lawroom_private.replay(mid uuid,action text,key uuid) returns boolean language plpgsql security definer set search_path='' as $$declare old public.lr_audit_events;begin
 if key is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||key::text,0));
 select * into old from public.lr_audit_events a where a.actor_id=auth.uid() and a.command_key=key;
 if old.id is null then return false;end if;
 if old.matter_id is distinct from mid or old.action<>action then raise exception 'command_key_reused';end if;return true;
end $$;
create function lawroom_private.valid_assignee(mid uuid,uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_matter_members mm join public.lr_memberships mem on mem.organization_id=mm.organization_id and mem.user_id=mm.user_id and mem.active
 join public.lr_accounts a on a.user_id=mm.user_id and a.role='lawyer' and a.status='active'
 where mm.matter_id=mid and mm.user_id=uid and mm.role in('responsible','collaborator'));
$$;
create function lawroom_private.accepted_client(mid uuid,uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id and r.organization_id=mc.organization_id
 join public.lr_accounts a on a.user_id=r.client_id and a.role='client' and a.status='active'
 join public.lr_matter_members mm on mm.matter_id=mc.matter_id and mm.user_id=r.lawyer_id and mm.role in('responsible','collaborator')
 join public.lr_memberships mem on mem.organization_id=mc.organization_id and mem.user_id=mm.user_id and mem.active
 join public.lr_accounts lawyer on lawyer.user_id=mm.user_id and lawyer.role='lawyer' and lawyer.status='active'
 join public.lr_organizations org on org.id=mc.organization_id and org.status='active'
 where mc.matter_id=mid and r.client_id=uid and r.status='accepted');
$$;

-- Defense in depth: internal row policies are useful if a later reviewed grant is added.
create policy member_internal on public.lr_matter_members for select to authenticated using(lawroom_private.can_view_internal(matter_id));
create policy number_read on public.lr_matter_numbers for select to authenticated using(lawroom_private.can_read(matter_id));
create policy stage_read on public.lr_stage_history for select to authenticated using(lawroom_private.can_view_internal(matter_id));
create policy agenda_read on public.lr_agenda_items for select to authenticated using(lawroom_private.can_view_internal(matter_id) or(shared_with_client and lawroom_private.client_can_read(matter_id)));
create policy party_read on public.lr_parties for select to authenticated using(exists(select 1 from public.lr_matter_parties mp where mp.party_id=id and lawroom_private.can_view_internal(mp.matter_id)));
create policy matter_party_read on public.lr_matter_parties for select to authenticated using(lawroom_private.can_view_internal(matter_id));
create policy link_read on public.lr_matter_links for select to authenticated using(lawroom_private.can_view_internal(from_matter) and lawroom_private.can_view_internal(to_matter));
create policy expense_internal on public.lr_expenses for select to authenticated using(lawroom_private.can_view_internal(matter_id));
create policy view_self on public.lr_saved_views for select to authenticated using(user_id=auth.uid() and lawroom_private.has_role('lawyer'));
create policy batch_self on public.lr_import_batches for select to authenticated using(actor_id=auth.uid() and lawroom_private.is_member(organization_id));
create policy template_lawyer on public.lr_stage_templates for select to authenticated using(lawroom_private.has_role('lawyer'));
create policy rule_lawyer on public.lr_deadline_rules for select to authenticated using(lawroom_private.has_role('lawyer'));
create policy holiday_lawyer on public.lr_holidays for select to authenticated using(lawroom_private.has_role('lawyer'));
create policy version_read on public.lr_document_versions for select to authenticated using(exists(select 1 from public.lr_documents d where d.id=document_id and(lawroom_private.can_view_internal(d.matter_id) or(d.shared and lr_document_versions.upload_status='ready' and lawroom_private.client_can_read(d.matter_id)))));
drop policy lawyer_read on public.lr_tasks;
create policy lawyer_read on public.lr_tasks for select to authenticated using(lawroom_private.can_view_internal(matter_id));
drop policy lawyer_read on public.lr_internal_notes;
create policy lawyer_read on public.lr_internal_notes for select to authenticated using(lawroom_private.can_view_internal(matter_id));
drop policy deadline_read on public.lr_deadlines;
create policy deadline_read on public.lr_deadlines for select to authenticated using(lawroom_private.can_view_internal(matter_id));
drop policy matter_update on public.lr_matters;
create policy matter_update on public.lr_matters for update to authenticated using(lawroom_private.can_write(id)) with check(lawroom_private.can_write(id));

create function lawroom_private.initialize_matter_member() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.lr_matter_members(matter_id,organization_id,user_id,role) values(new.id,new.organization_id,new.owner_id,'responsible');return new;
end $$;
create trigger lr_initialize_member after insert on public.lr_matters for each row execute function lawroom_private.initialize_matter_member();
create function lawroom_private.bump_revision() returns trigger language plpgsql set search_path='' as $$begin new.revision:=old.revision+1;new.updated_at:=now();return new;end $$;
create trigger lr_matter_revision before update on public.lr_matters for each row execute function lawroom_private.bump_revision();
create function lawroom_private.touch_matter() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='DELETE' then update public.lr_matters set last_activity_at=now() where id=old.matter_id;return old;end if;
 update public.lr_matters set last_activity_at=now() where id=new.matter_id;return new;
end $$;
do $$ declare t text; begin foreach t in array array['lr_matter_members','lr_matter_numbers','lr_stage_history','lr_events','lr_tasks','lr_deadlines','lr_agenda_items','lr_matter_parties','lr_documents','lr_expenses','lr_internal_notes','lr_messages'] loop
 execute format('create trigger lr_activity after insert or update or delete on public.%I for each row execute function lawroom_private.touch_matter()',t);
end loop;end $$;
create function lawroom_private.touch_version_matter() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.lr_matters set last_activity_at=now() where id=(select matter_id from public.lr_documents where id=new.document_id);return new;
end $$;
create trigger lr_version_activity after insert or update on public.lr_document_versions for each row execute function lawroom_private.touch_version_matter();

create function lawroom_private.date_value(d date,t timestamptz) returns text language sql immutable set search_path='' as $$select coalesce(d::text,to_jsonb(t)#>>'{}')$$;
create function lawroom_private.document_dto(mid uuid,internal boolean) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'category',d.category,'shared',d.shared,
 'versions',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'number',v.version,'name',d.name,'sizeBytes',v.size_bytes,'mediaType',v.media_type,'createdAt',v.created_at)
 ||case when internal then jsonb_build_object('sha256',v.sha256,'sha256Verified',v.sha256_verified,'uploadedBy',v.uploaded_by,'objectPath',v.object_path) else '{}'::jsonb end order by v.version),'[]')
 from public.lr_document_versions v where v.document_id=d.id and v.upload_status='ready'))
 ||case when internal then jsonb_build_object('sourceEventId',d.source_event_id,'requestTaskId',d.request_task_id) else '{}'::jsonb end order by d.created_at),'[]')
 from public.lr_documents d where d.matter_id=mid and d.upload_status='ready' and
 ((internal and lawroom_private.can_view_internal(mid)) or(not internal and d.shared and lawroom_private.client_can_read(mid)));
$$;
create function lawroom_private.internal_dto(mid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare m public.lr_matters; result jsonb;begin
 if not lawroom_private.can_view_internal(mid) then raise exception 'matter_access_denied' using errcode='42501';end if;
 select * into strict m from public.lr_matters where id=mid;
 result:=jsonb_build_object('id',m.id,'organizationId',m.organization_id,'title',m.title,'type',m.matter_type,'subtype',m.subtype,
 'number',m.reference,'court',m.court,'stage',m.stage,'stageKey',m.stage_key,'stageSnapshot',m.template_snapshot,'templateVersion',m.template_version,
 'status',m.status,'priority',m.priority,'internalRef',m.internal_ref,'responsibleId',m.owner_id,
 'responsibleName',(select display_name from public.lr_accounts where user_id=m.owner_id),
 'nextAction',m.next_action,'targetDate',m.target_date,'summary',m.client_summary,'archivedAt',m.archived_at,'closedReason',m.closed_reason,'closedOn',m.closed_on,
 'createdAt',m.created_at,'lastActivityAt',m.last_activity_at,'revision',m.revision,'readonly',not lawroom_private.can_write(mid));
 result:=result||jsonb_build_object(
 'shared',exists(select 1 from public.lr_matter_clients where matter_id=mid and shared),
 'clients',(select coalesce(jsonb_agg(jsonb_build_object('id',r.client_id,'name',a.display_name,'relationshipId',r.id,'shared',mc.shared)),'[]') from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id join public.lr_accounts a on a.user_id=r.client_id where mc.matter_id=mid and r.status='accepted'),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('userId',mm.user_id,'role',mm.role,'name',a.display_name,'active',mem.active)),'[]') from public.lr_matter_members mm join public.lr_accounts a on a.user_id=mm.user_id join public.lr_memberships mem on mem.organization_id=mm.organization_id and mem.user_id=mm.user_id where mm.matter_id=mid),
 'numbers',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'value',value,'normalized',normalized,'authority',authority,'isPrimary',is_primary,'validFrom',valid_from) order by created_at),'[]') from public.lr_matter_numbers where matter_id=mid),
 'stageHistory',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'fromStage',from_stage,'toStage',to_stage,'actorId',changed_by,'note',note,'at',changed_at) order by changed_at,id),'[]') from public.lr_stage_history where matter_id=mid),
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'eventType',event_type,'title',title,'occurredOn',occurred_on,'note',note,'servedOn',served_on,'serviceMethod',service_method,'sourceReference',source_reference,'sourceDocumentId',source_document_id,'correctsEventId',corrects_event_id,'correctionReason',correction_reason,'shared',shared,'clientSummary',client_summary,'createdBy',created_by,'createdAt',created_at) order by occurred_on,created_at,id),'[]') from public.lr_events where matter_id=mid));
 result:=result||jsonb_build_object(
 'tasks',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'dueOn',due_on,'status',status,'done',status='completed','completedAt',completed_at,'completedBy',completed_by,'assigneeId',assignee_id,'priority',priority,'kind',kind,'sourceEventId',source_event_id,'deadlineId',deadline_id,'agendaItemId',agenda_item_id,'sharedWithClient',shared_with_client,'requestedClientId',requested_client_id,'postponements',postponements,'cancellationReason',cancellation_reason,'note',note) order by created_at,id),'[]') from public.lr_tasks where matter_id=mid),
 'deadlines',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'proposedDueAt',lawroom_private.date_value(proposed_due_on,proposed_due_at),'verifiedDueAt',lawroom_private.date_value(verified_due_on,verified_due_at),'triggerDate',trigger_date,'serviceMethod',service_method,'legalBasis',legal_basis,'sourceReference',source_reference,'ruleVersion',rule_version,'ruleKey',rule_key,'sourceEventId',source_event_id,'verifiedBy',verified_by,'verifiedAt',verified_at,'calculation',calculation,'resolutionNote',resolution_note) order by created_at,id),'[]') from public.lr_deadlines where matter_id=mid),
 'agendaItems',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'startsAt',starts_at,'endsAt',ends_at,'allDayDate',all_day_date,'location',location,'status',status,'sharedWithClient',shared_with_client,'outcomeEventId',outcome_event_id,'ownerId',owner_id) order by coalesce(starts_at,all_day_date::timestamp at time zone 'Europe/Istanbul'),id),'[]') from public.lr_agenda_items where matter_id=mid),
 'parties',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'kind',p.kind,'role',mp.role,'isClientSide',mp.is_client_side,'identifierNote',p.identifier_note,'contactNote',p.contact_note)),'[]') from public.lr_matter_parties mp join public.lr_parties p on p.id=mp.party_id where mp.matter_id=mid),
 'links',(select coalesce(jsonb_agg(jsonb_build_object('id',from_matter::text||'/'||to_matter::text||'/'||kind,'matterId',case when from_matter=mid then to_matter else from_matter end,'kind',kind,'direction',case when from_matter=mid then 'outgoing' else 'incoming' end)),'[]') from public.lr_matter_links where(from_matter=mid or to_matter=mid) and lawroom_private.can_view_internal(from_matter) and lawroom_private.can_view_internal(to_matter)),
 'internalNotes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'body',body,'createdAt',created_at) order by created_at,id),'[]') from public.lr_internal_notes where matter_id=mid));
 result:=result||jsonb_build_object(
 'expenses',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'amountMinor',amount_minor,'currency',currency,'spentOn',spent_on,'paidBy',paid_by,'billableToClient',billable_to_client,'note',note,'reversesId',reverses_id,'reason',reversal_reason,'createdBy',created_by,'createdAt',created_at) order by created_at,id),'[]') from public.lr_expenses where matter_id=mid),
 'auditHistory',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'entityId',entity_id,'actorId',actor_id,'occurredAt',created_at,'commandKey',command_key,'details',details) order by created_at,id),'[]') from public.lr_audit_events where matter_id=mid),
 'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',msg.id,'body',msg.body,'role',a.role,'createdAt',msg.created_at) order by msg.created_at,msg.id),'[]') from public.lr_messages msg join public.lr_accounts a on a.user_id=msg.sender_id where msg.matter_id=mid and a.role in('lawyer','client')),
 'documents',lawroom_private.document_dto(mid,true));
 return jsonb_build_object('schemaVersion',2,'audience','lawyer','matter',result);
end $$;

create function lawroom_private.client_dto(mid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare m public.lr_matters; label text; result jsonb;begin
 if not lawroom_private.client_can_read(mid) then raise exception 'matter_access_denied' using errcode='42501';end if;
 select * into strict m from public.lr_matters where id=mid;
 select s->>'clientLabel' into label from jsonb_array_elements(coalesce(m.template_snapshot->'stages','[]')) s where s->>'key'=m.stage_key;
 result:=jsonb_build_object('id',m.id,'title',m.title,'number',m.reference,'stage',coalesce(label,'Avukatınız süreci takip ediyor'),'summary',m.client_summary,
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',case when client_summary<>'' then client_summary else title end,'occurredOn',occurred_on) order by occurred_on,created_at,id),'[]') from public.lr_events where matter_id=mid and shared),
 'agendaItems',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'startsAt',starts_at,'endsAt',ends_at,'allDayDate',all_day_date,'status',status) order by starts_at,id),'[]') from public.lr_agenda_items where matter_id=mid and shared_with_client and status<>'cancelled'),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'dueOn',due_on,'status',status) order by created_at,id),'[]') from public.lr_tasks where matter_id=mid and kind='client_document_request' and shared_with_client and requested_client_id=auth.uid() and status in('open','review')),
 'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',msg.id,'body',msg.body,'role',a.role,'createdAt',msg.created_at) order by msg.created_at,msg.id),'[]') from public.lr_messages msg join public.lr_accounts a on a.user_id=msg.sender_id where msg.matter_id=mid and a.role in('lawyer','client')),
 'documents',lawroom_private.document_dto(mid,false));
 return jsonb_build_object('schemaVersion',2,'audience','client','matter',result);
end $$;
create function lawroom_private.get_tracking_matter(mid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if lawroom_private.can_view_internal(mid) then return lawroom_private.internal_dto(mid);end if;
 return lawroom_private.client_dto(mid);
end $$;
create function lawroom_private.list_tracking_matters() returns setof jsonb language plpgsql stable security definer set search_path='' as $$begin
 if lawroom_private.has_role('admin') then return;end if;
 return query select lawroom_private.get_tracking_matter(m.id) from public.lr_matters m
 where lawroom_private.can_view_internal(m.id) or lawroom_private.client_can_read(m.id) order by m.created_at desc,m.id;
end $$;

create function lawroom_private.insert_task(mid uuid,p jsonb,eid uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare tid uuid:=gen_random_uuid();assignee uuid;requested uuid;begin
 perform lawroom_private.require_writer(mid);
 perform lawroom_private.validate_keys(p,array['title','dueOn','assigneeId','priority','kind','deadlineId','agendaItemId','sharedWithClient','requestedClientId','note']);
 assignee:=coalesce(nullif(p->>'assigneeId','')::uuid,auth.uid());
 if not lawroom_private.valid_assignee(mid,assignee) then raise exception 'active_case_assignee_required';end if;
 requested:=nullif(p->>'requestedClientId','')::uuid;
 if coalesce(p->>'kind','work')='client_document_request' then
  if requested is null or not lawroom_private.accepted_client(mid,requested) then raise exception 'accepted_request_client_required';end if;
 elsif requested is not null then raise exception 'request_client_only';end if;
 if nullif(p->>'deadlineId','') is not null and not exists(select 1 from public.lr_deadlines where id=(p->>'deadlineId')::uuid and matter_id=mid) then raise exception 'deadline_case_mismatch';end if;
 if nullif(p->>'agendaItemId','') is not null and not exists(select 1 from public.lr_agenda_items where id=(p->>'agendaItemId')::uuid and matter_id=mid) then raise exception 'agenda_case_mismatch';end if;
 insert into public.lr_tasks(id,matter_id,title,due_on,assignee_id,priority,kind,source_event_id,deadline_id,agenda_item_id,shared_with_client,requested_client_id,created_by,note)
 values(tid,mid,lawroom_private.required_text(p->>'title',200),lawroom_private.input_day(p->>'dueOn',true),assignee,coalesce(p->>'priority','normal'),coalesce(p->>'kind','work'),eid,nullif(p->>'deadlineId','')::uuid,nullif(p->>'agendaItemId','')::uuid,coalesce((p->>'sharedWithClient')::boolean,false),requested,auth.uid(),left(p->>'note',2000));
 return tid;
end $$;
create function lawroom_private.insert_agenda(mid uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare aid uuid:=gen_random_uuid();org uuid;ownerid uuid;begin
 perform lawroom_private.require_writer(mid);
 perform lawroom_private.validate_keys(p,array['title','kind','startsAt','endsAt','allDayDate','location','onlineUrl','sharedWithClient','ownerId']);
 select organization_id into org from public.lr_matters where id=mid;
 ownerid:=coalesce(nullif(p->>'ownerId','')::uuid,auth.uid());if not lawroom_private.valid_assignee(mid,ownerid) then raise exception 'active_case_owner_required';end if;
 if coalesce((p->>'sharedWithClient')::boolean,false) and not exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=mid and r.status='accepted') then raise exception 'accepted_client_link_required';end if;
 insert into public.lr_agenda_items(id,organization_id,matter_id,owner_id,title,kind,starts_at,ends_at,all_day,all_day_date,location,online_url,shared_with_client)
 values(aid,org,mid,ownerid,lawroom_private.required_text(p->>'title',200),p->>'kind',
 case when nullif(p->>'allDayDate','') is null then lawroom_private.input_stamp(p->>'startsAt') end,
 case when nullif(p->>'allDayDate','') is null then lawroom_private.input_stamp(p->>'endsAt') end,
 nullif(p->>'allDayDate','') is not null,lawroom_private.input_day(p->>'allDayDate',true),left(p->>'location',300),left(p->>'onlineUrl',500),coalesce((p->>'sharedWithClient')::boolean,false));return aid;
end $$;
create function lawroom_private.insert_event(mid uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare eid uuid:=gen_random_uuid();oldid uuid;docid uuid;begin
 perform lawroom_private.require_writer(mid);
 perform lawroom_private.validate_keys(p,array['eventType','title','occurredOn','note','servedOn','serviceMethod','sourceReference','sourceDocumentId','correctsEventId','correctionReason','shared','clientSummary']);
 if not exists(select 1 from public.lr_event_types where key=p->>'eventType') then raise exception 'unknown_event_type';end if;
 oldid:=nullif(p->>'correctsEventId','')::uuid;docid:=nullif(p->>'sourceDocumentId','')::uuid;
 if oldid is not null then
  if not exists(select 1 from public.lr_events where id=oldid and matter_id=mid) then raise exception 'correction_case_mismatch';end if;
  perform lawroom_private.required_text(p->>'correctionReason',1000);
 end if;
 if docid is not null and not exists(select 1 from public.lr_documents where id=docid and matter_id=mid) then raise exception 'document_case_mismatch';end if;
 if nullif(p->>'servedOn','') is not null then perform lawroom_private.required_text(p->>'serviceMethod',200);end if;
 if coalesce((p->>'shared')::boolean,false) then
  perform lawroom_private.required_text(p->>'clientSummary',1000);
  if not exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=mid and r.status='accepted') then raise exception 'accepted_client_link_required';end if;
 end if;
 insert into public.lr_events(id,matter_id,title,occurred_on,event_type,note,served_on,service_method,source_reference,source_document_id,created_by,corrects_event_id,correction_reason,shared,client_summary)
 values(eid,mid,lawroom_private.required_text(p->>'title',200),lawroom_private.input_day(p->>'occurredOn'),p->>'eventType',left(p->>'note',4000),lawroom_private.input_day(p->>'servedOn',true),left(p->>'serviceMethod',200),left(p->>'sourceReference',1000),docid,auth.uid(),oldid,left(p->>'correctionReason',1000),coalesce((p->>'shared')::boolean,false),case when coalesce((p->>'shared')::boolean,false) then p->>'clientSummary' else '' end);
 if oldid is not null then update public.lr_deadlines set status='invalidated',invalidated_at=now(),invalidated_by_event_id=eid where source_event_id=oldid and matter_id=mid and status not in('met','waived');end if;
 return eid;
end $$;
create function lawroom_private.insert_deadline(mid uuid,eid uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare did uuid:=gen_random_uuid();ev public.lr_events;begin
 perform lawroom_private.require_writer(mid);perform lawroom_private.validate_keys(p,array['title','proposedDueAt']);
 select * into ev from public.lr_events where id=eid and matter_id=mid;
 if ev.id is null or ev.served_on is null or nullif(trim(ev.service_method),'') is null or nullif(trim(ev.source_reference),'') is null then raise exception 'deadline_source_required';end if;
 insert into public.lr_deadlines(id,matter_id,title,trigger_date,service_method,source_reference,proposed_due_on,source_event_id,status)
 values(did,mid,lawroom_private.required_text(p->>'title',200),ev.served_on,ev.service_method,ev.source_reference,lawroom_private.input_day(p->>'proposedDueAt',true),eid,'proposed');return did;
end $$;
create function lawroom_private.add_proceeding(mid uuid,ev jsonb,tasks jsonb,deadlines jsonb,agenda jsonb,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare eid uuid;item jsonb;begin
 perform lawroom_private.require_writer(mid);perform 1 from public.lr_matters where id=mid for update;
 if lawroom_private.replay(mid,'add_event',key) then return lawroom_private.internal_dto(mid);end if;
 if tasks is null or deadlines is null or agenda is null or jsonb_typeof(tasks)<>'array' or jsonb_typeof(deadlines)<>'array' or jsonb_typeof(agenda)<>'array' or greatest(jsonb_array_length(tasks),jsonb_array_length(deadlines),jsonb_array_length(agenda))>50 then raise exception 'invalid_child_arrays';end if;
 eid:=lawroom_private.insert_event(mid,ev);
 for item in select value from jsonb_array_elements(deadlines) loop perform lawroom_private.insert_deadline(mid,eid,item);end loop;
 for item in select value from jsonb_array_elements(tasks) loop perform lawroom_private.insert_task(mid,item,eid);end loop;
 for item in select value from jsonb_array_elements(agenda) loop perform lawroom_private.insert_agenda(mid,item);end loop;
 perform lawroom_private.audit(mid,'add_event',eid,jsonb_build_object('tasks',jsonb_array_length(tasks),'deadlines',jsonb_array_length(deadlines),'agenda',jsonb_array_length(agenda)),key);
 return lawroom_private.internal_dto(mid);
end $$;

create function lawroom_private.create_tracking_matter(p jsonb,key uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=gen_random_uuid();org uuid;tmpl jsonb;st jsonb;rid uuid;old public.lr_audit_events;tid uuid;begin
 perform lawroom_private.validate_keys(p,array['organizationId','type','subtype','title','number','numberKind','court','stageKey','clientMode','clientId','partyName','nextAction','targetDate','internalRef']);
 org:=(p->>'organizationId')::uuid;
 if not coalesce(lawroom_private.is_member(org),false) then raise exception 'active_organization_member_required' using errcode='42501';end if;
 if key is not null then
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||key::text,0));
  select * into old from public.lr_audit_events a where a.actor_id=auth.uid() and a.command_key=key;
  if old.id is not null then
   if old.action<>'matter_created' then raise exception 'command_key_reused';end if;
   if not exists(select 1 from public.lr_matters where id=old.matter_id and organization_id=org) then raise exception 'command_key_reused';end if;
   return lawroom_private.internal_dto(old.matter_id);
  end if;
 end if;
 select s.snapshot into tmpl from public.lr_stage_templates s where s.key=p->>'type' order by s.version desc limit 1;
 if tmpl is null or not(tmpl->'subtypes' ? (p->>'subtype')) then raise exception 'valid_template_subtype_required';end if;
 select value into st from jsonb_array_elements(tmpl->'stages') where value->>'key'=p->>'stageKey';
 if st is null then raise exception 'template_stage_required';end if;
 if coalesce(p->>'clientMode','none') not in('none','party','accepted') then raise exception 'invalid_client_mode';end if;
 if p->>'clientMode'='accepted' then
  select r.id into rid from public.lr_relationships r join public.lr_accounts a on a.user_id=r.client_id and a.role='client' and a.status='active'
  where r.organization_id=org and r.lawyer_id=auth.uid() and r.client_id=(p->>'clientId')::uuid and r.status='accepted';
  if rid is null then raise exception 'accepted_client_relationship_required';end if;
 end if;
 insert into public.lr_matters(id,organization_id,owner_id,title,matter_type,subtype,reference,court,stage,stage_key,template_key,template_version,template_snapshot,internal_ref)
 values(mid,org,auth.uid(),lawroom_private.required_text(p->>'title',160),tmpl->>'label',p->>'subtype',nullif(trim(p->>'number'),''),left(p->>'court',200),st->>'label',st->>'key',tmpl->>'key',tmpl->>'version',tmpl,left(p->>'internalRef',120));
 if nullif(trim(p->>'number'),'') is not null then
  insert into public.lr_matter_numbers(matter_id,kind,value,normalized,authority,is_primary,valid_from)
  values(mid,p->>'numberKind',lawroom_private.required_text(p->>'number',120),coalesce(lawroom_private.normalized_number(p->>'number'),''),left(p->>'court',200),true,current_date);
 end if;
 if rid is not null then insert into public.lr_matter_clients values(mid,org,rid,false);end if;
 if p->>'clientMode'='party' then
  tid:=gen_random_uuid();insert into public.lr_parties(id,organization_id,kind,display_name) values(tid,org,'person',lawroom_private.required_text(p->>'partyName',200));
  insert into public.lr_matter_parties values(mid,org,tid,'client_side',true);
 end if;
 insert into public.lr_stage_history(matter_id,to_stage,changed_by,note) values(mid,st->>'key',auth.uid(),'Dosya oluşturuldu.');
 if nullif(trim(p->>'nextAction'),'') is not null then perform lawroom_private.insert_task(mid,jsonb_build_object('title',p->>'nextAction','dueOn',p->>'targetDate'));
 elsif nullif(p->>'targetDate','') is not null then raise exception 'target_requires_first_task';end if;
 perform lawroom_private.audit(mid,'matter_created',mid,'{}',key);return lawroom_private.internal_dto(mid);
end $$;

create function lawroom_private.tracking_command(mid uuid,command text,p jsonb,key uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.lr_matters;t public.lr_tasks;d public.lr_deadlines;a public.lr_agenda_items;x public.lr_expenses;entity uuid:=mid;st jsonb;v text;due date;org uuid;item jsonb;eid uuid;begin
 if command='reopen' then
  if not lawroom_private.can_view_internal(mid) or not lawroom_private.valid_assignee(mid,auth.uid()) then raise exception 'matter_writer_required' using errcode='42501';end if;
 else perform lawroom_private.require_writer(mid);end if;
 select * into strict m from public.lr_matters where id=mid for update;org:=m.organization_id;
 -- Recheck after acquiring the row lock: another transaction may have archived
 -- the case while this command was waiting.
 if command='reopen' then
  if not lawroom_private.can_view_internal(mid) or not lawroom_private.valid_assignee(mid,auth.uid()) then raise exception 'matter_writer_required' using errcode='42501';end if;
 else perform lawroom_private.require_writer(mid);end if;
 if lawroom_private.replay(mid,command,key) then return lawroom_private.internal_dto(mid);end if;
 case command
 when 'add_task' then entity:=lawroom_private.insert_task(mid,p);
 when 'add_agenda' then entity:=lawroom_private.insert_agenda(mid,p);
 when 'complete_task','cancel_task','postpone_task' then
  perform lawroom_private.validate_keys(p,case when command='complete_task' then array['id'] when command='cancel_task' then array['id','reason'] else array['id','dueOn','reason'] end);
  select * into t from public.lr_tasks where id=(p->>'id')::uuid and matter_id=mid and status in('open','review') for update;
  if t.id is null then raise exception 'open_task_required';end if;entity:=t.id;
  if command='complete_task' then update public.lr_tasks set status='completed',completed_at=now(),completed_by=auth.uid() where id=t.id;
  elsif command='cancel_task' then update public.lr_tasks set status='cancelled',cancelled_at=now(),cancellation_reason=lawroom_private.required_text(p->>'reason',1000) where id=t.id;
  else due:=lawroom_private.input_day(p->>'dueOn');if due<=t.due_on then raise exception 'later_task_target_required';end if;
   update public.lr_tasks set due_on=due,postponements=postponements||jsonb_build_array(jsonb_build_object('from',t.due_on,'to',due,'reason',lawroom_private.required_text(p->>'reason',1000),'actorId',auth.uid(),'at',now())) where id=t.id;
  end if;
 when 'change_stage' then
  perform lawroom_private.validate_keys(p,array['stageKey','note']);
  select value into st from jsonb_array_elements(m.template_snapshot->'stages') where value->>'key'=p->>'stageKey';
  if st is null or st->>'key'=m.stage_key then raise exception 'different_snapshot_stage_required';end if;
  insert into public.lr_stage_history(matter_id,from_stage,to_stage,changed_by,note) values(mid,m.stage_key,st->>'key',auth.uid(),lawroom_private.required_text(p->>'note',1000));
  update public.lr_matters set stage_key=st->>'key',stage=st->>'label' where id=mid;
 when 'add_number' then
  perform lawroom_private.validate_keys(p,array['value','kind','authority','isPrimary']);entity:=gen_random_uuid();
  if coalesce((p->>'isPrimary')::boolean,false) or not exists(select 1 from public.lr_matter_numbers where matter_id=mid) then
   update public.lr_matter_numbers set is_primary=false where matter_id=mid;
   update public.lr_matters set reference=lawroom_private.required_text(p->>'value',120) where id=mid;
  end if;
  insert into public.lr_matter_numbers(id,matter_id,kind,value,normalized,authority,is_primary) values(entity,mid,p->>'kind',lawroom_private.required_text(p->>'value',120),coalesce(lawroom_private.normalized_number(p->>'value'),''),left(p->>'authority',200),not exists(select 1 from public.lr_matter_numbers where matter_id=mid and is_primary));
 when 'add_party' then
  perform lawroom_private.validate_keys(p,array['name','role','kind','isClientSide','contactNote']);entity:=gen_random_uuid();
  if p->>'role' not in('Davacı','Davalı','Alacaklı','Borçlu','Şüpheli','Sanık','Müşteki','Katılan','Karşı vekil','Bilirkişi','Arabulucu','Diğer','client_side') then raise exception 'invalid_party_role';end if;
  insert into public.lr_parties(id,organization_id,kind,display_name,contact_note) values(entity,org,coalesce(p->>'kind','person'),lawroom_private.required_text(p->>'name',200),left(p->>'contactNote',1000));
  insert into public.lr_matter_parties values(mid,org,entity,p->>'role',coalesce((p->>'isClientSide')::boolean,false));
 when 'add_note' then
  perform lawroom_private.validate_keys(p,array['body']);entity:=gen_random_uuid();insert into public.lr_internal_notes(id,matter_id,body) values(entity,mid,lawroom_private.required_text(p->>'body',8000));
 when 'add_message' then
  perform lawroom_private.validate_keys(p,array['body']);
  if not exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=mid and mc.shared and lawroom_private.accepted_client(mid,r.client_id)) then raise exception 'shared_client_required';end if;
  entity:=gen_random_uuid();insert into public.lr_messages(id,matter_id,sender_id,body) values(entity,mid,auth.uid(),lawroom_private.required_text(p->>'body',8000));
 when 'add_expense' then
  perform lawroom_private.validate_keys(p,array['category','amount','currency','spentOn','paidBy','billableToClient','note']);
  if (p->>'amount')!~'^(0|[1-9][0-9]{0,8})([.,][0-9]{1,2})?$' then raise exception 'invalid_decimal_amount';end if;
  if p->>'category' not in('Harç','Tebligat','Bilirkişi','Keşif','Yol','Diğer') then raise exception 'invalid_expense_category';end if;
  entity:=gen_random_uuid();insert into public.lr_expenses(id,matter_id,category,amount_minor,currency,spent_on,paid_by,billable_to_client,note,created_by)
  values(entity,mid,lawroom_private.required_text(p->>'category',80),(replace(p->>'amount',',','.')::numeric*100)::bigint,coalesce(p->>'currency','TRY'),lawroom_private.input_day(p->>'spentOn'),p->>'paidBy',coalesce((p->>'billableToClient')::boolean,false),left(p->>'note',1000),auth.uid());
 when 'reverse_expense' then
  perform lawroom_private.validate_keys(p,array['id','reason']);select * into x from public.lr_expenses where id=(p->>'id')::uuid and matter_id=mid and reverses_id is null;
  if x.id is null then raise exception 'expense_required';end if;entity:=gen_random_uuid();
  insert into public.lr_expenses(id,matter_id,category,amount_minor,currency,spent_on,paid_by,reverses_id,reversal_reason,created_by) values(entity,mid,x.category,x.amount_minor,x.currency,current_date,x.paid_by,x.id,lawroom_private.required_text(p->>'reason',1000),auth.uid());
 when 'verify_deadline' then
  perform lawroom_private.validate_keys(p,array['id','dueOn','legalBasis','sourceReference','ruleVersion','note','confirmed']);
  select * into d from public.lr_deadlines where id=(p->>'id')::uuid and matter_id=mid and status='proposed' for update;
  if d.id is null or d.trigger_date is null or nullif(trim(d.service_method),'') is null or (p->>'confirmed')::boolean is distinct from true then raise exception 'deadline_source_and_explicit_confirmation_required';end if;
  due:=lawroom_private.input_day(p->>'dueOn');if due<d.trigger_date then raise exception 'due_before_trigger';end if;
  if due is distinct from d.proposed_due_on and d.proposed_due_on is not null then perform lawroom_private.required_text(p->>'note',1000);end if;
  if d.source_event_id is not null and exists(select 1 from public.lr_events where corrects_event_id=d.source_event_id) then raise exception 'corrected_source_requires_new_proposal';end if;
  update public.lr_deadlines set status='verified',verified_due_on=due,verified_due_at=null,verified_by=auth.uid(),verified_at=now(),legal_basis=lawroom_private.required_text(p->>'legalBasis',1000),source_reference=lawroom_private.required_text(p->>'sourceReference',1000),rule_version=lawroom_private.required_text(p->>'ruleVersion',100),calculation=jsonb_build_object('verificationNote',left(p->>'note',1000),'lawyerConfirmed',true) where id=d.id;entity:=d.id;
 when 'resolve_deadline' then
  perform lawroom_private.validate_keys(p,array['id','status','note']);select * into d from public.lr_deadlines where id=(p->>'id')::uuid and matter_id=mid for update;
  if d.id is null or d.status in('met','waived') or p->>'status' not in('met','waived') or(p->>'status'='met' and d.status<>'verified') then raise exception 'invalid_deadline_resolution';end if;
  update public.lr_deadlines set status=p->>'status',resolution_note=lawroom_private.required_text(p->>'note',1000),resolved_at=now(),resolved_by=auth.uid() where id=d.id;entity:=d.id;
 when 'cancel_agenda' then
  perform lawroom_private.validate_keys(p,array['id','reason']);update public.lr_agenda_items set status='cancelled',cancellation_reason=lawroom_private.required_text(p->>'reason',1000) where id=(p->>'id')::uuid and matter_id=mid and status='planned' returning id into entity;
  if entity is null then raise exception 'planned_agenda_required';end if;
 when 'hearing_outcome' then
  perform lawroom_private.validate_keys(p,array['id','result','note','tasks','nextHearing','shared','clientSummary']);
  select * into a from public.lr_agenda_items where id=(p->>'id')::uuid and matter_id=mid and kind='hearing' and status='planned' for update;
  if a.id is null or a.all_day or a.starts_at>now() or p->>'result' not in('Ara karar','Ertelendi','Karar') then raise exception 'past_timed_hearing_required';end if;
  eid:=lawroom_private.insert_event(mid,jsonb_build_object('eventType','durusma_yapildi','title','Duruşma sonucu: '||(p->>'result'),'occurredOn',(a.starts_at at time zone 'Europe/Istanbul')::date,'note',lawroom_private.required_text(p->>'note',4000),'shared',coalesce((p->>'shared')::boolean,false),'clientSummary',p->>'clientSummary'));
  if jsonb_typeof(coalesce(p->'tasks','[]'))<>'array' or jsonb_array_length(coalesce(p->'tasks','[]'))>50 then raise exception 'invalid_tasks';end if;
  for item in select value from jsonb_array_elements(coalesce(p->'tasks','[]')) loop perform lawroom_private.insert_task(mid,item,eid);end loop;
  if p->'nextHearing' is not null and p->'nextHearing'<>'null'::jsonb then
   if lawroom_private.input_stamp(p->'nextHearing'->>'startsAt')<=now() then raise exception 'future_next_hearing_required';end if;
   perform lawroom_private.insert_agenda(mid,p->'nextHearing'||jsonb_build_object('kind','hearing'));
  end if;
  update public.lr_agenda_items set status='done',outcome_event_id=eid where id=a.id;entity:=eid;
 when 'set_summary' then perform lawroom_private.validate_keys(p,array['summary']);update public.lr_matters set client_summary=lawroom_private.required_text(p->>'summary',4000) where id=mid;
 when 'finish_manual_target' then
  perform lawroom_private.validate_keys(p,array[]::text[]);if nullif(trim(m.next_action),'') is null then raise exception 'manual_target_required';end if;
  update public.lr_matters set next_action=null,target_date=null where id=mid;
 when 'set_sharing' then
  perform lawroom_private.validate_keys(p,array['shared']);
  if (p->>'shared')::boolean and not exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=mid and lawroom_private.accepted_client(mid,r.client_id)) then raise exception 'accepted_client_required';end if;
  update public.lr_matter_clients mc set shared=coalesce((p->>'shared')::boolean,false) and exists(select 1 from public.lr_relationships r where r.id=mc.relationship_id and lawroom_private.accepted_client(mid,r.client_id)) where matter_id=mid;
 when 'set_event_sharing' then
  perform lawroom_private.validate_keys(p,array['id','shared','clientSummary']);
  update public.lr_events set shared=coalesce((p->>'shared')::boolean,false),client_summary=case when (p->>'shared')::boolean then lawroom_private.required_text(p->>'clientSummary',1000) else client_summary end where id=(p->>'id')::uuid and matter_id=mid returning id into entity;
  if entity is null then raise exception 'case_event_required';end if;
 when 'archive' then
  perform lawroom_private.validate_keys(p,array['reason','closedOn']);
  if nullif(trim(m.next_action),'') is not null or exists(select 1 from public.lr_tasks where matter_id=mid and status in('open','review')) or exists(select 1 from public.lr_deadlines where matter_id=mid and status not in('met','waived')) or exists(select 1 from public.lr_agenda_items where matter_id=mid and status='planned') then raise exception 'open_work_prevents_archive';end if;
  update public.lr_matters set status='archived',archived_at=now(),closed_reason=lawroom_private.required_text(p->>'reason',1000),closed_on=lawroom_private.input_day(p->>'closedOn') where id=mid;
  update public.lr_matter_clients set shared=false where matter_id=mid;
 when 'reopen' then
  perform lawroom_private.validate_keys(p,array['reason']);if m.archived_at is null and m.status not in('closed','archived') then raise exception 'archived_matter_required';end if;
  perform lawroom_private.required_text(p->>'reason',1000);update public.lr_matters set status='active',archived_at=null,closed_on=null where id=mid;
 else raise exception 'unsupported_tracking_command';end case;
 update public.lr_matters set last_activity_at=now() where id=mid;
 perform lawroom_private.audit(mid,command,entity,jsonb_strip_nulls(jsonb_build_object('reason',p->>'reason','note',p->>'note')),key);return lawroom_private.internal_dto(mid);
end $$;

create function lawroom_private.bulk_tracking(ids uuid[],command text,p jsonb,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare mid uuid;uid uuid;result jsonb:='[]';firstid uuid;begin
 if ids is null or cardinality(ids) not between 1 and 500 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or array_position(ids,null) is not null then raise exception 'unique_case_selection_required';end if;
 if key is null then raise exception 'bulk_idempotency_key_required';end if;
 select min(x::text)::uuid into firstid from unnest(ids) x;
 -- Lock in canonical order, and check EVERY selected case before writing any.
 for mid in select x from unnest(ids) x order by x loop perform lawroom_private.require_writer(mid);perform 1 from public.lr_matters where id=mid for update;perform lawroom_private.require_writer(mid);end loop;
 if lawroom_private.replay(firstid,'bulk_'||command,key) then
  return jsonb_build_object('replayed',true);
 end if;
 if command='assign' then
  perform lawroom_private.validate_keys(p,array['assigneeId']);uid:=(p->>'assigneeId')::uuid;
  for mid in select x from unnest(ids) x loop if not lawroom_private.valid_assignee(mid,uid) then raise exception 'active_case_member_required_no_automatic_access_grant';end if;end loop;
  for mid in select x from unnest(ids) x loop
   update public.lr_matter_members set role='collaborator' where matter_id=mid and role='responsible';
   update public.lr_matter_members set role='responsible' where matter_id=mid and user_id=uid;
   update public.lr_matters set owner_id=uid where id=mid;
   perform lawroom_private.audit(mid,'responsible_changed',uid,jsonb_build_object('bulkKey',key));
   result:=result||jsonb_build_array(lawroom_private.internal_dto(mid));
  end loop;
 elsif command='archive' then
  for mid in select x from unnest(ids) x loop result:=result||jsonb_build_array(lawroom_private.tracking_command(mid,'archive',p));end loop;
 else raise exception 'unsupported_bulk_command';end if;
 perform lawroom_private.audit(firstid,'bulk_'||command,firstid,jsonb_build_object('ids',ids,'count',cardinality(ids)),key);return result;
end $$;

create function lawroom_private.import_tracking(org uuid,rows jsonb,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare batch uuid:=gen_random_uuid();item jsonb;mid uuid;n integer:=0;old public.lr_audit_events;begin
 if not lawroom_private.is_member(org) then raise exception 'organization_member_required' using errcode='42501';end if;
 if rows is null or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 500 or key is null then raise exception 'invalid_import_batch';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||key::text,0));
 select * into old from public.lr_audit_events a where a.actor_id=auth.uid() and a.command_key=key;
 if old.id is not null then
  if old.action<>'import_batch' or not exists(select 1 from public.lr_import_batches where id=old.entity_id and organization_id=org) then raise exception 'command_key_reused';end if;
  return jsonb_build_object('id',old.entity_id,'replayed',true);
 end if;
 insert into public.lr_import_batches(id,organization_id,actor_id,count) values(batch,org,auth.uid(),jsonb_array_length(rows));
 for item in select value from jsonb_array_elements(rows) loop
  if item ? 'organizationId' or coalesce(item->>'clientMode','none')<>'none' or item ?| array['clientId','partyName'] then raise exception 'imports_are_private_unlinked';end if;
  -- An unambiguous normalized number in this organization must be reviewed instead of silently duplicating it.
  if lawroom_private.normalized_number(item->>'number') is not null and exists(select 1 from public.lr_matter_numbers mn join public.lr_matters m on m.id=mn.matter_id where m.organization_id=org and mn.normalized=lawroom_private.normalized_number(item->>'number')) then raise exception 'duplicate_import_number';end if;
  mid:=((lawroom_private.create_tracking_matter(item||jsonb_build_object('organizationId',org),null))->'matter'->>'id')::uuid;
  n:=n+1;update public.lr_matters set import_batch_id=batch,import_row=n,import_revision=revision+1 where id=mid;
 end loop;
 perform lawroom_private.audit(null,'import_batch',batch,jsonb_build_object('organizationId',org,'count',n),key);return jsonb_build_object('id',batch,'count',n);
end $$;

create function lawroom_private.undo_tracking_import(batch uuid,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare b public.lr_import_batches;m public.lr_matters;old public.lr_audit_events;begin
 select * into b from public.lr_import_batches where id=batch and actor_id=auth.uid() for update;
 if b.id is null or not lawroom_private.is_member(b.organization_id) then raise exception 'own_import_required' using errcode='42501';end if;
 if key is null then raise exception 'undo_idempotency_key_required';end if;
 if lawroom_private.replay(null,'undo_import',key) then
  select * into old from public.lr_audit_events a where a.actor_id=auth.uid() and a.command_key=key;
  if old.entity_id is distinct from batch then raise exception 'command_key_reused';end if;
  return jsonb_build_object('id',batch,'replayed',true);
 end if;
 if b.undone_at is not null then raise exception 'batch_already_undone';end if;
 for m in select * from public.lr_matters where import_batch_id=batch order by id for update loop
  perform lawroom_private.require_writer(m.id);
  if m.revision is distinct from m.import_revision then raise exception 'changed_import_cannot_be_undone';end if;
 end loop;
 for m in select * from public.lr_matters where import_batch_id=batch loop
  update public.lr_tasks set status='cancelled',cancelled_at=now(),cancellation_reason='İçe aktarma geri alındı.' where matter_id=m.id and status in('open','review');
  update public.lr_matters set status='archived',archived_at=now(),closed_reason='İçe aktarma geri alındı.',closed_on=current_date where id=m.id;
  update public.lr_matter_clients set shared=false where matter_id=m.id;
  perform lawroom_private.audit(m.id,'import_row_archived',m.id,jsonb_build_object('batchId',batch));
 end loop;
 update public.lr_import_batches set undone_at=now() where id=batch;
 perform lawroom_private.audit(null,'undo_import',batch,jsonb_build_object('count',b.count),key);return jsonb_build_object('id',batch,'count',b.count);
end $$;

create function lawroom_private.validate_view_filters(f jsonb) returns void language plpgsql immutable set search_path='' as $$declare k text;begin
 perform lawroom_private.validate_keys(f,array['query','types','subtypes','stages','courts','responsibleIds','clientIds','statuses','attentionTiers','shared','unverified','groupBy','sortBy','density']);
 if length(f::text)>8000 then raise exception 'invalid_saved_view_filters';end if;
 foreach k in array array['types','subtypes','stages','courts','responsibleIds','clientIds','statuses','attentionTiers'] loop
  if f ? k then
   if jsonb_typeof(f->k)<>'array' or jsonb_array_length(f->k)>100 then raise exception 'invalid_saved_view_array';end if;
   if exists(select 1 from jsonb_array_elements(f->k) x where jsonb_typeof(x) not in('string','number') or length(x::text)>300) then raise exception 'invalid_saved_view_value';end if;
  end if;
 end loop;
 foreach k in array array['query','shared','unverified','groupBy','sortBy','density'] loop if f ? k and(jsonb_typeof(f->k)<>'string' or length(f->>k)>300) then raise exception 'invalid_saved_view_string';end if;end loop;
end $$;
create function lawroom_private.saved_view(command text,vid uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare v public.lr_saved_views;begin
 if not lawroom_private.has_role('lawyer') then raise exception 'lawyer_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'saved_views',0));
 if command='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'filters',filters,'sort',sort,'isDefault',is_default,'pinned',pinned,'deletedAt',deleted_at) order by created_at) from public.lr_saved_views where user_id=auth.uid()),'[]');end if;
 perform lawroom_private.validate_keys(p,array['name','filters','sort','isDefault','pinned']);
 if command='create' then vid:=gen_random_uuid();else
  select * into v from public.lr_saved_views where id=vid and user_id=auth.uid() for update;
  if v.id is null then raise exception 'own_saved_view_required' using errcode='42501';end if;
 end if;
 if command in('create','update') then
  perform lawroom_private.required_text(p->>'name',80);
  perform lawroom_private.validate_view_filters(coalesce(p->'filters','{}'));
  if coalesce((p->>'isDefault')::boolean,false) then update public.lr_saved_views set is_default=false where user_id=auth.uid() and deleted_at is null;end if;
  if command='create' then insert into public.lr_saved_views(id,user_id,name,filters,sort,is_default,pinned) values(vid,auth.uid(),trim(p->>'name'),coalesce(p->'filters','{}'),left(p->>'sort',80),coalesce((p->>'isDefault')::boolean,false),coalesce((p->>'pinned')::boolean,false));
  else update public.lr_saved_views set name=trim(p->>'name'),filters=coalesce(p->'filters','{}'),sort=left(p->>'sort',80),is_default=coalesce((p->>'isDefault')::boolean,false),pinned=coalesce((p->>'pinned')::boolean,false),updated_at=now() where id=vid and deleted_at is null;end if;
 elsif command='delete' then update public.lr_saved_views set deleted_at=now(),is_default=false,updated_at=now() where id=vid;
 elsif command='restore' then update public.lr_saved_views set deleted_at=null,is_default=false,updated_at=now() where id=vid;
 else raise exception 'unsupported_saved_view_command';end if;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'saved_view_'||command,'saved_view',vid);
 return jsonb_build_object('id',vid);
end $$;

create function lawroom_private.can_request_upload(tid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_tasks t where t.id=tid and t.kind='client_document_request' and t.status='open' and t.shared_with_client and t.requested_client_id=auth.uid() and lawroom_private.client_can_read(t.matter_id));
$$;
create function lawroom_private.reserve_tracking_document(mid uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare did uuid;vid uuid:=gen_random_uuid();ver integer;path text;org uuid;tid uuid;size bigint;name text;media text;writer boolean;begin
 writer:=lawroom_private.can_write(mid);tid:=nullif(p->>'requestTaskId','')::uuid;
 if not writer and not coalesce(lawroom_private.can_request_upload(tid),false) then raise exception 'document_upload_denied' using errcode='42501';end if;
 perform lawroom_private.validate_keys(p,array['documentId','name','mediaType','sizeBytes','sha256','category','sourceEventId','requestTaskId']);
 select organization_id into org from public.lr_matters where id=mid for update;
 writer:=lawroom_private.can_write(mid);
 if not writer and not coalesce(lawroom_private.can_request_upload(tid),false) then raise exception 'document_upload_denied' using errcode='42501';end if;
 if tid is not null and not exists(select 1 from public.lr_tasks where id=tid and matter_id=mid and kind='client_document_request' and status='open') then raise exception 'open_case_request_required';end if;
 if not writer and (p ? 'documentId' or p ? 'sourceEventId' or coalesce(p->>'category','diger')<>'diger') then raise exception 'client_request_metadata_only';end if;
 if nullif(p->>'sourceEventId','') is not null and not exists(select 1 from public.lr_events where id=(p->>'sourceEventId')::uuid and matter_id=mid) then raise exception 'case_event_required';end if;
 size:=(p->>'sizeBytes')::bigint;name:=lawroom_private.required_text(p->>'name',180);media:=p->>'mediaType';
 if size not between 1 and 20971520 or size is null or coalesce(p->>'sha256','')!~'^[a-f0-9]{64}$' or media is null or media not in('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream') then raise exception 'invalid_document_metadata';end if;
 did:=nullif(p->>'documentId','')::uuid;
 if did is not null then
  if not exists(select 1 from public.lr_documents where id=did and matter_id=mid and upload_status<>'archived') then raise exception 'case_document_required';end if;
  perform 1 from public.lr_documents where id=did for update;
  if exists(select 1 from public.lr_document_versions where document_id=did and upload_status='uploading') then raise exception 'finish_pending_version_first';end if;
  select coalesce(max(version),0)+1 into ver from public.lr_document_versions where document_id=did;
 else did:=gen_random_uuid();ver:=1;end if;
 path:=org::text||'/'||mid::text||'/'||did::text||'/'||ver::text||'-'||vid::text;
 if ver=1 then insert into public.lr_documents(id,matter_id,name,object_path,media_type,shared,uploaded_by,upload_status,size_bytes,category,source_event_id,request_task_id)
 values(did,mid,name,path,media,false,auth.uid(),'uploading',size,coalesce(p->>'category','diger'),nullif(p->>'sourceEventId','')::uuid,tid);end if;
 insert into public.lr_document_versions(id,document_id,version,object_path,sha256,size_bytes,media_type,uploaded_by) values(vid,did,ver,path,p->>'sha256',size,media,auth.uid());
 perform lawroom_private.audit(mid,'document_reserved',did,jsonb_build_object('versionId',vid));
 return jsonb_build_object('documentId',did,'versionId',vid,'objectPath',path,'bucket','lr-matter-files','sha256Verified',false);
end $$;
create function lawroom_private.finalize_tracking_document(vid uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare v public.lr_document_versions;d public.lr_documents;actual bigint;begin
 select * into v from public.lr_document_versions where id=vid;select * into d from public.lr_documents where id=v.document_id;
 perform 1 from public.lr_matters where id=d.matter_id for update;
 select * into v from public.lr_document_versions where id=vid for update;select * into d from public.lr_documents where id=v.document_id;
 if v.id is null or v.uploaded_by is distinct from auth.uid() or (not lawroom_private.can_write(d.matter_id) and not coalesce(lawroom_private.can_request_upload(d.request_task_id),false)) then raise exception 'document_finalize_denied' using errcode='42501';end if;
 if v.upload_status='ready' then return jsonb_build_object('id',vid,'sha256Verified',v.sha256_verified);end if;
 if v.upload_status<>'uploading' then raise exception 'pending_upload_required';end if;
 select (metadata->>'size')::bigint into actual from storage.objects where bucket_id='lr-matter-files' and name=v.object_path;
 if actual is null or actual<>v.size_bytes then raise exception 'storage_size_mismatch';end if;
 -- Client hash is a claim until a trusted byte-reading worker verifies it.
 update public.lr_document_versions set upload_status='ready',sha256_verified=false where id=vid;
 update public.lr_documents set upload_status='ready',object_path=v.object_path,size_bytes=v.size_bytes,media_type=v.media_type where id=d.id;
 if d.request_task_id is not null then update public.lr_tasks set status='review' where id=d.request_task_id and status='open';end if;
 perform lawroom_private.audit(d.matter_id,'document_finalized',d.id,jsonb_build_object('versionId',vid,'sha256Verified',false));
 return jsonb_build_object('id',vid,'sha256Verified',false);
end $$;
create or replace function lawroom_private.can_download_document(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_document_versions v join public.lr_documents d on d.id=v.document_id where v.object_path=path and v.upload_status='ready' and d.upload_status='ready' and
 (lawroom_private.can_view_internal(d.matter_id) or(d.shared and lawroom_private.client_can_read(d.matter_id))));
$$;
create or replace function lawroom_private.can_upload_document(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_document_versions v join public.lr_documents d on d.id=v.document_id where v.object_path=path and v.upload_status='uploading' and v.uploaded_by=auth.uid() and
 (lawroom_private.can_write(d.matter_id) or lawroom_private.can_request_upload(d.request_task_id)));
$$;
create function lawroom_private.tracking_document_path(vid uuid) returns text language plpgsql stable security definer set search_path='' as $$declare path text;begin
 select object_path into path from public.lr_document_versions where id=vid;
 if not coalesce(lawroom_private.can_download_document(path),false) then raise exception 'document_download_denied' using errcode='42501';end if;return path;
end $$;
-- Old reservation RPC does not create a version and must stay closed after cutover.
create or replace function lawroom_private.reserve_document(p_matter uuid,p_name text,p_media_type text,p_size bigint) returns jsonb language plpgsql security definer set search_path='' as $$begin raise exception 'use_versioned_tracking_reservation';end $$;
create or replace function lawroom_private.finalize_document(p_document uuid) returns void language plpgsql security definer set search_path='' as $$begin raise exception 'use_versioned_tracking_finalize';end $$;
create or replace function lawroom_private.document_download_path(p_document uuid) returns text language plpgsql stable security definer set search_path='' as $$declare path text;begin
 select v.object_path into path from public.lr_document_versions v where v.document_id=p_document and v.upload_status='ready' order by version desc limit 1;
 if not coalesce(lawroom_private.can_download_document(path),false) then raise exception 'document_download_denied' using errcode='42501';end if;return path;
end $$;
create function lawroom_private.client_message(mid uuid,body text,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare eid uuid:=gen_random_uuid();begin
 if not lawroom_private.client_can_read(mid) then raise exception 'shared_client_required' using errcode='42501';end if;
 if not lawroom_private.replay(mid,'client_message',key) then
  insert into public.lr_messages(id,matter_id,sender_id,body) values(eid,mid,auth.uid(),lawroom_private.required_text(body,8000));perform lawroom_private.audit(mid,'client_message',eid,'{}',key);
 end if;return lawroom_private.client_dto(mid);
end $$;

create function lawroom_private.link_tracking(mid uuid,other uuid,kind text,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare org uuid;begin
 perform lawroom_private.require_writer(mid);perform lawroom_private.require_writer(other);
 if mid=other or kind not in('derived_from','enforcement_of','appeal_of','related') then raise exception 'invalid_case_link';end if;
 perform 1 from public.lr_matters where id in(mid,other) order by id for update;
 perform lawroom_private.require_writer(mid);perform lawroom_private.require_writer(other);
 select organization_id into org from public.lr_matters where id=mid;
 if not exists(select 1 from public.lr_matters where id=other and organization_id=org) then raise exception 'cross_organization_link_forbidden';end if;
 if not lawroom_private.replay(mid,'link_matter',key) then
  insert into public.lr_matter_links values(mid,other,org,kind);
  -- A single directed edge is projected into both dossiers by the DTO.
  update public.lr_matters set last_activity_at=now() where id in(mid,other);
  perform lawroom_private.audit(mid,'link_matter',other,jsonb_build_object('kind',kind),key);
  perform lawroom_private.audit(other,'linked_from',mid,jsonb_build_object('kind',kind));
 end if;return lawroom_private.internal_dto(mid);
end $$;
create function lawroom_private.derive_tracking(mid uuid,p jsonb,kind text,key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare other uuid;org uuid;old public.lr_audit_events;begin
 perform lawroom_private.require_writer(mid);perform 1 from public.lr_matters where id=mid for update;
 if lawroom_private.replay(mid,'derive_matter',key) then
  select * into old from public.lr_audit_events a where a.actor_id=auth.uid() and a.command_key=key;
  return lawroom_private.internal_dto(old.entity_id);
 end if;
 select organization_id into org from public.lr_matters where id=mid;
 if p ?| array['organizationId','clientId','partyName'] or coalesce(p->>'clientMode','none')<>'none' then raise exception 'derived_case_is_private_unlinked';end if;
 other:=(lawroom_private.create_tracking_matter(p||jsonb_build_object('organizationId',org))->'matter'->>'id')::uuid;
 perform lawroom_private.link_tracking(mid,other,kind,null);
 perform lawroom_private.audit(mid,'derive_matter',other,'{}',key);return lawroom_private.internal_dto(other);
end $$;
create or replace function lawroom_private.share_document(p_document uuid,p_shared boolean) returns void language plpgsql security definer set search_path='' as $$declare mid uuid;begin
 select matter_id into mid from public.lr_documents where id=p_document;perform 1 from public.lr_matters where id=mid for update;perform lawroom_private.require_writer(mid);
 if p_shared and not exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=mid and lawroom_private.accepted_client(mid,r.client_id)) then raise exception 'accepted_client_required';end if;
 update public.lr_documents set shared=coalesce(p_shared,false) where id=p_document;
 perform lawroom_private.audit(mid,'document_sharing',p_document,jsonb_build_object('shared',coalesce(p_shared,false)));
end $$;
create or replace function lawroom_private.share_matter(p_matter uuid,p_relationship uuid,p_shared boolean) returns void language plpgsql security definer set search_path='' as $$declare r public.lr_relationships;begin
 perform 1 from public.lr_matters where id=p_matter for update;perform lawroom_private.require_writer(p_matter);select * into r from public.lr_relationships where id=p_relationship;
 if not exists(select 1 from public.lr_matter_clients where matter_id=p_matter and relationship_id=p_relationship) or (p_shared and not lawroom_private.accepted_client(p_matter,r.client_id)) then raise exception 'accepted_case_client_required';end if;
 update public.lr_matter_clients set shared=coalesce(p_shared,false) where matter_id=p_matter and relationship_id=p_relationship;
 update public.lr_matters set last_activity_at=now() where id=p_matter;
 perform lawroom_private.audit(p_matter,'matter_sharing',p_matter,jsonb_build_object('shared',coalesce(p_shared,false)));
end $$;
create or replace function lawroom_private.notification_allowed(recipient uuid,mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_accounts a where a.user_id=recipient and a.status='active' and a.role in('lawyer','client') and (mid is null or exists(
 select 1 from public.lr_matters m join public.lr_organizations o on o.id=m.organization_id and o.status='active' where m.id=mid and m.archived_at is null and m.status in('active','on_hold') and(
 (a.role='lawyer' and exists(select 1 from public.lr_matter_members mm join public.lr_memberships mem on mem.organization_id=mm.organization_id and mem.user_id=mm.user_id and mem.active where mm.matter_id=mid and mm.user_id=recipient and mm.role in('responsible','collaborator'))) or
 (a.role='client' and exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=mid and mc.shared and r.client_id=recipient and r.status='accepted' and lawroom_private.accepted_client(mid,recipient)))))));
$$;
create function lawroom_private.tracking_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not lawroom_private.has_role('lawyer') then raise exception 'lawyer_required' using errcode='42501';end if;
 return jsonb_build_object('templates',(select jsonb_agg(snapshot order by key,version) from public.lr_stage_templates),'eventTypes',(select jsonb_agg(definition order by key) from public.lr_event_types),'approvedDeadlineRules','[]'::jsonb,'holidayCalendarComplete',false);
end $$;

-- Versioned unverified UI catalogs only; no legal rule or holiday certification.
insert into public.lr_stage_templates values('icra','draft-2026-11-01','{"key":"icra","label":"İcra","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["İlamsız takip","İlamlı takip","Kambiyo","Kira / tahliye","Rehin"],"stages":[{"key":"hazirlik","label":"Hazırlık","clientLabel":"Takibe hazırlanılıyor"},{"key":"takip","label":"Takip açıldı","clientLabel":"Takip başlatıldı"},{"key":"tebligat","label":"Ödeme emri / tebligat","clientLabel":"Resmî bildirim aşaması"},{"key":"itiraz","label":"İtiraz süreci","clientLabel":"İtirazlar değerlendiriliyor"},{"key":"kesinlesme","label":"Kesinleşme","clientLabel":"Takibin durumu kontrol ediliyor"},{"key":"haciz","label":"Haciz","clientLabel":"Tahsilat işlemleri izleniyor"},{"key":"satis","label":"Satış","clientLabel":"Satış işlemleri izleniyor"},{"key":"tahsilat","label":"Tahsilat","clientLabel":"Ödeme durumu izleniyor"},{"key":"kapanis","label":"Kapanış","clientLabel":"Takip tamamlanıyor"}]}'::jsonb);
insert into public.lr_stage_templates values('aile','draft-2026-11-01','{"key":"aile","label":"Aile","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Anlaşmalı boşanma","Çekişmeli boşanma","Velayet","Nafaka","Mal rejimi","Koruma tedbiri"],"stages":[{"key":"hazirlik","label":"Hazırlık","clientLabel":"Dosya hazırlanıyor"},{"key":"dava","label":"Dava açıldı","clientLabel":"Süreç başlatıldı"},{"key":"dilekceler","label":"Dilekçeler","clientLabel":"Yazılı açıklamalar sunuluyor"},{"key":"on_inceleme","label":"Ön inceleme","clientLabel":"İlk inceleme yapılıyor"},{"key":"tahkikat","label":"Tahkikat","clientLabel":"Deliller değerlendiriliyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"},{"key":"kanun_yolu","label":"Kanun yolu","clientLabel":"Kararın incelenmesi izleniyor"},{"key":"kesinlesme","label":"Kesinleşme","clientLabel":"Kararın son durumu kontrol ediliyor"}]}'::jsonb);
insert into public.lr_stage_templates values('is','draft-2026-11-01','{"key":"is","label":"İş","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["İşe iade","İşçilik alacağı","İş kazası"],"stages":[{"key":"arabuluculuk","label":"Arabuluculuk","clientLabel":"Uzlaşma görüşmeleri izleniyor"},{"key":"dava","label":"Dava açıldı","clientLabel":"Süreç başlatıldı"},{"key":"dilekceler","label":"Dilekçeler","clientLabel":"Yazılı açıklamalar sunuluyor"},{"key":"on_inceleme","label":"Ön inceleme","clientLabel":"İlk inceleme yapılıyor"},{"key":"tahkikat","label":"Tahkikat / bilirkişi","clientLabel":"Deliller değerlendiriliyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"},{"key":"kanun_yolu","label":"Kanun yolu","clientLabel":"Kararın incelenmesi izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('idari_vergi','draft-2026-11-01','{"key":"idari_vergi","label":"İdari / Vergi","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["İptal","Tam yargı","Vergi"],"stages":[{"key":"islem","label":"İşlem / öğrenme","clientLabel":"İşlem bilgileri inceleniyor"},{"key":"on_basvuru","label":"Ön başvuru","clientLabel":"Başvuru gereksinimi inceleniyor"},{"key":"dava","label":"Dava açıldı","clientLabel":"Süreç başlatıldı"},{"key":"yd","label":"Yürütmenin durdurulması talebi","clientLabel":"Geçici koruma talebi izleniyor"},{"key":"savunmalar","label":"Savunmalar","clientLabel":"Yazılı açıklamalar değerlendiriliyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"},{"key":"kanun_yolu","label":"Kanun yolu","clientLabel":"Kararın incelenmesi izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('ceza','draft-2026-11-01','{"key":"ceza","label":"Ceza","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Soruşturma","Kovuşturma"],"stages":[{"key":"sorusturma","label":"Soruşturma","clientLabel":"İlk inceleme süreci izleniyor"},{"key":"iddianame","label":"İddianame / KYOK","clientLabel":"Soruşturma sonucu izleniyor"},{"key":"kovusturma","label":"Kovuşturma","clientLabel":"Mahkeme süreci izleniyor"},{"key":"durusmalar","label":"Duruşmalar","clientLabel":"Duruşmalar takip ediliyor"},{"key":"hukum","label":"Hüküm","clientLabel":"Karar aşaması izleniyor"},{"key":"kanun_yolu","label":"Kanun yolu","clientLabel":"Kararın incelenmesi izleniyor"},{"key":"infaz","label":"İnfaz","clientLabel":"Kararın uygulanması izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('ticaret','draft-2026-11-01','{"key":"ticaret","label":"Ticaret","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Alacak","Şirketler","Haksız rekabet"],"stages":[{"key":"arabuluculuk","label":"Arabuluculuk","clientLabel":"Uzlaşma görüşmeleri izleniyor"},{"key":"dava","label":"Dava","clientLabel":"Mahkeme süreci izleniyor"},{"key":"dilekceler","label":"Dilekçeler","clientLabel":"Yazılı açıklamalar sunuluyor"},{"key":"on_inceleme","label":"Ön inceleme","clientLabel":"İlk inceleme yapılıyor"},{"key":"tahkikat","label":"Tahkikat","clientLabel":"Deliller değerlendiriliyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"},{"key":"kanun_yolu","label":"Kanun yolu","clientLabel":"Kararın incelenmesi izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('tuketici','draft-2026-11-01','{"key":"tuketici","label":"Tüketici","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Ayıplı mal / hizmet","Hakem heyeti"],"stages":[{"key":"basvuru","label":"Hakem heyeti / arabuluculuk","clientLabel":"Başvuru ve görüşmeler izleniyor"},{"key":"dava","label":"Dava","clientLabel":"Mahkeme süreci izleniyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('miras','draft-2026-11-01','{"key":"miras","label":"Miras","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Mirasçılık belgesi","Tenkis","Ortaklığın giderilmesi"],"stages":[{"key":"hazirlik","label":"Hazırlık","clientLabel":"Dosya hazırlanıyor"},{"key":"dava","label":"Dava","clientLabel":"Mahkeme süreci izleniyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"},{"key":"paylastirma","label":"Satış / paylaştırma","clientLabel":"Paylaşım işlemleri izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('gayrimenkul','draft-2026-11-01','{"key":"gayrimenkul","label":"Gayrimenkul","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Tapu iptal / tescil","Kira tespit","Tahliye","Kamulaştırma"],"stages":[{"key":"hazirlik","label":"Hazırlık","clientLabel":"Dosya hazırlanıyor"},{"key":"dava","label":"Dava","clientLabel":"Mahkeme süreci izleniyor"},{"key":"kesif","label":"Keşif","clientLabel":"Yerinde inceleme izleniyor"},{"key":"bilirkisi","label":"Bilirkişi","clientLabel":"Uzman incelemesi izleniyor"},{"key":"karar","label":"Karar","clientLabel":"Karar aşaması izleniyor"},{"key":"kanun_yolu","label":"Kanun yolu","clientLabel":"Kararın incelenmesi izleniyor"}]}'::jsonb);
insert into public.lr_stage_templates values('arabuluculuk','draft-2026-11-01','{"key":"arabuluculuk","label":"Arabuluculuk","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Dava şartı","İhtiyari"],"stages":[{"key":"basvuru","label":"Başvuru","clientLabel":"Başvuru yapılıyor"},{"key":"toplantilar","label":"Toplantılar","clientLabel":"Görüşmeler sürüyor"},{"key":"sonuc","label":"Anlaşma / anlaşamama","clientLabel":"Görüşme sonucu kaydediliyor"}]}'::jsonb);
insert into public.lr_stage_templates values('danismanlik','draft-2026-11-01','{"key":"danismanlik","label":"Danışmanlık","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Sözleşme","Görüş","Uyum"],"stages":[{"key":"talep","label":"Talep","clientLabel":"Talebiniz alındı"},{"key":"inceleme","label":"İnceleme","clientLabel":"Talebiniz inceleniyor"},{"key":"taslak","label":"Taslak","clientLabel":"Çalışma hazırlanıyor"},{"key":"teslim","label":"Teslim","clientLabel":"Çalışma paylaşılıyor"},{"key":"kapanis","label":"Kapanış","clientLabel":"Çalışma tamamlanıyor"}]}'::jsonb);
insert into public.lr_stage_templates values('diger','draft-2026-11-01','{"key":"diger","label":"Diğer","version":"draft-2026-11-01","unverified":true,"verifiedByLawyer":false,"notice":"Doğrulanmamış örnek. Hukukçu incelemesi olmadan kesin prosedür olarak kullanılmaz.","subtypes":["Serbest"],"stages":[{"key":"hazirlik","label":"Hazırlık","clientLabel":"Dosya hazırlanıyor"},{"key":"takip","label":"Takip","clientLabel":"Gelişmeler izleniyor"},{"key":"kapanis","label":"Kapanış","clientLabel":"Dosya tamamlanıyor"}]}'::jsonb);
insert into public.lr_event_types values('dava_acildi','{"key":"dava_acildi","label":"Dava açıldı","clientLabel":"Mahkeme süreci başlatıldı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('takip_baslatildi','{"key":"takip_baslatildi","label":"Takip başlatıldı","clientLabel":"Takip süreci başlatıldı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('dilekce_verildi','{"key":"dilekce_verildi","label":"Dilekçe verildi","clientLabel":"Yazılı açıklama sunuldu","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('dilekce_alindi','{"key":"dilekce_alindi","label":"Dilekçe alındı","clientLabel":"Yeni yazılı açıklama geldi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('tebligat_yapildi','{"key":"tebligat_yapildi","label":"Tebligat yapıldı","clientLabel":"Resmî bildirim yapıldı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","served_on","service_method","source_document"]}'::jsonb);
insert into public.lr_event_types values('tebligat_alindi','{"key":"tebligat_alindi","label":"Tebligat alındı","clientLabel":"Resmî bildirim ulaştı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","served_on","service_method","source_document"]}'::jsonb);
insert into public.lr_event_types values('durusma_yapildi','{"key":"durusma_yapildi","label":"Duruşma yapıldı","clientLabel":"Duruşma gerçekleşti","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('ara_karar','{"key":"ara_karar","label":"Ara karar","clientLabel":"Yeni takip adımları belirlendi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('bilirkisi_raporu','{"key":"bilirkisi_raporu","label":"Bilirkişi raporu","clientLabel":"Uzman raporu geldi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('kesif_yapildi','{"key":"kesif_yapildi","label":"Keşif yapıldı","clientLabel":"Yerinde inceleme yapıldı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('tanik_dinlendi','{"key":"tanik_dinlendi","label":"Tanık dinlendi","clientLabel":"Tanık açıklaması alındı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('karar_verildi','{"key":"karar_verildi","label":"Karar verildi","clientLabel":"Karar verildi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('karar_teblig','{"key":"karar_teblig","label":"Karar tebliğ edildi","clientLabel":"Karara ilişkin resmî bildirim ulaştı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","served_on","service_method","source_document"]}'::jsonb);
insert into public.lr_event_types values('kanun_yolu_basvurusu','{"key":"kanun_yolu_basvurusu","label":"Kanun yolu başvurusu","clientLabel":"Kararın incelenmesi istendi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('itiraz','{"key":"itiraz","label":"İtiraz","clientLabel":"İtiraz kaydedildi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('kesinlesme','{"key":"kesinlesme","label":"Kesinleşme","clientLabel":"Kararın son durumu kaydedildi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('haciz','{"key":"haciz","label":"Haciz","clientLabel":"Tahsilat işlemine ilişkin gelişme","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('satis','{"key":"satis","label":"Satış","clientLabel":"Satış işlemine ilişkin gelişme","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('tahsilat','{"key":"tahsilat","label":"Tahsilat","clientLabel":"Ödemeye ilişkin gelişme","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('arabuluculuk_toplantisi','{"key":"arabuluculuk_toplantisi","label":"Arabuluculuk toplantısı","clientLabel":"Uzlaşma görüşmesi yapıldı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('anlasma','{"key":"anlasma","label":"Anlaşma","clientLabel":"Anlaşma kaydedildi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('belge_eklendi','{"key":"belge_eklendi","label":"Belge eklendi","clientLabel":"Yeni belge eklendi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('muvekkil_gorusmesi','{"key":"muvekkil_gorusmesi","label":"Müvekkil görüşmesi","clientLabel":"Görüşme yapıldı","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
insert into public.lr_event_types values('diger','{"key":"diger","label":"Diğer","clientLabel":"Yeni gelişme kaydedildi","version":"draft-2026-11-01","unverified":true,"defaultShared":false,"fields":["occurred_on","source_document"]}'::jsonb);
-- Legacy references keep the original bytes; unknown kinds remain 'diger'.
insert into public.lr_matter_numbers(matter_id,kind,value,normalized,authority,is_primary,created_at) select id,'diger',reference,coalesce(lawroom_private.normalized_number(reference),''),court,true,created_at from public.lr_matters where nullif(trim(reference),'') is not null;
-- Only exact known type/key matches receive an explicitly unverified snapshot.
update public.lr_matters m set template_key=t.key,template_version=t.version,template_snapshot=t.snapshot,stage_key=(select s->>'key' from jsonb_array_elements(t.snapshot->'stages') s where s->>'key'=m.stage or s->>'label'=m.stage limit 1) from public.lr_stage_templates t where lower(trim(m.matter_type)) in(lower(t.key),lower(t.snapshot->>'label'));
alter table public.lr_events add constraint lr_event_type_catalog foreign key(event_type) references public.lr_event_types(key);

-- Invoker facade; callers never choose an actor or a DTO audience.
create function public.lr_get_tracking_matter(p_matter uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.get_tracking_matter(p_matter)$$;
create function public.lr_list_tracking_matters() returns setof jsonb language sql security invoker set search_path='' as $$select * from lawroom_private.list_tracking_matters()$$;
create function public.lr_tracking_catalog() returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.tracking_catalog()$$;
create function public.lr_create_tracking_matter(p_payload jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.create_tracking_matter(p_payload,p_key)$$;
create function public.lr_tracking_command(p_matter uuid,p_command text,p_payload jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.tracking_command(p_matter,p_command,p_payload,p_key)$$;
create function public.lr_add_proceeding(p_matter uuid,p_event jsonb,p_tasks jsonb,p_deadlines jsonb,p_agenda jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.add_proceeding(p_matter,p_event,p_tasks,p_deadlines,p_agenda,p_key)$$;
create function public.lr_bulk_tracking(p_matters uuid[],p_command text,p_payload jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.bulk_tracking(p_matters,p_command,p_payload,p_key)$$;
create function public.lr_import_tracking(p_organization uuid,p_rows jsonb,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.import_tracking(p_organization,p_rows,p_key)$$;
create function public.lr_undo_tracking_import(p_batch uuid,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.undo_tracking_import(p_batch,p_key)$$;
create function public.lr_saved_view(p_command text,p_id uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.saved_view(p_command,p_id,p_payload)$$;
create function public.lr_reserve_tracking_document(p_matter uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.reserve_tracking_document(p_matter,p_payload)$$;
create function public.lr_finalize_tracking_document(p_version uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.finalize_tracking_document(p_version)$$;
create function public.lr_tracking_document_path(p_version uuid) returns text language sql security invoker set search_path='' as $$select lawroom_private.tracking_document_path(p_version)$$;
create function public.lr_client_message(p_matter uuid,p_body text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.client_message(p_matter,p_body,p_key)$$;
create function public.lr_link_tracking(p_matter uuid,p_other uuid,p_kind text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.link_tracking(p_matter,p_other,p_kind,p_key)$$;
create function public.lr_derive_tracking(p_matter uuid,p_payload jsonb,p_kind text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.derive_tracking(p_matter,p_payload,p_kind,p_key)$$;
create function public.lr_create_matter(p jsonb,p_key uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.create_tracking_matter(p,p_key)$$;
create function public.lr_record_hearing_outcome(p_matter uuid,p_payload jsonb,p_key uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.tracking_command(p_matter,'hearing_outcome',p_payload,p_key)$$;
create function public.lr_verify_deadline(p_matter uuid,p_payload jsonb,p_key uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.tracking_command(p_matter,'verify_deadline',p_payload,p_key)$$;
create function public.lr_change_stage(p_matter uuid,p_stage text,p_note text,p_key uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.tracking_command(p_matter,'change_stage',jsonb_build_object('stageKey',p_stage,'note',p_note),p_key)$$;
create function public.lr_close_matter(p_matter uuid,p_reason text,p_closed_on date,p_key uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path='' as $$select lawroom_private.tracking_command(p_matter,'archive',jsonb_build_object('reason',p_reason,'closedOn',p_closed_on),p_key)$$;
create view public.lr_matter_cockpit with(security_invoker=true) as select dto->'matter' as matter from public.lr_list_tracking_matters() dto where dto->>'audience'='lawyer';
revoke all on public.lr_matter_cockpit from public,anon,authenticated;grant select on public.lr_matter_cockpit to authenticated;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='lawroom_private' or(n.nspname='public' and p.proname like 'lr\_%' escape '\') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);end loop;end $$;
grant execute on function lawroom_private.has_role(text) to authenticated;
grant execute on function lawroom_private.is_member(uuid) to authenticated;
grant execute on function lawroom_private.can_read(uuid) to authenticated;
grant execute on function lawroom_private.can_write(uuid) to authenticated;
grant execute on function lawroom_private.can_view_internal(uuid) to authenticated;
grant execute on function lawroom_private.client_can_read(uuid) to authenticated;
grant execute on function lawroom_private.can_download_document(text) to authenticated;
grant execute on function lawroom_private.can_upload_document(text) to authenticated;
grant execute on function public.lr_get_tracking_matter(uuid),lawroom_private.get_tracking_matter(uuid) to authenticated;
grant execute on function public.lr_list_tracking_matters(),lawroom_private.list_tracking_matters() to authenticated;
grant execute on function public.lr_tracking_catalog(),lawroom_private.tracking_catalog() to authenticated;
grant execute on function public.lr_create_tracking_matter(jsonb,uuid),lawroom_private.create_tracking_matter(jsonb,uuid) to authenticated;
grant execute on function public.lr_tracking_command(uuid,text,jsonb,uuid),lawroom_private.tracking_command(uuid,text,jsonb,uuid) to authenticated;
grant execute on function public.lr_add_proceeding(uuid,jsonb,jsonb,jsonb,jsonb,uuid),lawroom_private.add_proceeding(uuid,jsonb,jsonb,jsonb,jsonb,uuid) to authenticated;
grant execute on function public.lr_bulk_tracking(uuid[],text,jsonb,uuid),lawroom_private.bulk_tracking(uuid[],text,jsonb,uuid) to authenticated;
grant execute on function public.lr_import_tracking(uuid,jsonb,uuid),lawroom_private.import_tracking(uuid,jsonb,uuid) to authenticated;
grant execute on function public.lr_undo_tracking_import(uuid,uuid),lawroom_private.undo_tracking_import(uuid,uuid) to authenticated;
grant execute on function public.lr_saved_view(text,uuid,jsonb),lawroom_private.saved_view(text,uuid,jsonb) to authenticated;
grant execute on function public.lr_reserve_tracking_document(uuid,jsonb),lawroom_private.reserve_tracking_document(uuid,jsonb) to authenticated;
grant execute on function public.lr_finalize_tracking_document(uuid),lawroom_private.finalize_tracking_document(uuid) to authenticated;
grant execute on function public.lr_tracking_document_path(uuid),lawroom_private.tracking_document_path(uuid) to authenticated;
grant execute on function public.lr_client_message(uuid,text,uuid),lawroom_private.client_message(uuid,text,uuid) to authenticated;
grant execute on function public.lr_link_tracking(uuid,uuid,text,uuid),lawroom_private.link_tracking(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.lr_derive_tracking(uuid,jsonb,text,uuid),lawroom_private.derive_tracking(uuid,jsonb,text,uuid) to authenticated;
grant execute on function public.lr_create_matter(jsonb,uuid) to authenticated;
grant execute on function public.lr_record_hearing_outcome(uuid,jsonb,uuid) to authenticated;
grant execute on function public.lr_verify_deadline(uuid,jsonb,uuid) to authenticated;
grant execute on function public.lr_change_stage(uuid,text,text,uuid) to authenticated;
grant execute on function public.lr_close_matter(uuid,text,date,uuid) to authenticated;
grant execute on function public.lr_submit_application(text,text,text,text,text),lawroom_private.submit_application(text,text,text,text,text) to authenticated;
grant execute on function public.lr_review_application(uuid,boolean,text),lawroom_private.review_application(uuid,boolean,text) to authenticated;
grant execute on function public.lr_assignable_lawyers(),lawroom_private.assignable_lawyers() to authenticated;
grant execute on function public.lr_assign_client(uuid,uuid),lawroom_private.assign_client(uuid,uuid) to authenticated;
grant execute on function public.lr_review_relationship(uuid,boolean),lawroom_private.review_relationship(uuid,boolean) to authenticated;
grant execute on function public.lr_share_document(uuid,boolean),lawroom_private.share_document(uuid,boolean) to authenticated;
grant execute on function public.lr_document_download_path(uuid),lawroom_private.document_download_path(uuid) to authenticated;
grant execute on function public.lr_list_clients(),lawroom_private.list_clients() to authenticated;
grant execute on function public.lr_share_matter(uuid,uuid,boolean),lawroom_private.share_matter(uuid,uuid,boolean) to authenticated;
-- Worker grants remain service_role-only; no worker/SMTP/Realtime is enabled here.
do $$declare s record;begin for s in select c.oid::regclass as object from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and c.relname like 'lr\_%' escape '\' loop execute format('revoke all on sequence %s from public,anon,authenticated',s.object);end loop;end $$;
commit;
