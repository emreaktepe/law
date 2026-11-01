import {normalizeMatterNumber,normalizeSearchText} from '../lib/normalize.js';
import {rankAttention,isVerifiedDeadline} from './attention.js';

const collator=new Intl.Collator('tr',{numeric:true,sensitivity:'base'});
const orderText=(a,b)=>collator.compare(String(a??''),String(b??''));
const text=value=>typeof value==='string'?value:'';
const array=value=>Array.isArray(value)?value:[];
const validDate=value=>{
  if(typeof value!=='string')return Infinity;
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if(match){const [y,m,d]=match.slice(1).map(Number),n=Date.UTC(y,m-1,d),dt=new Date(n);return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?n:Infinity}
  if(!/(?:Z|[+-]\d{2}:\d{2})$/u.test(value))return Infinity;
  const n=Date.parse(value);return Number.isFinite(n)?n:Infinity;
};
const isOpen=task=>!task.done&&!task.completedAt&&!task.completed_at&&(!task.status||task.status==='open');

/** Normalize view fields only. This is not an authorization filter. */
export function matterViewRecord(matter){
  const deadlines=array(matter.deadlines).map(d=>({...d,verifiedDueAt:d.verifiedDueAt??d.verified_due_at,proposedDueAt:d.proposedDueAt??d.proposed_due_at,
    verifiedBy:d.verifiedBy??d.verified_by,verifiedAt:d.verifiedAt??d.verified_at,legalBasis:d.legalBasis??d.legal_basis,sourceReference:d.sourceReference??d.source_reference,
    ruleVersion:d.ruleVersion??d.rule_version,triggerDate:d.triggerDate??d.trigger_date,serviceMethod:d.serviceMethod??d.service_method}));
  return {...matter,type:matter.type??matter.matter_type??'',subtype:matter.subtype??'',stageKey:matter.stageKey??matter.stage_key??matter.stage??'',
    status:matter.status??(matter.archivedAt||matter.archived_at?'archived':'active'),archivedAt:matter.archivedAt??matter.archived_at,
    responsibleId:matter.responsibleId??matter.owner_id??'',responsibleName:matter.responsibleName??matter.owner_name??'',
    targetDate:matter.targetDate??matter.target_date??matter.due??'',nextAction:matter.nextAction??matter.next_action??matter.next??'',
    lastActivityAt:matter.lastActivityAt??matter.last_activity_at??null,createdAt:matter.createdAt??matter.created_at??null,
    tasks:array(matter.tasks).map(t=>({...t,dueOn:t.dueOn??t.due_on,completedAt:t.completedAt??t.completed_at})),deadlines,
    agendaItems:array(matter.agendaItems??matter.agenda_items).map(a=>({...a,startsAt:a.startsAt??a.starts_at,endsAt:a.endsAt??a.ends_at,allDayDate:a.allDayDate??a.all_day_date,outcomeEventId:a.outcomeEventId??a.outcome_event_id})),
    messages:array(matter.messages).map(m=>({...m,createdAt:m.createdAt??m.created_at})),
  };
}

/** Defensive display DTO only; row authorization still belongs to repository/RLS. */
export function projectMatterListForRole(matters,role){
  if(role==='admin')return[];
  if(role!=='client')return matters;
  return matters.filter(m=>m.shared!==false).map(m=>({id:m.id,title:m.title,type:m.type??m.matter_type,subtype:m.subtype,number:m.number,reference:m.reference,numbers:array(m.numbers).map(n=>typeof n==='string'?n:{id:n.id,value:n.value,kind:n.kind,authority:n.authority,isPrimary:n.isPrimary??n.is_primary}),court:m.court,
    stage:m.stage,stageKey:m.stageKey??m.stage_key,status:m.status,archivedAt:m.archivedAt??m.archived_at,clientSummary:m.clientSummary??m.client_summary??m.summary,
    tasks:array(m.tasks).filter(t=>t.sharedWithClient===true||t.shared_with_client===true).map(t=>({id:t.id,title:t.title,dueOn:t.dueOn??t.due_on,status:t.status,done:t.done,completedAt:t.completedAt??t.completed_at})),
    agendaItems:array(m.agendaItems??m.agenda_items).filter(a=>a.sharedWithClient===true||a.shared_with_client===true).map(a=>({id:a.id,kind:a.kind,title:a.title,startsAt:a.startsAt??a.starts_at,endsAt:a.endsAt??a.ends_at,allDayDate:a.allDayDate??a.all_day_date,status:a.status,outcomeEventId:a.outcomeEventId??a.outcome_event_id})),
    deadlines:[],messages:[],shared:true,
  }));
}

