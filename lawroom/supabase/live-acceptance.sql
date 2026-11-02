-- Explicitly authorized Lawroom QA. Synthetic records only; ALWAYS ROLLBACK.
-- This tests real Postgres roles/RLS/RPC, not Auth token issuance or Storage bytes.
begin;
set local statement_timeout='30s';set local lock_timeout='5s';
do $$begin if exists(select 1 from public.lr_accounts) or exists(select 1 from auth.users) then raise exception 'qa_requires_empty_project';end if;end $$;
insert into auth.users(id,email,email_confirmed_at)
select ('ac000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'lawroom-qa-'||n||'@example.invalid',now() from generate_series(1,5)n;
insert into public.lr_accounts(user_id,display_name,role,status) values
('ac000000-0000-4000-8000-000000000001','Sentetik avukat','lawyer','active'),
('ac000000-0000-4000-8000-000000000002','Sentetik müvekkil','client','active'),
('ac000000-0000-4000-8000-000000000003','Sentetik yönetici','admin','active'),
('ac000000-0000-4000-8000-000000000004','Sentetik viewer','lawyer','active'),
('ac000000-0000-4000-8000-000000000005','İlgisiz avukat','lawyer','active');
insert into public.lr_organizations(id,name,kind,status) values('ac000000-0000-4000-8000-000000000010','Sentetik QA bürosu','firm','active');
insert into public.lr_memberships(organization_id,user_id,role,active) values
('ac000000-0000-4000-8000-000000000010','ac000000-0000-4000-8000-000000000001','owner',true),
('ac000000-0000-4000-8000-000000000010','ac000000-0000-4000-8000-000000000004','lawyer',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
do $$declare d jsonb;again jsonb;mid uuid;begin
 d:=public.lr_create_tracking_matter('{"organizationId":"ac000000-0000-4000-8000-000000000010","type":"icra","subtype":"İlamsız takip","title":"Yalnız geri alınan canlı QA","stageKey":"hazirlik","clientMode":"none"}', 'ac000000-0000-4000-8000-000000000090');
 again:=public.lr_create_tracking_matter('{"organizationId":"ac000000-0000-4000-8000-000000000010","type":"icra","subtype":"İlamsız takip","title":"Yalnız geri alınan canlı QA","stageKey":"hazirlik","clientMode":"none"}', 'ac000000-0000-4000-8000-000000000090');
 mid:=(d->'matter'->>'id')::uuid;
 if d->>'audience'<>'lawyer' or again->'matter'->>'id'<>mid::text then raise exception 'create_or_idempotency_failed';end if;
 perform set_config('lawroom.qa_matter',mid::text,true);
 perform public.lr_tracking_command(mid,'add_note','{"body":"LIVE_PRIVATE_QA_SENTINEL"}','ac000000-0000-4000-8000-000000000091');
end $$;
reset role;
insert into public.lr_relationships(id,organization_id,lawyer_id,client_id,status) values('ac000000-0000-4000-8000-000000000020','ac000000-0000-4000-8000-000000000010','ac000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002','accepted');
insert into public.lr_matter_clients(matter_id,organization_id,relationship_id,shared) values(current_setting('lawroom.qa_matter')::uuid,'ac000000-0000-4000-8000-000000000010','ac000000-0000-4000-8000-000000000020',true);
insert into public.lr_matter_members(matter_id,organization_id,user_id,role) values(current_setting('lawroom.qa_matter')::uuid,'ac000000-0000-4000-8000-000000000010','ac000000-0000-4000-8000-000000000004','viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000002',true);
do $$declare d jsonb;begin
 d:=public.lr_get_tracking_matter(current_setting('lawroom.qa_matter')::uuid);
 if d->>'audience'<>'client' or d::text like '%LIVE_PRIVATE_QA_SENTINEL%' or (d->'matter')?|array['internalNotes','tasks','deadlines','members','ownerId','objectPath'] then raise exception 'client_projection_failed';end if;
 perform public.lr_client_message(current_setting('lawroom.qa_matter')::uuid,'Sentetik ve geri alınan mesaj','ac000000-0000-4000-8000-000000000092');
end $$;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000004',true);
do $$declare d jsonb;denied boolean:=false;begin
 d:=public.lr_get_tracking_matter(current_setting('lawroom.qa_matter')::uuid);
 if d->'matter'->>'readonly'<>'true' then raise exception 'viewer_not_readonly';end if;
 begin perform public.lr_tracking_command(current_setting('lawroom.qa_matter')::uuid,'add_note','{"body":"blocked"}','ac000000-0000-4000-8000-000000000093');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'viewer_write_allowed';end if;
end $$;
do $$declare actor text;denied boolean;begin
 foreach actor in array array['ac000000-0000-4000-8000-000000000003','ac000000-0000-4000-8000-000000000005'] loop
 perform set_config('request.jwt.claim.sub',actor,true);denied:=false;
 begin perform public.lr_get_tracking_matter(current_setting('lawroom.qa_matter')::uuid);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'unrelated_or_admin_read_allowed';end if;
 end loop;
end $$;
reset role;
update public.lr_relationships set status='revoked' where id='ac000000-0000-4000-8000-000000000020';
set local role authenticated;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000002',true);
do $$declare denied boolean:=false;begin
 begin perform public.lr_get_tracking_matter(current_setting('lawroom.qa_matter')::uuid);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'revoked_client_still_allowed';end if;
end $$;
reset role;
rollback;
select 'live_role_rpc_checks_passed_and_rolled_back' as result,
 (select count(*) from auth.users) as remaining_auth_users,
 (select count(*) from public.lr_accounts) as remaining_accounts,
 (select count(*) from public.lr_matters) as remaining_matters;
