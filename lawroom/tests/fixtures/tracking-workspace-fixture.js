import {EXPECTED_SUPABASE_ORIGIN} from '../../src/domain/project-identity.js';
import {createMatterStageSnapshot} from '../../src/domain/stages.js';

export const fixtureIds=Object.freeze({lawyer:'10000000-0000-4000-8000-000000000001',client:'10000000-0000-4000-8000-000000000002',org:'10000000-0000-4000-8000-000000000003',matter:'10000000-0000-4000-8000-000000000004',other:'10000000-0000-4000-8000-000000000005'});
export function lawyerFixture(id=fixtureIds.matter){
 const template=createMatterStageSnapshot('icra');
 return {schemaVersion:2,audience:'lawyer',matter:{id,organizationId:fixtureIds.org,title:'Sentetik takip dosyası',type:template.label,subtype:template.subtypes[0],number:'2026/184 E.',court:'Sentetik daire',stage:template.stages[0].label,stageKey:template.stages[0].key,stageSnapshot:template,templateVersion:template.version,status:'active',priority:'normal',internalRef:'INTERNAL_ONLY_SENTINEL',responsibleId:fixtureIds.lawyer,responsibleName:'Sentetik Avukat',nextAction:null,targetDate:null,summary:'Paylaşılan sentetik açıklama',archivedAt:null,closedReason:null,closedOn:null,createdAt:'2026-11-01T09:00:00Z',lastActivityAt:'2026-11-01T09:00:00Z',revision:1,readonly:false,shared:true,
  clients:[{id:fixtureIds.client,name:'Sentetik Müvekkil',shared:true}],members:[{userId:fixtureIds.lawyer,role:'responsible',name:'Sentetik Avukat',active:true}],numbers:[],stageHistory:[],events:[],tasks:[],deadlines:[],agendaItems:[],parties:[],links:[],internalNotes:[{id:'private-note',body:'INTERNAL_ONLY_SENTINEL'}],expenses:[],auditHistory:[],messages:[],documents:[]}};
}
export function clientFixture(id=fixtureIds.matter){return {schemaVersion:2,audience:'client',matter:{id,title:'Paylaşılan sentetik dosya',number:'2026/184 E.',stage:'Takibe hazırlanılıyor',summary:'Sizinle paylaşılan açıklama.',events:[{id:'shared-event',title:'Paylaşılan gelişme',occurredOn:'2026-11-01'}],agendaItems:[],requests:[],messages:[],documents:[]}};}

/** In-memory RPC boundary for tests ONLY. No fetch, Auth, URL change or storage.
 * It is deliberately outside src and never imported by the published app.
 */
export function createTrackingFixtureClient({role='lawyer',matters=[role==='client'?clientFixture():lawyerFixture()]}={}){
 let records=structuredClone(matters),failure=null,persistentFailure=null,afterCommitFailure=null,hold=null;
 const requests=[],keys=new Map();
 const client={supabaseUrl:EXPECTED_SUPABASE_ORIGIN,async rpc(name,args={}){
  requests.push({name,args:structuredClone(args)});
  if(hold){const gate=hold;hold=null;await gate;}
  if(persistentFailure)return{data:null,error:persistentFailure};
  if(failure){const error=failure;failure=null;return{data:null,error};}
  const row=records.find(dto=>dto.matter.id===args.p_matter);
  const payloadKeys={lr_add_proceeding:['eventType','title','occurredOn','note','servedOn','serviceMethod','sourceReference','sourceDocumentId','correctsEventId','correctionReason','shared','clientSummary'],lr_record_hearing_outcome:['id','result','note','tasks','nextHearing','shared','clientSummary']};
  const payload=name==='lr_add_proceeding'?args.p_event:args.p_payload;
  if(payloadKeys[name]&&Object.keys(payload||{}).some(key=>!payloadKeys[name].includes(key)))return{data:null,error:{code:'22023',message:'unsupported_payload_fields'}};
  let data;
  if(name==='lr_list_tracking_matters')data=records;
  else if(name==='lr_get_tracking_matter'){
   if(!row)return{data:null,error:{code:'42501',message:'synthetic denial'}};data=row;
  }else if(name==='lr_tracking_catalog')data={templates:[createMatterStageSnapshot('icra')],eventTypes:[],approvedDeadlineRules:[],holidayCalendarComplete:false};
  else if(name==='lr_create_matter'){
   if(args.p_key&&keys.has(args.p_key))data=keys.get(args.p_key);
   else{const next=lawyerFixture('10000000-0000-4000-8000-'+String(10+requests.length).padStart(12,'0')),p=args.p;
    Object.assign(next.matter,{title:p.title,subtype:p.subtype,number:p.number||'',court:p.court||'',stageKey:p.stageKey,shared:false,clients:[]});records.push(next);data=next;
    if(args.p_key)keys.set(args.p_key,structuredClone(data));
    if(afterCommitFailure){const error=afterCommitFailure;afterCommitFailure=null;return{data:null,error};}
   }
  }
  else if(['lr_tracking_command','lr_client_message','lr_add_proceeding','lr_verify_deadline','lr_record_hearing_outcome','lr_change_stage','lr_close_matter'].includes(name)){
   if(!row)return{data:null,error:{code:'42501',message:'synthetic denial'}};
   if(args.p_key&&keys.has(args.p_key))data=keys.get(args.p_key);
   else{
    const next=structuredClone(row),m=next.matter,p=args.p_payload||{};
    if(role==='client'&&name!=='lr_client_message')return{data:null,error:{code:'42501',message:'synthetic client write denied'}};
    if(name==='lr_client_message')m.messages.push({id:'fixture-message-'+requests.length,body:args.p_body,role:'client',createdAt:'2026-11-01T10:00:00Z'});
    else if(args.p_command==='add_note')m.internalNotes.push({id:'fixture-note-'+requests.length,body:p.body});
    else if(args.p_command==='add_task')m.tasks.push({id:'fixture-task-'+requests.length,title:p.title,status:'open',priority:'normal',kind:'work',assigneeId:fixtureIds.lawyer});
    else if(args.p_command==='reopen'){m.status='active';m.archivedAt=null;m.readonly=false;}
    else if(name==='lr_close_matter'){m.status='archived';m.archivedAt='2026-11-01T10:00:00Z';m.readonly=true;}
    else if(name==='lr_add_proceeding')m.events.push({id:'fixture-event-'+requests.length,...args.p_event,createdAt:'2026-11-01T10:00:00Z'});
    else return{data:null,error:{code:'LR_FIXTURE_UNSUPPORTED',message:'Fixture command not implemented'}};
    if(role==='lawyer')m.revision+=1;
    records=records.map(old=>old.matter.id===m.id?next:old);data=next;
    if(args.p_key)keys.set(args.p_key,structuredClone(data));
    if(afterCommitFailure){const error=afterCommitFailure;afterCommitFailure=null;return{data:null,error};}
   }
  }else return{data:null,error:{code:'LR_FIXTURE_UNSUPPORTED',message:'Fixture RPC not implemented: '+name}};
  return{data:structuredClone(data),error:null};
 }};
 return{client,requests,
  failNext(error={code:'NETWORK',message:'synthetic offline'}){failure=error;},
  alwaysFail(error){persistentFailure=error;},
  loseNextMutationReply(){afterCommitFailure={code:'NETWORK',message:'synthetic lost response after commit'};},
  holdNext(){let resolve;hold=new Promise(done=>{resolve=done;});return resolve;},
  setMatters(next){records=structuredClone(next);},
  inspect(){return structuredClone(records);},
 };
}