/** Compute a next step from open items. Manual working targets are a fallback. */
export function computeNextStep(matter,now,attentionHint=undefined){
  const record=matterViewRecord(matter),items=[];
  for(const t of record.tasks.filter(isOpen))items.push({id:t.id??null,kind:'task',title:text(t.title)||'Görevi incele',dueAt:t.dueOn??null,unverified:false});
  for(const d of record.deadlines.filter(d=>['proposed','verified','invalidated','missed'].includes(d.status))){
    const proof=isVerifiedDeadline(d)&&validDate(d.verifiedDueAt)!==Infinity;
    items.push({id:d.id??null,kind:'deadline',title:proof?'Doğrulanmış süreyi takip et':'Süre önerisini doğrula',dueAt:proof?d.verifiedDueAt:(d.proposedDueAt??d.verifiedDueAt??null),unverified:!proof});
  }
  for(const a of record.agendaItems.filter(a=>!a.status||a.status==='planned'))items.push({id:a.id??null,kind:a.kind??'agenda',title:text(a.title)||'Takvim kaydını incele',dueAt:a.startsAt??a.allDayDate??null,unverified:false});
  const attention=attentionHint===undefined?(rankAttention([record],now)[0]??null):attentionHint;
  const critical=attention&&attention.tier<=3?items.find(i=>i.id!==null&&i.id===attention.sourceId):null;
  items.sort((a,b)=>validDate(a.dueAt)-validDate(b.dueAt));
  const item=critical??items[0]??(record.nextAction||record.targetDate?{id:null,kind:'manual',title:record.nextAction||'Çalışma hedefini incele',dueAt:record.targetDate||null,unverified:false}:null);
  return item?{...item,attention,reason:(attention?.sourceId===item.id?attention?.reason:null)??(item.kind==='manual'?'Çalışma hedefi; hukuki süre değildir':'Açık işler içindeki sıradaki adım')}:null;
}

export const defaultMatterView=Object.freeze({query:'',types:[],subtypes:[],stages:[],courts:[],responsibleIds:[],clientIds:[],statuses:['active','on_hold'],attentionTiers:[],shared:'all',unverified:'all',groupBy:'none',sortBy:'attention',density:'comfortable'});

/** Prepare once per repository result so typing does not rebuild the search index. */
export function prepareMatterRows(matters,now){
  const records=matters.map(matterViewRecord);
  const attention=new Map(rankAttention(records,now).map(a=>[a.matterId,a]));
  return records.map((matter,index)=>{
    const original=matters[index];
    const numbers=[matter.reference,matter.number,...array(matter.numbers).map(n=>typeof n==='string'?n:n.value)].filter(Boolean);
    const clients=array(matter.clients).map(c=>typeof c==='string'?{id:c,name:c}:{id:c.id??c.userId??c.user_id??c.client_id??c.name??c.display_name,name:c.name??c.displayName??c.display_name??''});
    if(matter.client)clients.push({id:matter.clientId??matter.client_id??matter.client,name:matter.client});
    const parties=array(matter.parties).map(p=>typeof p==='string'?p:(p.displayName??p.display_name??p.name??''));
    const fields={title:normalizeSearchText(matter.title),number:normalizeSearchText(numbers.join(' ')),party:normalizeSearchText(parties.join(' ')),client:normalizeSearchText(clients.map(c=>c.name??c.display_name??'').join(' ')),court:normalizeSearchText(matter.court)};
    return {matter:original,record:matter,numbers,normalizedNumbers:numbers.map(normalizeMatterNumber).filter(Boolean),clients,fields,
      search:Object.values(fields).join(' '),attention:attention.get(matter.id)??null,nextStep:computeNextStep(matter,now,attention.get(matter.id)??null),unverified:matter.deadlines.some(d=>['proposed','invalidated'].includes(d.status)||d.status==='verified'&&!isVerifiedDeadline(d))};
  });
}

