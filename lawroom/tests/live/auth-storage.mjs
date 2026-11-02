// Explicit opt-in only. Real Lawroom services; synthetic fixtures, verified cleanup.
// Never imported by the app or ordinary npm test. No SMTP delivery or new API key.
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createTrackingSupabaseRepository} from '../../src/data/trackingSupabaseRepository.js';
const ref='deezwydtiibbdtimxcxf',url=`https://${ref}.supabase.co`;
if(process.env.LAWROOM_LIVE_QA!==ref)throw Error('Explicit Lawroom live QA opt-in required');
const directory=new URL('../../.supabase/live/',import.meta.url);
const secretPath=new URL('e2e-server.json',directory);
const server=JSON.parse(await readFile(secretPath,'utf8'));
const claims=JSON.parse(Buffer.from(server.key.split('.')[1]||'','base64url').toString());
if(server.url!==url||claims.ref!==ref||claims.role!=='service_role')throw Error('Wrong server credential target');
await unlink(secretPath); // keep the existing credential in process memory only
const publicConfig=JSON.parse(await readFile(new URL('public-client.json',directory),'utf8'));
if(publicConfig.url!==url)throw Error('Wrong public client target');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,server.key,options),run=randomUUID();
const ledger={run,project:ref,users:[],organizations:[],matters:[],documents:[],objects:[],relationship:null};
const results=[],sessions=[],cleanupErrors=[];
const saveLedger=()=>writeFile(new URL('e2e-ledger.json',directory),JSON.stringify(ledger,null,2));
const safeError=e=>({code:String(e?.code||e?.statusCode||e?.status||'ASSERTION'),message:e?.name==='AssertionError'?'Expected authorization or byte equality failed':'Service operation failed'});
async function checked(query){const {data,error}=await query;if(error)throw error;return data;}
async function step(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,...safeError(error)});throw error;}}
async function denied(fn){let rejection;try{await fn();}catch(error){rejection=error;}assert.ok(rejection);assert.ok(rejection.code==='42501'||[401,403].includes(Number(rejection.status||rejection.statusCode)));}
async function createActor(label,role){
 const email=`lawroom-qa-${run}-${label}@example.invalid`;
 const user=await checked(admin.auth.admin.createUser({email,email_confirm:true,user_metadata:{lawroom_qa_run:run}}));
 const id=user.user.id;ledger.users.push(id);await saveLedger();
 const generated=await checked(admin.auth.admin.generateLink({type:'magiclink',email}));
 const client=createClient(url,publicConfig.key,options);
 const verified=await checked(client.auth.verifyOtp({token_hash:generated.properties.hashed_token,type:'email'}));
 assert.equal(verified.user.id,id);assert.ok(verified.session.access_token);
 const replay=await createClient(url,publicConfig.key,options).auth.verifyOtp({token_hash:generated.properties.hashed_token,type:'email'});assert.ok(replay.error);
 assert.equal((await checked(client.auth.getUser())).user.id,id);
 sessions.push(client);
 await checked(admin.from('lr_accounts').insert({user_id:id,display_name:'Sentetik QA '+label,role,status:'active'}));
 return{id,client,repository:createTrackingSupabaseRepository(client)};
}
async function upload(actor,mid,file,extra={}){
 const bytes=Buffer.from(await file.arrayBuffer());
 const reservation=await actor.repository.reserveDocument(mid,{name:file.name,mediaType:file.type,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),...extra});
 ledger.documents.push(reservation.documentId);ledger.objects.push(reservation.objectPath);await saveLedger();
 await actor.repository.upload(reservation,file);return reservation;
}
async function remove(table,column,ids){if(ids.length)await checked(admin.from(table).delete().in(column,[...new Set(ids)]));}
async function cleanup(){
 const attempt=async(label,fn)=>{try{await fn();}catch(error){cleanupErrors.push({operation:label,...safeError(error)});}};
 for(const client of sessions)await attempt('signout',async()=>{await checked(client.auth.signOut());});
 if(ledger.objects.length)await attempt('storage',()=>checked(admin.storage.from('lr-matter-files').remove(ledger.objects)));
 // Only IDs recorded from this run are ever deleted. No table-wide cleanup.
 await attempt('document_versions',()=>remove('lr_document_versions','document_id',ledger.documents));
 await attempt('documents',()=>remove('lr_documents','id',ledger.documents));
 for(const table of ['lr_tasks','lr_deadlines','lr_agenda_items','lr_stage_history','lr_matter_numbers','lr_internal_notes','lr_events','lr_messages','lr_expenses','lr_matter_clients','lr_matter_members'])await attempt(table,()=>remove(table,'matter_id',ledger.matters));
 await attempt('audit',()=>remove('lr_audit_events','actor_id',ledger.users));
 await attempt('outbox',()=>remove('lr_notification_outbox','recipient_id',ledger.users));
 await attempt('matters',()=>remove('lr_matters','id',ledger.matters));
 if(ledger.relationship)await attempt('relationship',()=>remove('lr_relationships','id',[ledger.relationship]));
 await attempt('memberships',()=>remove('lr_memberships','user_id',ledger.users));
 await attempt('organizations',()=>remove('lr_organizations','id',ledger.organizations));
 await attempt('referral_codes',()=>remove('lr_referral_codes','lawyer_id',ledger.users));
 await attempt('applications',()=>remove('lr_applications','applicant_id',ledger.users));
 await attempt('accounts',()=>remove('lr_accounts','user_id',ledger.users));
 for(const id of ledger.users)await attempt('auth-user',async()=>{
  const user=(await checked(admin.auth.admin.getUserById(id))).user;
  if(user.user_metadata?.lawroom_qa_run!==run)throw Error('Cleanup ownership mismatch');
  await checked(admin.auth.admin.deleteUser(id));
 });
 await attempt('verify-accounts',async()=>{if(ledger.users.length)assert.equal((await checked(admin.from('lr_accounts').select('user_id').in('user_id',ledger.users))).length,0);});
 await attempt('verify-matters',async()=>{if(ledger.matters.length)assert.equal((await checked(admin.from('lr_matters').select('id').in('id',ledger.matters))).length,0);});
 for(const id of ledger.users)await attempt('verify-auth-deleted',async()=>{const result=await admin.auth.admin.getUserById(id);assert.ok(result.error);});
 for(const path of ledger.objects)await attempt('verify-object-deleted',async()=>{const result=await admin.storage.from('lr-matter-files').download(path);assert.ok(result.error);});
}
let failure;
try{
 await step('empty-target-preflight',async()=>{
  for(const table of ['lr_accounts','lr_matters']){const {count,error}=await admin.from(table).select('*',{head:true,count:'exact'});if(error)throw error;assert.equal(count,0);}
  const users=await checked(admin.auth.admin.listUsers({page:1,perPage:1}));assert.equal(users.users.length,0);
 });
 let owner,client,viewer,other,mid,reservation,request;
 await step('real-magic-link-auth-issued-sessions',async()=>{owner=await createActor('owner','lawyer');client=await createActor('client','client');viewer=await createActor('viewer','lawyer');other=await createActor('other','lawyer');});
 await step('organization-and-relationship-fixtures',async()=>{
  for(const name of ['qa-main','qa-other']){const id=randomUUID();ledger.organizations.push(id);await saveLedger();await checked(admin.from('lr_organizations').insert({id,name:`${name}-${run}`,kind:'firm',status:'active'}));}
  await checked(admin.from('lr_memberships').insert([{organization_id:ledger.organizations[0],user_id:owner.id,role:'owner',active:true},{organization_id:ledger.organizations[0],user_id:viewer.id,role:'lawyer',active:true},{organization_id:ledger.organizations[1],user_id:other.id,role:'owner',active:true}]));
  ledger.relationship=randomUUID();await saveLedger();await checked(admin.from('lr_relationships').insert({id:ledger.relationship,organization_id:ledger.organizations[0],lawyer_id:owner.id,client_id:client.id,status:'accepted'}));
 });
 await step('real-rpc-create-idempotency-and-private-client-default',async()=>{
  const payload={organizationId:ledger.organizations[0],type:'icra',subtype:'İlamsız takip',title:`Sentetik HTTP QA ${run}`,stageKey:'hazirlik',clientMode:'none'},key=randomUUID();
  const dto=await owner.repository.create(payload,key);mid=dto.matter.id;ledger.matters.push(mid);await saveLedger();assert.equal((await owner.repository.create(payload,key)).matter.id,mid);
  await owner.repository.command(mid,'add_note',{body:'HTTP_PRIVATE_SENTINEL'},randomUUID());
  await denied(()=>client.repository.get(mid));await denied(()=>other.repository.get(mid));
 });
 await step('accepted-relationship-does-not-share-until-explicit-share',async()=>{
  await checked(admin.from('lr_matter_clients').insert({matter_id:mid,organization_id:ledger.organizations[0],relationship_id:ledger.relationship,shared:false}));
  await denied(()=>client.repository.get(mid));
  await checked(owner.client.rpc('lr_share_matter',{p_matter:mid,p_relationship:ledger.relationship,p_shared:true}));
  const dto=await client.repository.get(mid);assert.equal(dto.audience,'client');assert.ok(!JSON.stringify(dto).includes('HTTP_PRIVATE_SENTINEL'));assert.ok(!('tasks'in dto.matter));
 });
 await step('viewer-readonly-and-unrelated-organization-denial',async()=>{
  await checked(admin.from('lr_matter_members').insert({matter_id:mid,organization_id:ledger.organizations[0],user_id:viewer.id,role:'viewer'}));
  assert.equal((await viewer.repository.get(mid)).matter.readonly,true);await denied(()=>viewer.repository.command(mid,'add_note',{body:'blocked'},randomUUID()));await denied(()=>other.repository.get(mid));
 });
 const original=new File(['%PDF-1.4\nSynthetic Lawroom HTTP bytes\n%%EOF'],'qa.pdf',{type:'application/pdf'});
 await step('real-storage-upload-finalize-owner-byte-equality',async()=>{reservation=await upload(owner,mid,original);assert.equal(await(await owner.repository.download(reservation.versionId)).text(),await original.text());});
 await step('unshared-document-denied-then-explicit-share-allows-client-bytes',async()=>{
  await denied(()=>client.repository.download(reservation.versionId));await owner.repository.shareDocument(reservation.documentId,true);
  assert.equal(await(await client.repository.download(reservation.versionId)).text(),await original.text());
  const dto=await client.repository.get(mid);assert.ok(!JSON.stringify(dto).includes(reservation.objectPath));assert.ok(!JSON.stringify(dto).includes('sha256'));
 });
 await step('signed-url-overwrite-and-delete-remain-denied',async()=>{
  assert.ok((await client.client.storage.from('lr-matter-files').createSignedUrl(reservation.objectPath,60)).error);
  assert.ok((await owner.client.storage.from('lr-matter-files').upload(reservation.objectPath,new Blob(['changed']),{upsert:true,contentType:'application/pdf'})).error);
  await owner.client.storage.from('lr-matter-files').remove([reservation.objectPath]);
  assert.equal(await(await owner.repository.download(reservation.versionId)).text(),await original.text());
 });
 await step('second-version-keeps-first-version-bytes',async()=>{
  const second=new File(['%PDF-1.4\nSecond synthetic version\n%%EOF'],'qa.pdf',{type:'application/pdf'});
  const next=await upload(owner,mid,second,{documentId:reservation.documentId});assert.notEqual(next.objectPath,reservation.objectPath);
  assert.equal(await(await owner.repository.download(reservation.versionId)).text(),await original.text());assert.equal(await(await owner.repository.download(next.versionId)).text(),await second.text());
 });
 await step('client-request-upload-requires-explicit-target-and-enters-review',async()=>{
  const dto=await owner.repository.command(mid,'add_task',{title:'QA belge talebi',kind:'client_document_request',sharedWithClient:true,requestedClientId:client.id},randomUUID());
  request=dto.matter.tasks.find(t=>t.title==='QA belge talebi');assert.ok(request);
  const file=new File(['%PDF-1.4\nRequested synthetic bytes\n%%EOF'],'client-qa.pdf',{type:'application/pdf'});
  await upload(client,mid,file,{requestTaskId:request.id});
  assert.equal((await owner.repository.get(mid)).matter.tasks.find(t=>t.id===request.id).status,'review');
 });
 await step('relationship-revocation-denies-rpc-and-known-storage-path',async()=>{
  await checked(admin.from('lr_relationships').update({status:'revoked'}).eq('id',ledger.relationship));await denied(()=>client.repository.get(mid));
  assert.ok((await client.client.storage.from('lr-matter-files').download(reservation.objectPath)).error);
 });
 await step('membership-revocation-denies-viewer-immediately',async()=>{await checked(admin.from('lr_memberships').update({active:false}).eq('user_id',viewer.id));await denied(()=>viewer.repository.get(mid));});
}catch(error){failure=safeError(error);}
finally{
 await cleanup();
 const report={project:ref,run,results,failure:failure||null,cleanupPassed:cleanupErrors.length===0,cleanupErrors,limitations:['No SMTP delivery or PKCE browser exchange tested','No Realtime application subscription is enabled or claimed','Admin denial was previously tested in rollback DB role acceptance']};
 await writeFile(new URL('auth-storage-report.json',directory),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(failure||cleanupErrors.length)process.exitCode=1;
}
