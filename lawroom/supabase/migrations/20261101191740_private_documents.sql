begin;
-- No existing bucket is modified. This bucket is private from creation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lr-matter-files','lr-matter-files',false,20971520,array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream']);
alter table public.lr_documents add column uploaded_by uuid references public.lr_accounts(user_id),add column upload_status text not null default 'ready' check(upload_status in ('uploading','ready','archived')),add column size_bytes bigint check(size_bytes between 1 and 20971520);
drop policy document_read on public.lr_documents;
create policy document_read on public.lr_documents for select to authenticated using(upload_status<>'archived' and (lawroom_private.can_write(matter_id) or (upload_status='ready' and shared and lawroom_private.can_read(matter_id))));
create function lawroom_private.can_download_document(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.lr_documents d where d.object_path=path and d.upload_status='ready' and (lawroom_private.can_write(d.matter_id) or (d.shared and lawroom_private.can_read(d.matter_id))));
$$;
create function lawroom_private.can_upload_document(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.lr_documents d where d.object_path=path and d.upload_status='uploading' and d.uploaded_by=auth.uid() and lawroom_private.can_write(d.matter_id));
$$;
-- Authenticated downloads recheck access on every request. Signing reusable URLs is intentionally denied.
create policy lr_document_download on storage.objects for select to authenticated using(bucket_id='lr-matter-files' and storage.allow_only_operation('storage.object.get_authenticated') and lawroom_private.can_download_document(name));
create policy lr_document_upload on storage.objects for insert to authenticated with check(bucket_id='lr-matter-files' and lawroom_private.can_upload_document(name));
-- No UPDATE/DELETE policy: uploads never overwrite an existing object.

create function lawroom_private.reserve_document(p_matter uuid,p_name text,p_media_type text,p_size bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare did uuid:=gen_random_uuid(); org uuid; path text;
begin
 if not lawroom_private.can_write(p_matter) then raise exception 'matter_writer_required' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 180 or p_name !~* '\.(pdf|png|jpe?g|docx|udf)$' or p_size is null or p_size not between 1 and 20971520 or p_media_type not in ('application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream') then raise exception 'invalid_file'; end if;
 select organization_id into org from public.lr_matters where id=p_matter and archived_at is null;
 if org is null then raise exception 'active_matter_required'; end if;
 path:=org::text||'/'||p_matter::text||'/'||did::text||'/1-'||regexp_replace(p_name,'[^a-zA-Z0-9._-]','_','g');
 insert into public.lr_documents(id,matter_id,name,object_path,media_type,uploaded_by,upload_status,size_bytes) values(did,p_matter,p_name,path,p_media_type,auth.uid(),'uploading',p_size);
 return jsonb_build_object('id',did,'object_path',path);
end $$;
create function public.lr_reserve_document(p_matter uuid,p_name text,p_media_type text,p_size bigint) returns jsonb language sql security invoker set search_path='' as $$ select lawroom_private.reserve_document(p_matter,p_name,p_media_type,p_size) $$;
create function lawroom_private.finalize_document(p_document uuid) returns void
language plpgsql security definer set search_path='' as $$
declare d public.lr_documents;
begin
 select * into d from public.lr_documents where id=p_document for update;
 if d.id is null or not lawroom_private.can_write(d.matter_id) or d.uploaded_by<>auth.uid() then raise exception 'uploader_required' using errcode='42501'; end if;
 if d.upload_status='ready' then return; end if;
 if d.upload_status<>'uploading' or not exists(select 1 from storage.objects o where o.bucket_id='lr-matter-files' and o.name=d.object_path and (o.metadata->>'size')::bigint=d.size_bytes) then raise exception 'upload_not_complete'; end if;
 update public.lr_documents set upload_status='ready' where id=d.id;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),'document.uploaded','document',d.id);
end $$;
create function public.lr_finalize_document(p_document uuid) returns void language sql security invoker set search_path='' as $$ select lawroom_private.finalize_document(p_document) $$;
create function lawroom_private.share_document(p_document uuid,p_shared boolean) returns void
language plpgsql security definer set search_path='' as $$
declare d public.lr_documents;
begin
 select * into d from public.lr_documents where id=p_document for update;
 if d.id is null or d.upload_status<>'ready' or not lawroom_private.can_write(d.matter_id) then raise exception 'matter_writer_required' using errcode='42501'; end if;
 update public.lr_documents set shared=p_shared where id=d.id;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),case when p_shared then 'document.shared' else 'document.unshared' end,'document',d.id);
