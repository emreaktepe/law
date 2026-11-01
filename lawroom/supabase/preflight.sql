-- Read-only preflight before any incremental production migration.
select current_database(),version();
select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename;
select to_regprocedure('lawroom_private.can_read(uuid)') as matter_access,
       to_regprocedure('storage.allow_only_operation(text)') as storage_operation_helper;
select count(*) as duplicate_application_users from (
 select applicant_id from public.lr_applications group by applicant_id having count(*)>1
) duplicates;
select id,public,file_size_limit,allowed_mime_types from storage.buckets;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name like 'lr\_%' order by table_name,ordinal_position;
