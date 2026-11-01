-- Incremental migration: foundation.sql is already present in production.
begin;
alter table public.lr_applications add column reviewed_by uuid references public.lr_accounts(user_id), add column reviewed_at timestamptz, add column review_reason text;
create unique index lr_application_one_per_user on public.lr_applications(applicant_id);
revoke insert on public.lr_applications from authenticated;

create table public.lr_referral_codes (
 lawyer_id uuid primary key references public.lr_accounts(user_id),
 code text not null unique default ('LR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
);
alter table public.lr_referral_codes enable row level security;
revoke all on public.lr_referral_codes from public,anon,authenticated;
grant select on public.lr_referral_codes to authenticated;
create policy referral_self on public.lr_referral_codes for select to authenticated using(lawyer_id=(select auth.uid()) and lawroom_private.has_role('lawyer'));
insert into public.lr_referral_codes(lawyer_id) select user_id from public.lr_accounts where role='lawyer' and status='active';

create function lawroom_private.submit_application(p_kind text,p_display_name text,p_bar_number text,p_organization_name text,p_referral_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); aid uuid; lawyer uuid; org uuid;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'verified_session_required' using errcode='42501'; end if;
 if p_kind not in ('lawyer','firm','client') or length(trim(p_display_name)) not between 1 and 120 then raise exception 'invalid_application'; end if;
 if p_kind in ('lawyer','firm') and coalesce(length(trim(p_bar_number)),0) not between 1 and 120 then raise exception 'bar_number_required'; end if;
 if p_kind='firm' and coalesce(length(trim(p_organization_name)),0) not between 1 and 160 then raise exception 'organization_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if exists(select 1 from public.lr_accounts where user_id=uid and status in ('active','suspended')) or exists(select 1 from public.lr_applications where applicant_id=uid) then raise exception 'application_already_exists'; end if;
 if p_referral_code is not null then
  if p_kind<>'client' then raise exception 'referral_client_only'; end if;
  select c.lawyer_id,m.organization_id into lawyer,org from public.lr_referral_codes c join public.lr_accounts a on a.user_id=c.lawyer_id join public.lr_memberships m on m.user_id=a.user_id and m.active join public.lr_organizations o on o.id=m.organization_id and o.status='active' where c.code=upper(trim(p_referral_code)) and a.role='lawyer' and a.status='active' order by m.organization_id limit 1;
  if lawyer is null then raise exception 'invalid_referral_code'; end if;
 end if;
 insert into public.lr_accounts(user_id,display_name,role,status) values(uid,trim(p_display_name),case when p_kind='client' then 'client' else 'lawyer' end,'pending');
 insert into public.lr_applications(applicant_id,kind,display_name,bar_number,organization_name,referred_lawyer_id) values(uid,p_kind,trim(p_display_name),nullif(trim(p_bar_number),''),nullif(trim(p_organization_name),''),lawyer) returning id into aid;
 if lawyer is not null then insert into public.lr_relationships(organization_id,lawyer_id,client_id) values(org,lawyer,uid); end if;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(uid,'application.submitted','application',aid);
 return aid;
end $$;
create function public.lr_submit_application(p_kind text,p_display_name text,p_bar_number text default null,p_organization_name text default null,p_referral_code text default null) returns uuid
language sql security invoker set search_path='' as $$ select lawroom_private.submit_application(p_kind,p_display_name,p_bar_number,p_organization_name,p_referral_code) $$;

create function lawroom_private.review_application(p_application uuid,p_approve boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.lr_applications; org uuid;
begin
 if not lawroom_private.has_role('admin') then raise exception 'admin_required' using errcode='42501'; end if;
 select * into a from public.lr_applications where id=p_application for update;
 if a.id is null or a.status<>'pending' or a.kind='client' then raise exception 'pending_professional_application_required'; end if;
 if not p_approve and coalesce(length(trim(p_reason)),0)=0 then raise exception 'reason_required'; end if;
 if p_approve then
  update public.lr_accounts set role='lawyer',status='active' where user_id=a.applicant_id and status='pending';
  if not found then raise exception 'pending_account_required'; end if;
  insert into public.lr_organizations(name,kind,status) values(case when a.kind='firm' then a.organization_name else a.display_name end,case when a.kind='firm' then 'firm' else 'individual' end,'active') returning id into org;
  insert into public.lr_memberships(organization_id,user_id,role,active) values(org,a.applicant_id,'owner',true);
  insert into public.lr_referral_codes(lawyer_id) values(a.applicant_id) on conflict do nothing;
 end if;
 update public.lr_applications set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=p_reason where id=a.id;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),case when p_approve then 'application.approved' else 'application.rejected' end,'application',a.id);
