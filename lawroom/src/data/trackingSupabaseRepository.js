import {decodeTrackingDTO} from '../domain/tracking-contract.js';
import {getProceedingType,buildProceedingSuggestions} from '../domain/events.js';
import {isExpectedSupabaseUrl} from '../domain/project-identity.js';

/** Prepared live adapter. Activation requires baseline + Auth/Storage/RLS E2E.
 * All mutations use RPCs. Actor, role, organization authorization and audience
 * come from authenticated Postgres checks, never demo context or user metadata.
 */
export function createTrackingSupabaseRepository(client){
 if(!client||typeof client.rpc!=='function'||!isExpectedSupabaseUrl(client.supabaseUrl))throw new Error('Doğru Lawroom Supabase istemcisi gerekli.');
 const call=async(name,args={})=>{const {data,error}=await client.rpc('lr_'+name,args);if(error)throw error;return data;};
 const key=value=>value||crypto.randomUUID();
 const dto=async(name,args)=>decodeTrackingDTO(await call(name,args));
 const command=(matterId,type,payload={},commandKey)=>dto('tracking_command',{p_matter:matterId,p_command:type,p_payload:payload,p_key:key(commandKey)});
 return Object.freeze({
  async list(){const data=await call('list_tracking_matters');if(!Array.isArray(data))throw new Error('Dosya listesi doğrulanamadı.');return data.map(decodeTrackingDTO);},
  get:matterId=>dto('get_tracking_matter',{p_matter:matterId}),
  catalog:()=>call('tracking_catalog'),
  create:(input,commandKey)=>dto('create_matter',{p:input,p_key:key(commandKey)}),
  command,
  async addProceeding(matter,input,commandKey){
   const definition=getProceedingType(input.eventType);if(!definition)throw new Error('Safahat türü gerekli.');
   const suggestions=buildProceedingSuggestions({eventType:input.eventType,matterType:matter.type}),indexes=input.taskIndexes||[];
   if(!Array.isArray(indexes)||indexes.some(i=>!Number.isInteger(i)||!suggestions.tasks[i]))throw new Error('Görev önerisi geçersiz.');
   const {taskIndexes,requestDeadlineReview,proposedDueAt,...event}=input;
   return dto('add_proceeding',{p_matter:matter.id,p_event:{...event,title:input.title||definition.label},
    p_tasks:[...new Set(indexes)].map(i=>suggestions.tasks[i]),p_deadlines:requestDeadlineReview?[{title:'Tebliğden doğan süreyi incele',proposedDueAt:proposedDueAt||null}]:[],p_agenda:[],p_key:key(commandKey)});
  },
  verifyDeadline:(matterId,payload,commandKey)=>dto('verify_deadline',{p_matter:matterId,p_payload:payload,p_key:key(commandKey)}),
  hearingOutcome:(matterId,payload,commandKey)=>dto('record_hearing_outcome',{p_matter:matterId,p_payload:payload,p_key:key(commandKey)}),
  changeStage:(matterId,stage,note,commandKey)=>dto('change_stage',{p_matter:matterId,p_stage:stage,p_note:note,p_key:key(commandKey)}),
  close:(matterId,reason,closedOn,commandKey)=>dto('close_matter',{p_matter:matterId,p_reason:reason,p_closed_on:closedOn,p_key:key(commandKey)}),
  bulk:(ids,type,payload,commandKey)=>call('bulk_tracking',{p_matters:ids,p_command:type,p_payload:payload,p_key:key(commandKey)}),
  import:(organizationId,rows,commandKey)=>call('import_tracking',{p_organization:organizationId,p_rows:rows,p_key:key(commandKey)}),
  undoImport:(batchId,commandKey)=>call('undo_tracking_import',{p_batch:batchId,p_key:key(commandKey)}),
  savedView:(type,id=null,payload={})=>call('saved_view',{p_command:type,p_id:id,p_payload:payload}),
  link:(matterId,otherId,kind,commandKey)=>dto('link_tracking',{p_matter:matterId,p_other:otherId,p_kind:kind,p_key:key(commandKey)}),
  derive:(matterId,input,kind,commandKey)=>dto('derive_tracking',{p_matter:matterId,p_payload:input,p_kind:kind,p_key:key(commandKey)}),
  sendClientMessage:(matterId,body,commandKey)=>dto('client_message',{p_matter:matterId,p_body:body,p_key:key(commandKey)}),
  reserveDocument:(matterId,input)=>call('reserve_tracking_document',{p_matter:matterId,p_payload:input}),
  finalizeDocument:versionId=>call('finalize_tracking_document',{p_version:versionId}),
  shareDocument:(documentId,shared)=>call('share_document',{p_document:documentId,p_shared:shared}),
  async upload(reservation,file){
   if(reservation.bucket!=='lr-matter-files'||!reservation.objectPath||!(file instanceof Blob))throw new Error('Yükleme rezervasyonu gerekli.');
   const {error}=await client.storage.from(reservation.bucket).upload(reservation.objectPath,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(error)throw error;
   return call('finalize_tracking_document',{p_version:reservation.versionId});
  },
  async download(versionId){
   const path=await call('tracking_document_path',{p_version:versionId});
   // Authenticated GET rechecks live RLS on EVERY request. Never createSignedUrl.
   const {data,error}=await client.storage.from('lr-matter-files').download(path);if(error)throw error;return data;
  },
 });
}
