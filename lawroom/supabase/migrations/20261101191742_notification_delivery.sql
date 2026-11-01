begin;
alter table public.lr_notification_outbox add column matter_id uuid references public.lr_matters(id),add column lease_token uuid,add column locked_at timestamptz,add column sent_at timestamptz;
create index lr_outbox_pending on public.lr_notification_outbox(next_attempt_at) where status in ('pending','sending');
create table public.lr_delivery_attempts (
 id bigint generated always as identity primary key,
 outbox_id uuid not null references public.lr_notification_outbox(id),
 attempt integer not null, provider_status integer, succeeded boolean not null,
 created_at timestamptz not null default now(),unique(outbox_id,attempt)
);
alter table public.lr_delivery_attempts enable row level security;
revoke all on public.lr_delivery_attempts from public,anon,authenticated;

create function lawroom_private.notification_allowed(recipient uuid,mid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lr_accounts a where a.user_id=recipient and a.status='active' and a.role in ('lawyer','client') and (mid is null or exists(
  select 1 from public.lr_matters m join public.lr_organizations o on o.id=m.organization_id and o.status='active'
  join public.lr_memberships mem on mem.organization_id=m.organization_id and mem.user_id=m.owner_id and mem.active
  join public.lr_accounts owner_account on owner_account.user_id=m.owner_id and owner_account.role='lawyer' and owner_account.status='active'
  where m.id=mid and (m.owner_id=recipient or (a.role='client' and exists(select 1 from public.lr_matter_clients mc join public.lr_relationships r on r.id=mc.relationship_id where mc.matter_id=m.id and mc.shared and r.client_id=recipient and r.lawyer_id=m.owner_id and r.status='accepted')))
 )));
$$;
create function lawroom_private.enqueue_message() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.lr_notification_outbox(recipient_id,event_key,kind,matter_id)
 select a.user_id,'message/'||new.id::text||'/'||a.user_id::text,'new_message',new.matter_id from public.lr_accounts a where a.user_id<>new.sender_id and lawroom_private.notification_allowed(a.user_id,new.matter_id) on conflict(event_key) do nothing;
 return new;
end $$;
create trigger lr_message_notification after insert on public.lr_messages for each row execute function lawroom_private.enqueue_message();
create function lawroom_private.enqueue_approval() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='approved' and old.status<>'approved' then
  insert into public.lr_notification_outbox(recipient_id,event_key,kind) values(new.applicant_id,'approved/'||new.id::text,'application_approved') on conflict(event_key) do nothing;
 end if;return new;
end $$;
create trigger lr_approval_notification after update on public.lr_applications for each row execute function lawroom_private.enqueue_approval();

create function lawroom_private.claim_notifications(p_limit integer) returns table(id uuid,event_key text,lease_token uuid)
language plpgsql security definer set search_path='' as $$ begin
 -- Resend retains idempotency keys for 24h. Stop automatic retries before that window ends.
 update public.lr_notification_outbox set status='failed',lease_token=null where status in ('pending','sending') and created_at<now()-interval '23 hours';
 return query with candidates as(select q.id from public.lr_notification_outbox q where q.created_at>=now()-interval '23 hours' and q.attempts<8 and q.next_attempt_at<=now() and (q.status='pending' or (q.status='sending' and q.locked_at<now()-interval '5 minutes')) order by q.next_attempt_at for update skip locked limit least(greatest(p_limit,1),20))
 update public.lr_notification_outbox q set status='sending',locked_at=now(),lease_token=gen_random_uuid(),attempts=q.attempts+1 from candidates c where q.id=c.id returning q.id,q.event_key,q.lease_token;
end $$;
create function public.lr_claim_notifications(p_limit integer default 10) returns table(id uuid,event_key text,lease_token uuid) language sql security invoker set search_path='' as $$ select * from lawroom_private.claim_notifications(p_limit) $$;
create function lawroom_private.authorize_delivery(p_id uuid,p_lease uuid) returns text
language plpgsql security definer set search_path='' as $$ declare q public.lr_notification_outbox; email text; begin
 select * into q from public.lr_notification_outbox where id=p_id and lease_token=p_lease and status='sending' and locked_at>now()-interval '5 minutes' for update;
 if q.id is null then return null; end if;
 if not lawroom_private.notification_allowed(q.recipient_id,q.matter_id) then update public.lr_notification_outbox set status='cancelled',lease_token=null where id=q.id;return null; end if;
 select u.email into email from auth.users u where u.id=q.recipient_id and u.email_confirmed_at is not null;
 return email;
end $$;
create function public.lr_authorize_delivery(p_id uuid,p_lease uuid) returns text language sql security invoker set search_path='' as $$ select lawroom_private.authorize_delivery(p_id,p_lease) $$;
create function lawroom_private.finish_delivery(p_id uuid,p_lease uuid,p_success boolean,p_status integer) returns void
language plpgsql security definer set search_path='' as $$ declare q public.lr_notification_outbox; begin
 select * into q from public.lr_notification_outbox where id=p_id and lease_token=p_lease and status='sending' for update;
 if q.id is null then return; end if;
 insert into public.lr_delivery_attempts(outbox_id,attempt,provider_status,succeeded) values(q.id,q.attempts,p_status,p_success) on conflict do nothing;
 update public.lr_notification_outbox set status=case when p_success then 'sent' when attempts>=8 then 'failed' else 'pending' end,lease_token=null,locked_at=null,sent_at=case when p_success then now() else null end,next_attempt_at=now()+least(3600,60*power(2,attempts)::integer)*interval '1 second' where id=q.id;
end $$;
create function public.lr_finish_delivery(p_id uuid,p_lease uuid,p_success boolean,p_status integer default null) returns void language sql security invoker set search_path='' as $$ select lawroom_private.finish_delivery(p_id,p_lease,p_success,p_status) $$;
revoke all on function lawroom_private.notification_allowed(uuid,uuid),lawroom_private.enqueue_message(),lawroom_private.enqueue_approval(),lawroom_private.claim_notifications(integer),lawroom_private.authorize_delivery(uuid,uuid),lawroom_private.finish_delivery(uuid,uuid,boolean,integer) from public,anon,authenticated;
revoke all on function public.lr_claim_notifications(integer),public.lr_authorize_delivery(uuid,uuid),public.lr_finish_delivery(uuid,uuid,boolean,integer) from public,anon,authenticated;
grant usage on schema lawroom_private to service_role;
grant execute on function lawroom_private.claim_notifications(integer),lawroom_private.authorize_delivery(uuid,uuid),lawroom_private.finish_delivery(uuid,uuid,boolean,integer) to service_role;
grant execute on function public.lr_claim_notifications(integer),public.lr_authorize_delivery(uuid,uuid),public.lr_finish_delivery(uuid,uuid,boolean,integer) to service_role;
commit;