end $$;
create function public.lr_share_document(p_document uuid,p_shared boolean) returns void language sql security invoker set search_path='' as $$ select lawroom_private.share_document(p_document,p_shared) $$;
create function lawroom_private.document_download_path(p_document uuid) returns text
language plpgsql stable security definer set search_path='' as $$ declare path text; begin
 select object_path into path from public.lr_documents where id=p_document;
 if path is null or not lawroom_private.can_download_document(path) then raise exception 'document_access_denied' using errcode='42501'; end if;
 return path;
end $$;
create function public.lr_document_download_path(p_document uuid) returns text language sql security invoker set search_path='' as $$ select lawroom_private.document_download_path(p_document) $$;

create function lawroom_private.list_clients() returns table(relationship_id uuid,display_name text,status text,client_id uuid)
language plpgsql stable security definer set search_path='' as $$ begin
 if not lawroom_private.has_role('lawyer') then raise exception 'lawyer_required' using errcode='42501'; end if;
 return query select r.id,a.display_name,r.status,r.client_id from public.lr_relationships r join public.lr_accounts a on a.user_id=r.client_id where r.lawyer_id=auth.uid() and r.status in ('accepted','lawyer_review') and lawroom_private.is_member(r.organization_id);
end $$;
create function public.lr_list_clients() returns table(relationship_id uuid,display_name text,status text,client_id uuid) language sql security invoker set search_path='' as $$ select * from lawroom_private.list_clients() $$;
create function lawroom_private.share_matter(p_matter uuid,p_relationship uuid,p_shared boolean) returns void
language plpgsql security definer set search_path='' as $$ declare m public.lr_matters; r public.lr_relationships; begin
 select * into m from public.lr_matters where id=p_matter;
 select * into r from public.lr_relationships where id=p_relationship;
 if not lawroom_private.can_write(p_matter) or r.id is null or r.organization_id<>m.organization_id or r.lawyer_id<>auth.uid() or (p_shared and r.status<>'accepted') then raise exception 'sharing_not_allowed' using errcode='42501'; end if;
 insert into public.lr_matter_clients(matter_id,organization_id,relationship_id,shared) values(m.id,m.organization_id,r.id,p_shared) on conflict(matter_id,relationship_id) do update set shared=p_shared;
 insert into public.lr_audit_events(actor_id,action,entity_type,entity_id) values(auth.uid(),case when p_shared then 'matter.shared' else 'matter.unshared' end,'matter',m.id);
end $$;
create function public.lr_share_matter(p_matter uuid,p_relationship uuid,p_shared boolean) returns void language sql security invoker set search_path='' as $$ select lawroom_private.share_matter(p_matter,p_relationship,p_shared) $$;

revoke all on function lawroom_private.can_download_document(text),lawroom_private.can_upload_document(text),lawroom_private.reserve_document(uuid,text,text,bigint),lawroom_private.finalize_document(uuid),lawroom_private.share_document(uuid,boolean),lawroom_private.document_download_path(uuid),lawroom_private.list_clients(),lawroom_private.share_matter(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function lawroom_private.can_download_document(text),lawroom_private.can_upload_document(text),lawroom_private.reserve_document(uuid,text,text,bigint),lawroom_private.finalize_document(uuid),lawroom_private.share_document(uuid,boolean),lawroom_private.document_download_path(uuid),lawroom_private.list_clients(),lawroom_private.share_matter(uuid,uuid,boolean) to authenticated;
revoke all on function public.lr_reserve_document(uuid,text,text,bigint),public.lr_finalize_document(uuid),public.lr_share_document(uuid,boolean),public.lr_document_download_path(uuid),public.lr_list_clients(),public.lr_share_matter(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.lr_reserve_document(uuid,text,text,bigint),public.lr_finalize_document(uuid),public.lr_share_document(uuid,boolean),public.lr_document_download_path(uuid),public.lr_list_clients(),public.lr_share_matter(uuid,uuid,boolean) to authenticated;
commit;
