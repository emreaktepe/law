import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.LAWROOM_SQL_ROOT || new URL('../../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const require=createRequire(root+'/package.json');
const {decodeTrackingDTO}=await import(pathToFileURL(root+'/src/domain/tracking-contract.js'));
const {createTrackingSupabaseRepository}=await import(pathToFileURL(root+'/src/data/trackingSupabaseRepository.js'));
const {createTrackingWorkspaceController}=await import(pathToFileURL(root+'/src/data/trackingWorkspaceController.js'));
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const value=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
async function actor(n){await db.exec(`reset role;set local role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',true);select set_config('storage.operation','storage.object.get_authenticated',true)`);}
async function deny(fn,pattern){await db.exec('savepoint rejected');await assert.rejects(fn,pattern);await db.exec('rollback to savepoint rejected');}
async function isolated(fn){await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}}
const rpc=(name,args=[])=>value(`select public.lr_${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args);
const command=(name,p={},mid=id(11),key=null)=>rpc('tracking_command',[mid,name,p,key]);
const draft=extra=>({organizationId:id(8),type:'icra',subtype:'İlamsız takip',title:'Sentetik dosya',stageKey:'hazirlik',clientMode:'none',...extra});
function sqlAdapter(){
 const requests=[],blobs=new Map();
 const client={supabaseUrl:'https://deezwydtiibbdtimxcxf.supabase.co',async rpc(name,args={}){
  if(!/^lr_[a-z_]+$/.test(name)||Object.keys(args).some(key=>!/^p(?:_[a-z_]+)?$/.test(key)))throw new Error('Invalid synthetic RPC identifier');
  requests.push({name,args:structuredClone(args)});
  try{
   const entries=Object.entries(args),sql=`select * from public.${name}(${entries.map(([key],i)=>`"${key}"=>$${i+1}`).join(',')})`;
   const result=(await rows(sql,entries.map(([,v])=>v))).map(row=>Object.values(row)[0]);
   return{data:name==='lr_list_tracking_matters'?result:result[0],error:null};
  }catch(error){return{data:null,error};}
 },storage:{from(bucket){return{
  async upload(path,file,options){
   if(options.upsert!==false)throw new Error('Fixture forbids overwrite');
   try{await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',[bucket,path,{size:file.size}]);blobs.set(path,file);return{error:null};}catch(error){return{error};}
  },
  async download(path){const available=await rows('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,path]);return available.length&&blobs.has(path)?{data:blobs.get(path),error:null}:{data:null,error:{code:'42501',message:'synthetic storage denied'}};}
 };}}};
 return{repository:createTrackingSupabaseRepository(client),requests};
}
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb default '{}',unique(bucket_id,name));
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon,service_role;
 grant select,insert,update,delete on storage.objects to authenticated,anon;
 create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select current_setting('storage.operation',true)=op$$;
 alter default privileges in schema public grant all on tables to anon,authenticated;
 alter default privileges in schema public grant all on sequences to anon,authenticated;
 alter default privileges in schema public grant execute on functions to anon,authenticated;`);
 await db.exec(await readFile(root+'/supabase/foundation.sql','utf8'));
 const migrations=(await readdir(root+'/supabase/migrations')).sort();
 for(const f of migrations.filter(f=>!f.includes('002_matter_tracking')))await db.exec(await readFile(root+'/supabase/migrations/'+f,'utf8'));
 for(let n=1;n<=7;n++)await db.query('insert into auth.users values($1,$2,now())',[id(n),`synthetic${n}@example.invalid`]);
 await db.exec(`insert into lr_accounts(user_id,display_name,role,status) values('${id(1)}','Admin','admin','active'),('${id(2)}','Lawyer A','lawyer','active'),('${id(3)}','Team','lawyer','active'),('${id(4)}','Client A','client','active'),('${id(5)}','Client B','client','active'),('${id(6)}','Viewer','lawyer','active'),('${id(7)}','Lawyer B','lawyer','active');
 insert into lr_organizations(id,name,kind,status) values('${id(8)}','Synthetic A','firm','active'),('${id(9)}','Synthetic B','individual','active');
 insert into lr_memberships values('${id(8)}','${id(2)}','owner',true),('${id(8)}','${id(3)}','lawyer',true),('${id(8)}','${id(6)}','lawyer',true),('${id(9)}','${id(7)}','owner',true);
 insert into lr_relationships(id,organization_id,lawyer_id,client_id,status) values('${id(10)}','${id(8)}','${id(2)}','${id(4)}','accepted');
 insert into lr_matters(id,organization_id,owner_id,title,matter_type,next_action,target_date,reference) values('${id(11)}','${id(8)}','${id(2)}','Synthetic legacy','Diğer','INTERNAL_SENTINEL','2026-11-10','2026/00184 E.');
 insert into lr_matters(id,organization_id,owner_id,title,matter_type) values('${id(13)}','${id(9)}','${id(7)}','Other organization','Diğer');
 insert into lr_matter_clients values('${id(11)}','${id(8)}','${id(10)}',true);
 insert into lr_internal_notes(matter_id,body) values('${id(11)}','INTERNAL_SENTINEL');
 insert into lr_tasks(id,matter_id,title,completed_at) values('${id(15)}','${id(11)}','Legacy completed',now());
 insert into lr_documents(id,matter_id,name,object_path,shared,upload_status,uploaded_by,size_bytes) values('${id(12)}','${id(11)}','synthetic.pdf','${id(8)}/${id(11)}/${id(12)}/1-synthetic.pdf',true,'ready','${id(2)}',100);
 insert into storage.objects(bucket_id,name,metadata) select 'lr-matter-files',object_path,'{"size":100}' from lr_documents;
 `);
 const candidate=process.env.LAWROOM_SQL_CANDIDATE || root+'/supabase/migrations/'+migrations.find(f=>f.includes('002_matter_tracking'));
 try{await db.exec(await readFile(candidate,'utf8'));}catch(e){throw new Error(`Candidate DDL ${e.code}: ${e.message}; position ${e.position}`,{cause:undefined});}
 await db.exec(`insert into lr_matter_members(matter_id,organization_id,user_id,role) values('${id(11)}','${id(8)}','${id(3)}','collaborator'),('${id(11)}','${id(8)}','${id(6)}','viewer')`);
});
after(()=>db.close());

