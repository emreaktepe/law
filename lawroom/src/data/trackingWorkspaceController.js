import { decodeTrackingDTO } from '../domain/tracking-contract.js';
import { trackingCommandPayload, trackingCreatePayload, pickTrackingFields } from '../domain/tracking-ui-contract.js';

const freeze = value => { if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);} return value; };
const contractError=()=>Object.assign(new Error('Takip verisi hesabınızla uyuşmuyor.'),{code:'TRACKING_CONTRACT'});
function failure(error){
  const code=String(error?.code||error?.status||'');
  if(['42501','401','403','PGRST301'].includes(code))return{kind:'access',message:'Bu dosyaya erişiminiz değişti. Çalışma alanını yeniden yükleyin.'};
  if(['42883','PGRST202','PGRST205'].includes(code))return{kind:'setup',message:'Yeni dosya takibi sunucuda henüz hazır değil. Kurulum tamamlandıktan sonra yeniden deneyin.'};
  if(code==='TRACKING_CONTRACT'||/sözleşmesi doğrulanamadı/.test(error?.message||''))return{kind:'contract',message:'Sunucudan gelen dosya bilgisi doğrulanamadı. İçerik güvenli biçimde kapatıldı.'};
  if(code==='TRACKING_INPUT')return{kind:'validation',message:error.message};
  if(code==='P0001'||code==='23514'||code==='22P02')return{kind:'validation',message:'Bilgileri ve dosyanın güncel durumunu kontrol edin. İşlem kaydedilmedi.'};
  return{kind:'network',message:'Bağlantı kurulamadı. Girdiğiniz bilgiler korunuyor; aynı işlemi yeniden deneyebilirsiniz.'};
}

