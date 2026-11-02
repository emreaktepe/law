/** Server-authorized DTO v2. Never turn a lawyer aggregate into a client response. */
const fail=()=>{throw new Error('Takip veri sözleşmesi doğrulanamadı.');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>{if(!object(x)||Object.keys(x).some(k=>!keys.includes(k)))fail();};
const list=(value,keys)=>{if(!Array.isArray(value))fail();for(const row of value)exact(row,keys);};
const clientKeys=['id','title','number','stage','summary','events','agendaItems','requests','messages','documents'];
const lawyerArrays=['clients','members','numbers','stageHistory','events','tasks','deadlines','agendaItems','parties','links','internalNotes','expenses','auditHistory','messages','documents'];
export function decodeTrackingDTO(input){
 exact(input,['schemaVersion','audience','matter']);
 if(input.schemaVersion!==2||!['lawyer','client'].includes(input.audience)||!object(input.matter)||typeof input.matter.id!=='string'||!input.matter.id)fail();
 const m=input.matter;
 if(input.audience==='client'){
  exact(m,clientKeys);if(clientKeys.some(k=>!(k in m)))fail();
  list(m.events,['id','title','occurredOn']);list(m.agendaItems,['id','kind','title','startsAt','endsAt','allDayDate','status']);
  list(m.requests,['id','title','dueOn','status']);list(m.messages,['id','body','role','createdAt']);
  list(m.documents,['id','name','category','shared','versions']);
  for(const d of m.documents)list(d.versions,['id','number','name','sizeBytes','mediaType','createdAt']);
  if(m.messages.some(x=>!['lawyer','client'].includes(x.role))||m.requests.some(x=>!['open','review'].includes(x.status)))fail();
  for(const key of ['title','stage','summary'])if(typeof m[key]!=='string')fail();
  if(m.number!==null&&typeof m.number!=='string')fail();
  for(const group of [m.events,m.agendaItems,m.requests,m.messages,m.documents])for(const row of group)if(typeof row.id!=='string')fail();
 }else{
  for(const key of lawyerArrays)if(!Array.isArray(m[key]))fail();
  if(typeof m.readonly!=='boolean'||!Number.isSafeInteger(m.revision)||typeof m.organizationId!=='string')fail();
  if(m.stageSnapshot!==null&&(!object(m.stageSnapshot)||!Array.isArray(m.stageSnapshot.stages)||m.stageSnapshot.unverified!==true||m.stageSnapshot.verifiedByLawyer!==false))fail();
 }
 return structuredClone(input);
}

/** Client rendering shape is already complete. It must bypass demo projections. */
export function clientTrackingDTO(input){
 const dto=decodeTrackingDTO(input);if(dto.audience!=='client')fail();return dto.matter;
}