test('002 upgrades legacy owner, completed task and unknown-hash version without fabrication',()=>isolated(async()=>{
 assert.equal(await value('select role from lr_matter_members where matter_id=$1 and user_id=$2',[id(11),id(2)]),'responsible');
 assert.equal(await value('select status from lr_tasks where id=$1',[id(15)]),'completed');
 const v=(await rows('select * from lr_document_versions where document_id=$1',[id(12)]))[0];assert.equal(v.is_legacy,true);assert.equal(v.sha256,null);assert.equal(v.sha256_verified,false);
 assert.equal(await value('select count(*)::int from lr_stage_templates'),12);assert.equal(await value('select count(*)::int from lr_deadline_rules'),0);
 assert.equal(await value('select normalized from lr_matter_numbers where matter_id=$1',[id(11)]),'2026/184');
 assert.equal(await value("select template_snapshot->>'unverified' from lr_matters where id=$1",[id(11)]),'true');
}));
test('broad Supabase default ACLs cannot expose raw private columns or unguarded helper execution',()=>isolated(async()=>{
 await actor(4);
 for(const table of ['lr_matters','lr_events','lr_documents','lr_messages','lr_matter_members','lr_audit_events','lr_document_versions','lr_saved_views','lr_import_batches'])await deny(()=>db.exec(`select * from ${table}`),/permission denied/);
 assert.equal(await value("select has_any_column_privilege('authenticated','lr_matters','UPDATE')"),false);
 assert.equal(await value("select has_any_column_privilege('authenticated','lr_events','UPDATE')"),false);
 for(const fn of ['internal_dto','client_dto'])await deny(()=>db.query(`select lawroom_private.${fn}($1)`,[id(11)]),/permission denied/);
 await deny(()=>db.query("select lawroom_private.audit($1,'forged',$1)",[id(11)]),/permission denied/);
 await db.exec('reset role;set local role anon');await deny(()=>rpc('get_tracking_matter',[id(11)]),/permission denied/);
}));
test('server chooses client DTO; admin, unrelated client and another organization receive no dossiers',()=>isolated(async()=>{
 for(const n of [1,5,7]){await actor(n);await deny(()=>rpc('get_tracking_matter',[id(11)]),/matter_access_denied/);}
 await actor(4);const dto=decodeTrackingDTO(await rpc('get_tracking_matter',[id(11)]));assert.equal(dto.audience,'client');
 assert.deepEqual(Object.keys(dto.matter).sort(),['id','title','number','stage','summary','events','agendaItems','requests','messages','documents'].sort());
 assert.ok(!JSON.stringify(dto).includes('INTERNAL_SENTINEL'));
 for(const k of ['tasks','deadlines','internalNotes','ownerId','internalRef','legalBasis','calculation','objectPath','uploadedBy'])assert.ok(!JSON.stringify(dto).includes('"'+k+'"'));
}));
test('case viewer is read-only; collaborator may work; organization membership revocation cuts access immediately',()=>isolated(async()=>{
 await actor(6);assert.equal((await rpc('get_tracking_matter',[id(11)])).matter.readonly,true);await deny(()=>command('add_note',{body:'blocked'}),/matter_writer_required/);
 await actor(3);decodeTrackingDTO(await command('add_note',{body:'Team note'}));
 await db.exec(`reset role;update lr_memberships set active=false where user_id='${id(3)}'`);await actor(3);await deny(()=>rpc('get_tracking_matter',[id(11)]),/matter_access_denied/);
}));
test('create uses server snapshot and actor, validates client linkage and creates only one first-task source',()=>isolated(async()=>{
 await actor(2);const catalog=await rpc('tracking_catalog');const template=catalog.templates.find(x=>x.key==='icra');
 const p=draft({subtype:template.subtypes[0],nextAction:'İlk iş',targetDate:'2026-11-20'});const dto=await rpc('create_tracking_matter',[p,id(90)]);
 assert.equal(dto.matter.stageSnapshot.unverified,true);assert.equal(dto.matter.stageSnapshot.verifiedByLawyer,false);assert.equal(dto.matter.tasks.length,1);assert.equal(dto.matter.nextAction,null);assert.equal(dto.matter.shared,false);assert.equal(dto.matter.members[0].userId,id(2));
 assert.equal((await rpc('create_tracking_matter',[p,id(90)])).matter.id,dto.matter.id);
 await deny(()=>rpc('create_tracking_matter',[{...p,ownerId:id(7)},null]),/unsupported_payload_fields/);
 await deny(()=>rpc('create_tracking_matter',[{...p,clientMode:'accepted',clientId:id(5)},null]),/accepted_client_relationship_required/);
}));
test('atomic proceeding child failure rolls back event, tasks, revision and audit; UUID replay does not duplicate',()=>isolated(async()=>{
 await actor(2);const before=await rpc('get_tracking_matter',[id(11)]);const ev={eventType:'tebligat_alindi',title:'Sentetik tebliğ',occurredOn:'2026-11-01',servedOn:'2026-11-01',serviceMethod:'UETS',sourceReference:'sentetik kaynak'};
 await deny(()=>rpc('add_proceeding',[id(11),ev,[{title:'valid'},{title:'invalid',assigneeId:id(7)}],[],[],id(91)]),/active_case_assignee_required/);
 assert.deepEqual(await rpc('get_tracking_matter',[id(11)]),before);
 const a=await rpc('add_proceeding',[id(11),ev,[{title:'incele'}],[{title:'İnceleme',proposedDueAt:null}],[],id(91)]);
 const b=await rpc('add_proceeding',[id(11),ev,[{title:'incele'}],[],[],id(91)]);assert.equal(a.matter.events.length,b.matter.events.length);assert.equal(a.matter.deadlines.at(-1).status,'proposed');
 await deny(()=>command('add_task',{title:'different'},id(11),id(91)),/command_key_reused/);
}));
test('lawyer proof is required, date-only deadline stays a date, correction invalidates confirmation',()=>isolated(async()=>{
 await actor(2);let m=(await rpc('add_proceeding',[id(11),{eventType:'tebligat_alindi',title:'Tebliğ',occurredOn:'2026-11-01',servedOn:'2026-11-01',serviceMethod:'sentetik',sourceReference:'source'},[],[{title:'İncele',proposedDueAt:'2026-11-10'}],[],null])).matter;
 const d=m.deadlines.at(-1),p={id:d.id,dueOn:'2026-11-10',legalBasis:'Sentetik dayanak, hukuki kural değildir',sourceReference:'fixture',ruleVersion:'review-1',confirmed:true};
 await deny(()=>command('verify_deadline',{...p,confirmed:false}),/explicit_confirmation/);
 m=(await command('verify_deadline',p)).matter;assert.equal(m.deadlines.at(-1).verifiedDueAt,'2026-11-10');
 m=(await rpc('add_proceeding',[id(11),{eventType:'diger',title:'Düzeltme',occurredOn:'2026-11-02',correctsEventId:m.events.at(-1).id,correctionReason:'Kaynak değişti'},[],[],[],null])).matter;
 assert.equal(m.deadlines.at(-1).status,'invalidated');await deny(()=>command('verify_deadline',p),/deadline_source/);
}));
test('task postpone history, terminal states and actor integrity are enforced by SQL',()=>isolated(async()=>{
 await actor(2);let m=(await command('add_task',{title:'Task',dueOn:'2026-11-10'})).matter;const tid=m.tasks.find(t=>t.title==='Task').id;
 await deny(()=>command('postpone_task',{id:tid,dueOn:'2026-11-09',reason:'earlier'}),/later_task_target/);
 await command('postpone_task',{id:tid,dueOn:'2026-11-11',reason:'Sentetik erteleme'});m=(await command('complete_task',{id:tid})).matter;
 const t=m.tasks.find(t=>t.id===tid);assert.equal(t.status,'completed');assert.equal(t.completedBy,id(2));assert.equal(t.postponements.length,1);
 await deny(()=>command('complete_task',{id:tid}),/open_task_required/);await deny(()=>command('add_note',{body:'x',actorId:id(1)}),/unsupported_payload_fields/);
}));
test('archive rejects remaining work, revokes client reads, and permits only reasoned writer reopen',()=>isolated(async()=>{
 await actor(2);await deny(()=>command('archive',{reason:'closed',closedOn:'2026-11-01'}),/open_work_prevents/);
 await command('finish_manual_target');await command('archive',{reason:'Synthetic close',closedOn:'2026-11-01'});
 await actor(4);await deny(()=>rpc('get_tracking_matter',[id(11)]),/matter_access_denied/);
 await actor(2);await deny(()=>command('add_note',{body:'x'}),/matter_writer_required/);await deny(()=>command('reopen',{reason:''}),/invalid_required_text/);
 const m=(await command('reopen',{reason:'Synthetic reopen'})).matter;assert.equal(m.status,'active');assert.equal(m.shared,false);
}));
test('saved views belong to the authenticated lawyer; soft delete/default/restore and unknown filters are guarded',()=>isolated(async()=>{
 await actor(2);const a=await rpc('saved_view',['create',null,{name:'A',filters:{types:['icra'],attentionTiers:[1,2],statuses:['active']},isDefault:true}]);const b=await rpc('saved_view',['create',null,{name:'B',isDefault:true}]);
 assert.equal((await rpc('saved_view',['list',null,{}])).filter(x=>x.isDefault).length,1);
 await rpc('saved_view',['delete',b.id,{}]);await rpc('saved_view',['restore',b.id,{}]);assert.equal((await rpc('saved_view',['list',null,{}])).find(x=>x.id===b.id).isDefault,false);
 await deny(()=>rpc('saved_view',['create',null,{name:'unsafe',filters:{sql:'select *'}}]),/unsupported_payload_fields/);
 await actor(3);await deny(()=>rpc('saved_view',['update',a.id,{name:'steal'}]),/own_saved_view/);
}));
test('bulk validates all selected case memberships before mutation and never silently grants access',()=>isolated(async()=>{
 await actor(2);const before=await rpc('get_tracking_matter',[id(11)]);
 await deny(()=>rpc('bulk_tracking',[[id(11),id(13)],'assign',{assigneeId:id(3)},id(92)]),/matter_writer_required/);assert.deepEqual(await rpc('get_tracking_matter',[id(11)]),before);
 await deny(()=>rpc('bulk_tracking',[[id(11)],'assign',{assigneeId:id(7)},id(92)]),/active_case_member/);
 await rpc('bulk_tracking',[[id(11)],'assign',{assigneeId:id(3)},id(92)]);assert.equal((await rpc('get_tracking_matter',[id(11)])).matter.responsibleId,id(3));
}));
test('import rollback is atomic, private, deduplicated; undo requires unchanged revisions and is reversible archival',()=>isolated(async()=>{
 await actor(2);const cat=await rpc('tracking_catalog');const p=draft({subtype:cat.templates.find(t=>t.key==='icra').subtypes[0],number:'2026/999',numberKind:'esas'});delete p.organizationId;
 await deny(()=>rpc('import_tracking',[id(8),[p,{...p,title:''}],id(93)]),/duplicate_import_number|invalid_required_text/);
 assert.equal(await value("select count(*)::int from public.lr_list_tracking_matters() dto where dto->'matter'->>'number'='2026/999'"),0);
 const batch=await rpc('import_tracking',[id(8),[p],id(93)]);const m=(await rows('select * from public.lr_list_tracking_matters()')).map(x=>Object.values(x)[0].matter).find(x=>x.number==='2026/999');assert.equal(m.shared,false);
 await command('add_note',{body:'changed'},m.id);await deny(()=>rpc('undo_tracking_import',[batch.id,id(94)]),/changed_import/);
 const batch2=await rpc('import_tracking',[id(8),[{...p,number:'2026/1000',nextAction:'First task'}],id(95)]);await rpc('undo_tracking_import',[batch2.id,id(96)]);
 const archived=(await rows('select * from public.lr_list_tracking_matters()')).map(x=>Object.values(x)[0].matter).find(x=>x.number==='2026/1000');assert.equal(archived.status,'archived');assert.equal(archived.tasks[0].status,'cancelled');
}));
test('client upload is restricted to a live accepted request, immutable path and uploader; review state does not certify hash',()=>isolated(async()=>{
 await actor(2);const m=(await command('add_task',{title:'Belge isteği',kind:'client_document_request',requestedClientId:id(4),sharedWithClient:true})).matter;const tid=m.tasks.find(x=>x.title==='Belge isteği').id;
 await actor(5);await deny(()=>rpc('reserve_tracking_document',[id(11),{requestTaskId:tid,name:'a.pdf',sizeBytes:100,mediaType:'application/pdf',sha256:'a'.repeat(64)}]),/document_upload_denied/);
 await actor(4);const reservation=await rpc('reserve_tracking_document',[id(11),{requestTaskId:tid,name:'a.pdf',sizeBytes:100,mediaType:'application/pdf',sha256:'a'.repeat(64)}]);
 await deny(()=>rpc('finalize_tracking_document',[reservation.versionId]),/storage_size_mismatch/);
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('lr-matter-files',$1,'{\"size\":100}')",[reservation.objectPath]);
 const f=await rpc('finalize_tracking_document',[reservation.versionId]);assert.equal(f.sha256Verified,false);assert.equal((await rpc('get_tracking_matter',[id(11)])).matter.requests.find(x=>x.id===tid).status,'review');
 await deny(()=>db.query("insert into storage.objects(bucket_id,name) values('lr-matter-files',$1)",[reservation.objectPath+'forged']),/row-level security/);
 await actor(2);await rpc('share_document',[reservation.documentId,false]);await actor(4);assert.ok(!(await rows('select name from storage.objects')).some(x=>x.name===reservation.objectPath));
}));
test('known version paths lose access when relationship or membership is revoked; signing, overwrite and deletion remain closed',()=>isolated(async()=>{
 await actor(4);assert.equal((await rows('select * from storage.objects')).length,1);
 await db.exec("select set_config('storage.operation','storage.object.sign',true)");assert.equal((await rows('select * from storage.objects')).length,0);
 await db.exec("select set_config('storage.operation','storage.object.get_authenticated',true)");await db.exec(`reset role;update lr_relationships set status='revoked' where id='${id(10)}'`);await actor(4);assert.equal((await rows('select * from storage.objects')).length,0);
 assert.equal((await rows("delete from storage.objects returning id")).length,0);assert.equal((await rows("update storage.objects set metadata='{}' returning id")).length,0);
}));
test('related and derived cases are bidirectional, atomic and same-organization only',()=>isolated(async()=>{
 await actor(2);await deny(()=>rpc('link_tracking',[id(11),id(13),'related',null]),/matter_writer_required/);
 const cat=await rpc('tracking_catalog');const p=draft({subtype:cat.templates.find(t=>t.key==='icra').subtypes[0]});delete p.organizationId;
 const d=await rpc('derive_tracking',[id(11),p,'related',id(97)]);assert.equal(d.matter.shared,false);assert.equal(d.matter.links.length,1);assert.equal((await rpc('get_tracking_matter',[id(11)])).matter.links.length,1);
}));
test('all new lr tables have RLS and deny raw authenticated writes; public facades are invokers with empty search_path',()=>isolated(async()=>{
 const names=['lr_stage_templates','lr_event_types','lr_matter_members','lr_matter_numbers','lr_stage_history','lr_agenda_items','lr_parties','lr_matter_parties','lr_matter_links','lr_document_versions','lr_expenses','lr_saved_views','lr_deadline_rules','lr_holidays','lr_import_batches'];
 for(const name of names){
  assert.equal(await value('select relrowsecurity from pg_class where oid=$1::regclass',[name]),true);
  for(const role of ['anon','authenticated'])for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await value('select has_table_privilege($1,$2,$3)',[role,name,privilege]),false,`${role} ${name} ${privilege}`);
 }
 const funcs=await rows("select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lr_%'");assert.ok(funcs.length>20);
 for(const f of funcs){assert.equal(f.prosecdef,false,f.proname);assert.ok(f.proconfig.some(x=>x.startsWith('search_path=')),f.proname);}
}));
test('hearing result and next hearing/task writes are atomic and use Istanbul calendar day',()=>isolated(async()=>{
 await actor(2);let m=(await command('add_agenda',{title:'Past hearing',kind:'hearing',startsAt:'2026-01-01T23:30:00Z',endsAt:'2026-01-02T00:00:00Z'})).matter;const aid=m.agendaItems.at(-1).id;
 const p={id:aid,result:'Ara karar',note:'Synthetic outcome',tasks:[{title:'Follow up'}],nextHearing:{title:'Next hearing',startsAt:'2099-01-01T10:00:00+03:00',endsAt:'2099-01-01T11:00:00+03:00'}};
 await deny(()=>rpc('record_hearing_outcome',[id(11),{...p,tasks:[{title:''}]},null]),/invalid_required_text/);
 assert.equal((await rpc('get_tracking_matter',[id(11)])).matter.agendaItems.find(a=>a.id===aid).status,'planned');
 m=(await rpc('record_hearing_outcome',[id(11),p,id(98)])).matter;assert.equal(m.agendaItems.length,2);assert.equal(m.events.at(-1).occurredOn,'2026-01-02');assert.equal(m.tasks.find(t=>t.title==='Follow up').sourceEventId,m.events.at(-1).id);
}));
test('expense decimal math and reversal preserve original; stage/number/party histories remain auditable',()=>isolated(async()=>{
 await actor(2);const cat=await rpc('tracking_catalog'),tmpl=cat.templates.find(t=>t.key==='icra');const m=(await rpc('create_matter',[draft({subtype:tmpl.subtypes[0]}),null])).matter;
 let x=(await command('add_expense',{category:'Harç',amount:'12,34',paidBy:'office',spentOn:'2026-11-01'},m.id)).matter;const exp=x.expenses[0];assert.equal(exp.amountMinor,1234);
 x=(await command('reverse_expense',{id:exp.id,reason:'Sentetik düzeltme'},m.id)).matter;assert.equal(x.expenses.length,2);assert.equal(x.expenses.find(e=>e.reversesId===exp.id).amountMinor,1234);
 await deny(()=>command('reverse_expense',{id:exp.id,reason:'again'},m.id),/unique constraint/);
 await rpc('change_stage',[m.id,tmpl.stages[1].key,'Test stage',null]);await command('add_number',{value:'2026/000184 E.',kind:'esas'},m.id);
 x=(await rpc('get_tracking_matter',[m.id])).matter;assert.equal(x.numbers[0].normalized,'2026/184');assert.equal(x.stageHistory.length,2);
 await command('add_party',{name:'Sentetik taraf',role:'Davacı',kind:'person'},m.id);
}));
test('client message and internal message commands derive sender and reject lost sharing; legacy upload facade remains closed',()=>isolated(async()=>{
 await actor(4);const dto=await rpc('client_message',[id(11),'Client synthetic message',id(99)]);assert.equal(dto.matter.messages.at(-1).role,'client');
 await actor(2);await command('add_message',{body:'Lawyer synthetic reply'});await rpc('share_matter',[id(11),id(10),false]);
 await actor(4);await deny(()=>rpc('client_message',[id(11),'blocked',null]),/shared_client_required/);
 await actor(2);await deny(()=>rpc('reserve_document',[id(11),'a.pdf','application/pdf',100]),/permission denied/);
}));
test('bulk archive rolls back an earlier valid archive when any later selected dossier has open work',()=>isolated(async()=>{
 await actor(2);const cat=await rpc('tracking_catalog'),tmpl=cat.templates.find(t=>t.key==='icra');const m=(await rpc('create_matter',[draft({subtype:tmpl.subtypes[0]}),null])).matter;
 await deny(()=>rpc('bulk_tracking',[[m.id,id(11)],'archive',{reason:'Synthetic batch close',closedOn:'2026-11-01'},id(100)]),/open_work_prevents/);
 assert.equal((await rpc('get_tracking_matter',[m.id])).matter.status,'active');
}));
test('safe cockpit view cannot expose lawyer JSON to clients or admin; empty arrays and invalid agenda cannot bypass checks',()=>isolated(async()=>{
 await actor(4);assert.equal((await rows('select * from lr_matter_cockpit')).length,0);
 await actor(1);assert.equal((await rows('select * from lr_matter_cockpit')).length,0);
 await actor(2);assert.equal((await rows('select * from lr_matter_cockpit')).length,1);
 await deny(()=>command('add_agenda',{kind:'hearing',title:'Bad end',startsAt:'2026-11-01T10:00:00Z',endsAt:null}),/explicit_timezone_required/);
 await deny(()=>rpc('add_proceeding',[id(11),{eventType:'diger',title:'x',occurredOn:'2026-11-01'},null,[],[],null]),/invalid_child_arrays/);
}));
test('identity and service-only delivery RPC grants survive tracking cutover without privilege escalation',()=>isolated(async()=>{
 await db.exec(`insert into auth.users values('${id(101)}','synthetic-new@example.invalid',now())`);await actor(101);
 const aid=await rpc('submit_application',['lawyer','Synthetic applicant','Fixture bar',null,null]);
 await deny(()=>rpc('review_application',[aid,true,null]),/admin_required/);
 await actor(1);await rpc('review_application',[aid,true,null]);await actor(101);
 assert.equal(await value('select status from lr_accounts where user_id=$1',[id(101)]),'active');
 await deny(()=>rpc('claim_notifications',[10]),/permission denied/);
 await db.exec('reset role;set local role service_role');assert.ok(Array.isArray(await rows('select * from lr_claim_notifications(10)')));
}));
test('suspending the relationship lawyer closes client access, new requests and notification recipients',()=>isolated(async()=>{
 await db.exec(`update lr_accounts set status='suspended' where user_id='${id(2)}'`);await actor(4);await deny(()=>rpc('get_tracking_matter',[id(11)]),/matter_access_denied/);
 await actor(3);await deny(()=>command('add_task',{title:'Not eligible',kind:'client_document_request',requestedClientId:id(4),sharedWithClient:true}),/accepted_request_client_required/);
 // Service delivery helper is not callable by clients; inspect only as fixture owner.
 await db.exec('reset role');assert.equal(await value('select lawroom_private.notification_allowed($1,$2)',[id(4),id(11)]),false);
}));
test('real UI controller→real adapter→PGlite named RPC calls preserve canonical proceeding and agenda contracts',()=>isolated(async()=>{
 await actor(2);const {repository,requests}=sqlAdapter(),controller=createTrackingWorkspaceController(repository,{userId:id(2),role:'lawyer',organizationId:id(8)});
 assert.equal(await controller.load(),true);assert.equal(await controller.open(id(11)),true);
 assert.equal(await controller.save('add_event',{eventType:'tebligat_alindi',title:'UI tebliğ',occurredOn:'2026-11-01',servedOn:'2026-11-01',serviceMethod:'Fixture',sourceReference:'Fixture',suggestion:'1',taskIndexes:[0,1],requestDeadlineReview:true}),true);
 assert.equal(controller.getSnapshot().selected.matter.events.at(-1).title,'UI tebliğ');assert.equal(controller.getSnapshot().selected.matter.deadlines.at(-1).status,'proposed');
 assert.equal(await controller.save('add_agenda',{kind:'hearing',title:'UI hearing',date:'2026-01-01',time:'10:00',startsAt:'2026-01-01T10:00:00+03:00',endsAt:'2026-01-01T11:00:00+03:00',sharedWithClient:false}),true);
 const aid=controller.getSnapshot().selected.matter.agendaItems.at(-1).id;
 assert.equal(await controller.save('hearing_outcome',{id:aid,result:'Ara karar',note:'UI result',tasks:[{title:'UI takip',dueOn:'2026-11-20'}],taskDue:'2026-11-20',nextDate:'2099-01-01',nextTime:'10:00',location:'UI location',nextHearing:{title:'UI next',startsAt:'2099-01-01T10:00:00+03:00',endsAt:'2099-01-01T11:00:00+03:00',location:'UI location'}}),true);
 assert.equal(controller.getSnapshot().selected.matter.agendaItems.find(a=>a.id===aid).status,'done');
 assert.ok(!('suggestion'in requests.find(r=>r.name==='lr_add_proceeding').args.p_event));controller.dispose();
}));
test('real client UI controller receives only server DTO and cannot write internal notes through adapter',()=>isolated(async()=>{
 await actor(4);const {repository,requests}=sqlAdapter(),controller=createTrackingWorkspaceController(repository,{userId:id(4),role:'client'});
 assert.equal(await controller.load(),true);assert.equal(await controller.open(id(11)),true);assert.ok(!JSON.stringify(controller.getSnapshot()).includes('INTERNAL_SENTINEL'));
 assert.equal(await controller.save('add_note',{body:'forged'}),false);assert.ok(!requests.some(r=>r.name==='lr_tracking_command'));
 await controller.load();await controller.open(id(11));assert.equal(await controller.save('add_message',{body:'Controller client message'}),true);assert.equal(controller.getSnapshot().selected.matter.messages.at(-1).role,'client');controller.dispose();
}));
test('version adapter exercises SQL reservation, Storage policy fixture, finalize and fresh download authorization',()=>isolated(async()=>{
 await actor(2);const {repository}=sqlAdapter(),file=new Blob(['synthetic PDF bytes'],{type:'application/pdf'});
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())).toString('hex');
 const reservation=await repository.reserveDocument(id(11),{name:'synthetic.pdf',sizeBytes:file.size,mediaType:file.type,sha256:hash});
 assert.equal((await repository.upload(reservation,file)).sha256Verified,false);
 assert.equal(await (await repository.download(reservation.versionId)).text(),'synthetic PDF bytes');
 await repository.shareDocument(reservation.documentId,true);await actor(4);assert.equal(await (await repository.download(reservation.versionId)).text(),'synthetic PDF bytes');
 await db.exec(`reset role;update lr_relationships set status='revoked' where id='${id(10)}'`);await actor(4);await deny(()=>repository.download(reservation.versionId),/document_download_denied/);
}));