/** No browser persistence, raw tables, guessed role or demo fallback. */
export function createTrackingWorkspaceController(repository,{userId,role,organizationId,makeId=()=>crypto.randomUUID()}){
  if(!repository||!userId||!['lawyer','client'].includes(role))throw new Error('Doğrulanmış avukat veya müvekkil oturumu gerekli.');
  let state=freeze({status:'idle',items:[],selected:null,error:null,canRetry:false}),epoch=0,disposed=false,lastOperation=null,pendingMutation=null,pendingUpload=null;
  const listeners=new Set();
  const publish=patch=>{if(disposed)return;state=freeze({...state,...patch});for(const listener of listeners)listener();};
  function authorized(value){const dto=decodeTrackingDTO(value);if(dto.audience!==role)throw contractError();return dto;}
  async function run(status,operation,{clear=false,clearSelection=false}={}){
    if(disposed)return false;
    const token=++epoch,active=()=>!disposed&&token===epoch;
    publish({status,error:null,canRetry:false,...(clear?{items:[],selected:null}:clearSelection?{selected:null}:{})});
    try{const patch=await operation(active);if(!active())return false;publish({status:'ready',error:null,canRetry:false,...patch});return true;}
    catch(error){if(!active())return false;const info=failure(error),fatal=['access','contract','setup'].includes(info.kind);
      if(fatal){lastOperation=null;pendingMutation=null;pendingUpload=null;}
      publish({status:info.kind==='access'||info.kind==='contract'?'access-denied':info.kind==='setup'?'setup-required':'error',error:info,canRetry:info.kind==='network',...(fatal?{items:[],selected:null}:{})});return false;}
  }
  function update(dto,expectedId){const selected=authorized(dto);if(expectedId&&selected.matter.id!==expectedId)throw contractError();const exists=state.items.some(x=>x.matter.id===selected.matter.id);return{selected,items:exists?state.items.map(x=>x.matter.id===selected.matter.id?selected:x):[...state.items,selected]};}
  function remember(operation){lastOperation=operation;return operation();}
  function mutate(label,payload,operation,{newMatter=false}={}){
    if(disposed||state.status==='saving')return Promise.resolve(false);
    const sourceId=state.selected?.matter.id,fingerprint=JSON.stringify([sourceId,label,payload]),commandKey=pendingMutation?.fingerprint===fingerprint?pendingMutation.key:makeId();
    pendingMutation={fingerprint,key:commandKey};
    return remember(()=>run('saving',async active=>{const dto=await operation(commandKey,active);if(!active())return{};const patch=update(dto,newMatter?null:sourceId);pendingMutation=null;return patch;}));
  }
  const api={
    getSnapshot:()=>state,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    load(){return remember(()=>run('loading',async()=>{const rows=await repository.list();if(!Array.isArray(rows))throw contractError();const items=rows.map(authorized);if(new Set(items.map(x=>x.matter.id)).size!==items.length)throw contractError();return{items,selected:null};},{clear:true}));},
    open(id){return remember(()=>run('loading-detail',async()=>{const selected=authorized(await repository.get(id));if(selected.matter.id!==id)throw contractError();return{selected};},{clearSelection:true}));},
    save(type,input={}){
      const matter=state.selected?.matter;if(!matter)return Promise.resolve(false);
      return mutate(type,input,async key=>{
        const p=trackingCommandPayload(type,input);
        if(role==='client'){if(type!=='add_message')throw Object.assign(new Error(),{code:'42501'});return repository.sendClientMessage(matter.id,p.body,key);}
        if(type==='add_event')return repository.addProceeding(matter,p,key);
        if(type==='verify_deadline')return repository.verifyDeadline(matter.id,p,key);
        if(type==='hearing_outcome')return repository.hearingOutcome(matter.id,p,key);
        if(type==='change_stage')return repository.changeStage(matter.id,p.stageKey,p.note,key);
        if(type==='archive')return repository.close(matter.id,p.reason,p.closedOn,key);
        return repository.command(matter.id,type,p,key);
      });
    },
    create(input){return mutate('create',input,key=>{if(role!=='lawyer')throw Object.assign(new Error(),{code:'42501'});return repository.create(trackingCreatePayload(input,organizationId),key);},{newMatter:true});},
    link(otherId,kind){const id=state.selected?.matter.id;if(!id)return Promise.resolve(false);return mutate('link',{otherId,kind},key=>{if(role!=='lawyer')throw Object.assign(new Error(),{code:'42501'});return repository.link(id,otherId,kind,key);});},
    derive(input){const id=state.selected?.matter.id;if(!id)return Promise.resolve(false);return mutate('derive',input,key=>{if(role!=='lawyer')throw Object.assign(new Error(),{code:'42501'});const{linkKind,...payload}=input;const p=trackingCreatePayload({...payload,clientMode:'none'},organizationId);delete p.organizationId;return repository.derive(id,p,linkKind,key);},{newMatter:true});},
    upload(file,input={}){
      const matterId=state.selected?.matter.id;if(!matterId)return Promise.resolve(false);
      return mutate('document_upload',{matterId,name:file?.name,size:file?.size,...input},async(_key,active)=>{
        if(!(file instanceof Blob)||!file.size||file.size>20971520)throw Object.assign(new Error('En fazla 20 MB belge yükleyin.'),{code:'TRACKING_INPUT'});
        const bytes=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes),sha256=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
        if(!active())return null;
        const metadata={name:file.name,mediaType:file.type||'application/octet-stream',sizeBytes:file.size,sha256};
        if(role==='client'){if(!input.requestId)throw Object.assign(new Error('Açık belge talebi seçin.'),{code:'TRACKING_INPUT'});metadata.requestTaskId=input.requestId;}
        else Object.assign(metadata,pickTrackingFields(input,['documentId','category','sourceEventId']));
        const uploadKey=JSON.stringify([matterId,metadata]);
        const reservation=pendingUpload?.key===uploadKey?pendingUpload.reservation:await repository.reserveDocument(matterId,metadata);
        if(!active())return null;pendingUpload={key:uploadKey,reservation};
        try{await repository.upload(reservation,file);}catch(error){
          if(String(error?.status||error?.statusCode)==='409'&&repository.finalizeDocument)await repository.finalizeDocument(reservation.versionId);else throw error;
        }
        if(!active())return null;
        const result=await repository.get(matterId);pendingUpload=null;return result;
      });
    },
    shareDocument(id,shared){const matterId=state.selected?.matter.id;if(!matterId)return Promise.resolve(false);return mutate('share_document',{id,shared},async()=>{if(role!=='lawyer')throw Object.assign(new Error(),{code:'42501'});await repository.shareDocument(id,shared);return repository.get(matterId);});},
    async download(versionId){
      if(disposed||!state.selected)return null;const token=epoch;
      if(!state.selected.matter.documents.some(d=>d.versions.some(v=>v.id===versionId)))throw new Error('Belge sürümü açık dosyada bulunamadı. Dosyayı yeniden yükleyin.');
      try{const blob=await repository.download(versionId);return!disposed&&token===epoch?blob:null;}
      catch(error){const info=failure(error);if(!disposed&&token===epoch)publish({status:['access','contract'].includes(info.kind)?'access-denied':'error',error:info,canRetry:false,...(['access','contract'].includes(info.kind)?{items:[],selected:null}:{})});throw new Error(info.message);}
    },
    retry(){return lastOperation?lastOperation():api.load();},
    back(){++epoch;lastOperation=null;pendingMutation=null;pendingUpload=null;publish({status:'ready',selected:null,error:null,canRetry:false});},
    dispose(){disposed=true;++epoch;listeners.clear();lastOperation=null;pendingMutation=null;pendingUpload=null;state=freeze({status:'idle',items:[],selected:null,error:null,canRetry:false});},
  };
  return Object.freeze(api);
}