end $$;
create function public.lr_review_application(p_application uuid,p_approve boolean,p_reason text default null) returns void language sql security invoker set search_path='' as $$ select lawroom_private.review_application(p_application,p_approve,p_reason) $$;

create function lawroom_private.assignable_lawyers() returns table(user_id uuid,display_name text)
language plpgsql stable security definer set search_path='' as $$ begin
 if not lawroom_private.has_role('admin') then raise exception 'admin_required' using errcode='42501'; end if;
 return query select a.user_id,a.display_name from public.lr_accounts a where a.role='lawyer' and a.status='active' and exists(select 1 from public.lr_memberships m join public.lr_organizations o on o.id=m.organization_id where m.user_id=a.user_id and m.active and o.status='active'); end $$;
create function public.lr_assignable_lawyers() returns table(user_id uuid,display_name text) language sql security invoker set search_path='' as $$ select * from lawroom_private.assignable_lawyers() $$;

create function lawroom_private.assign_client(p_application uuid,p_lawyer uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.lr_applications; org uuid;
begin
 if not lawroom_private.has_role('admin') then raise exception 'admin_required' using errcode='42501'; end if;
 select * into a from public.lr_applications where id=p_application and kind='client' and status='pending' for update;
 if a.id is null then raise exception 'pending_client_application_required'; end if;
 if exists(select 1 from public.lr_relationships where client_id=a.applicant_id and status in ('lawyer_review','accepted')) then raise exception 'relationship_already_pending_or_accepted'; end if;
 select m.organization_id into org from public.lr_memberships m join public.lr_accounts u on u.user_id=m.user_id join public.lr_organizations o on o.id=m.organization_id where m.user_id=p_lawyer and m.active and u.role='lawyer' and u.status='active' and o.status='active' order by m.organization_id limit 1;
 if org is null then raise exception 'active_lawyer_required'; end if;
 insert into public.lr_relationships(organization_id,lawyer_id,client_id,status) values(org,p_lawyer,a.applicant_id,'lawyer_review') on conflict(organization_id,lawyer_id,client_id) do update set status='lawyer_review';
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'client.assigned','application',a.id);
end $$;
create function public.lr_assign_client(p_application uuid,p_lawyer uuid) returns void language sql security invoker set search_path='' as $$ select lawroom_private.assign_client(p_application,p_lawyer) $$;

create function lawroom_private.review_relationship(p_relationship uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.lr_relationships;
begin
 select * into r from public.lr_relationships where id=p_relationship for update;
 if r.id is null or r.lawyer_id<>auth.uid() or not lawroom_private.is_member(r.organization_id) or r.status<>'lawyer_review' then raise exception 'assigned_lawyer_required' using errcode='42501'; end if;
 update public.lr_relationships set status=case when p_accept then 'accepted' else 'rejected' end where id=r.id;
 if p_accept then
  update public.lr_accounts set status='active' where user_id=r.client_id and role='client' and status='pending';
  update public.lr_applications set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where applicant_id=r.client_id and kind='client' and status='pending';
 end if;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),case when p_accept then 'relationship.accepted' else 'relationship.rejected' end,'relationship',r.id);
end $$;
create function public.lr_review_relationship(p_relationship uuid,p_accept boolean) returns void language sql security invoker set search_path='' as $$ select lawroom_private.review_relationship(p_relationship,p_accept) $$;
create policy relationship_admin_metadata on public.lr_relationships for select to authenticated using(lawroom_private.has_role('admin'));

-- Each new function starts with no anonymous/PUBLIC EXECUTE. Helpers are in a private schema.
revoke all on function lawroom_private.submit_application(text,text,text,text,text),lawroom_private.review_application(uuid,boolean,text),lawroom_private.assignable_lawyers(),lawroom_private.assign_client(uuid,uuid),lawroom_private.review_relationship(uuid,boolean) from public,anon,authenticated;
revoke all on function public.lr_submit_application(text,text,text,text,text),public.lr_review_application(uuid,boolean,text),public.lr_assignable_lawyers(),public.lr_assign_client(uuid,uuid),public.lr_review_relationship(uuid,boolean) from public,anon,authenticated;
grant execute on function lawroom_private.submit_application(text,text,text,text,text),lawroom_private.review_application(uuid,boolean,text),lawroom_private.assignable_lawyers(),lawroom_private.assign_client(uuid,uuid),lawroom_private.review_relationship(uuid,boolean) to authenticated;
grant execute on function public.lr_submit_application(text,text,text,text,text),public.lr_review_application(uuid,boolean,text),public.lr_assignable_lawyers(),public.lr_assign_client(uuid,uuid),public.lr_review_relationship(uuid,boolean) to authenticated;
commit;