/** Apply combinable filters to already authorized rows; never expands access. */
export function queryMatterRows(rows,view={}){
  const state=sanitizeMatterView(view),query=normalizeSearchText(state.query),number=normalizeMatterNumber(state.query),tokens=query.split(' ').filter(Boolean);
  const matches=(selected,value)=>!selected.length||selected.includes(String(value??''));
  const filtered=[];
  for(const row of rows){const m=row.record;
    if(!matches(state.types,m.type)||!matches(state.subtypes,m.subtype)||!matches(state.stages,m.stageKey)||!matches(state.courts,m.court)||!matches(state.responsibleIds,m.responsibleId)||!matches(state.statuses,m.status))continue;
    if(state.clientIds.length&&!row.clients.some(c=>state.clientIds.includes(String(c.id))))continue;
    if(state.attentionTiers.length&&!state.attentionTiers.includes(row.attention?.tier))continue;
    if(state.shared!=='all'&&Boolean(m.shared)!==(state.shared==='yes'))continue;
    if(state.unverified!=='all'&&row.unverified!==(state.unverified==='yes'))continue;
    const numberMatch=Boolean(number)&&row.normalizedNumbers.includes(number);
    if(query&&!numberMatch&&!tokens.every(token=>row.search.includes(token)))continue;
    const matchFields=query?Object.entries(row.fields).filter(([,value])=>tokens.some(token=>value.includes(token))).map(([field])=>field):[];
    if(numberMatch&&!matchFields.includes('number'))matchFields.unshift('number');
    filtered.push({...row,matchFields});
  }
  const nextDate=row=>validDate(row.nextStep?.dueAt);
  const dateDiff=(a,b)=>{const left=nextDate(a),right=nextDate(b);return left===right?0:left<right?-1:1};
  const recent=(a,b,key)=>{const left=validDate(a.record[key]),right=validDate(b.record[key]);return left===right?0:left===Infinity?1:right===Infinity?-1:right-left};
  filtered.sort((a,b)=>{
    const result=state.sortBy==='title'?orderText(a.record.title,b.record.title):state.sortBy==='lastActivity'?recent(a,b,'lastActivityAt'):state.sortBy==='created'?recent(a,b,'createdAt'):state.sortBy==='nextDue'?dateDiff(a,b):((a.attention?.tier??100)-(b.attention?.tier??100)||dateDiff(a,b));
    return result||orderText(a.record.title,b.record.title)||orderText(a.record.id,b.record.id);
  });
  return filtered;
}

export function groupMatterRows(rows,groupBy='none'){
  const groups=new Map();
  for(const row of rows){const record=row.record;const label=groupBy==='court'?record.court:groupBy==='client'?row.clients.map(c=>c.name??c.display_name).join(', '):groupBy==='type'?record.type:groupBy==='stage'?record.stageKey:'';const key=groupBy==='client'?JSON.stringify(row.clients.map(c=>String(c.id)).sort()):label||'Belirtilmedi';
    if(!groups.has(key))groups.set(key,{label:groupBy==='none'?'Dosyalar':label||'Belirtilmedi',rows:[]});groups.get(key).rows.push(row);
  }
  return [...groups].map(([key,value])=>({key,...value}));
}

const listKeys=['types','subtypes','stages','courts','responsibleIds','clientIds','statuses'];
const enumFields={shared:['all','yes','no'],unverified:['all','yes','no'],groupBy:['none','court','client','type','stage'],sortBy:['attention','nextDue','lastActivity','created','title'],density:['comfortable','compact']};
export function sanitizeMatterView(input={}){
  const result={...defaultMatterView,query:text(input.query).trim().slice(0,200)};
  for(const key of listKeys)result[key]=Array.isArray(input[key])?[...new Set(input[key].filter(x=>typeof x==='string'&&x.length<=200))].slice(0,50):[...defaultMatterView[key]];
  result.attentionTiers=[...new Set(array(input.attentionTiers).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=9))];
  for(const [key,values]of Object.entries(enumFields))result[key]=values.includes(input[key])?input[key]:defaultMatterView[key];
  return result;
}
export function serializeMatterView(input){
  const view=sanitizeMatterView(input),params=new URLSearchParams();
  if(view.query)params.set('mv_q',view.query);
  for(const key of listKeys)if(JSON.stringify(view[key])!==JSON.stringify(defaultMatterView[key])){if(!view[key].length)params.set('mv_'+key,'');else for(const value of view[key])params.append('mv_'+key,value)}
  for(const [key]of Object.entries(enumFields))if(view[key]!==defaultMatterView[key])params.set('mv_'+key,view[key]);
  for(const tier of view.attentionTiers)params.append('mv_tier',String(tier));
  const encoded=params.toString();if(encoded.length>12000)throw new RangeError('Filtreler bağlantı için çok uzun. Daha az filtre seçin.');return encoded;
}
export function parseMatterView(query){
  const value=String(query??'').replace(/^\?/u,'');if(value.length>12000)throw new RangeError('Bağlantıdaki filtreler desteklenen uzunluğu aşıyor.');
  const params=new URLSearchParams(value),view={query:params.get('mv_q')??''};
  for(const key of listKeys)if(params.has('mv_'+key))view[key]=params.getAll('mv_'+key).filter(Boolean);
  for(const key of Object.keys(enumFields))view[key]=params.get('mv_'+key);
  view.attentionTiers=params.getAll('mv_tier');return sanitizeMatterView(view);
}
