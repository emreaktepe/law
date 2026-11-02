-- Read-only baseline metadata; no user, case, Auth or document rows.
select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(c) order by table_name,ordinal_position) from (
   select table_schema,table_name,column_name,ordinal_position,udt_name,is_nullable,column_default,is_identity,identity_generation
   from information_schema.columns where table_schema='public') c),
 'constraints',(select jsonb_agg(to_jsonb(c) order by relation,name) from (
   select n.nspname||'.'||r.relname as relation,c.conname as name,pg_get_constraintdef(c.oid,true) as definition
   from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public') c),
 'indexes',(select jsonb_agg(to_jsonb(i) order by tablename,indexname) from pg_indexes i where schemaname='public'),
 'tables',(select jsonb_agg(to_jsonb(t) order by tablename) from pg_tables t where schemaname='public'),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]'::jsonb) from pg_policies p where schemaname in('public','lawroom_private') or(schemaname='storage' and left(policyname,3)='lr_')),
 'functions',(select jsonb_agg(to_jsonb(f) order by schema,name,args) from (
   select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as args,pg_get_functiondef(p.oid) as definition,p.proacl::text as acl
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='lawroom_private' or(n.nspname='public' and left(p.proname,3)='lr_')) f),
 'table_grants',(select jsonb_agg(to_jsonb(g) order by table_name,grantee,privilege_type) from information_schema.table_privileges g where table_schema='public'),
 'column_grants',(select jsonb_agg(to_jsonb(g) order by table_name,column_name,grantee,privilege_type) from information_schema.column_privileges g where table_schema='public'),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by relation,name),'[]'::jsonb) from (
   select n.nspname||'.'||r.relname as relation,t.tgname as name,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class r on r.oid=t.tgrelid join pg_namespace n on n.oid=r.relnamespace where not t.tgisinternal and n.nspname='public') t)
) as catalog_snapshot;
