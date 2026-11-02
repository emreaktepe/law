-- READ ONLY: catalog metadata, no customer, case, Auth-user or document rows.
-- Run against the approved LawRoom target only, after baseline reconciliation.
select current_setting('server_version') as server_version,
       to_regclass('supabase_migrations.schema_migrations') is not null as history_table_exists;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname like 'lr\_%' escape '\' and c.relkind in('r','v') order by c.relname;
select table_name,column_name,udt_name,is_nullable from information_schema.columns
 where table_schema='public' and table_name in('lr_documents','lr_matters','lr_tasks','lr_deadlines','lr_audit_events') order by table_name,ordinal_position;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef,p.proconfig
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='lawroom_private' or(n.nspname='public' and p.proname like 'lr\_%' escape '\') order by n.nspname,p.proname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
 where(schemaname='public' and tablename like 'lr\_%' escape '\') or(schemaname='storage' and policyname like 'lr\_%' escape '\') order by schemaname,tablename,policyname;
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
 where table_schema='public' and table_name like 'lr\_%' escape '\' and grantee in('anon','authenticated') order by table_name,column_name,grantee,privilege_type;
select pubname,schemaname,tablename from pg_publication_tables where tablename like 'lr\_%' escape '\';
-- Bucket/auth settings require a separate approved metadata check in real
-- Supabase; this file neither changes nor provisions them.
