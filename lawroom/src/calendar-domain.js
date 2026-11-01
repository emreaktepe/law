import { trackingMatter, isOpenTask, isArchived } from './domain/tracking-model.js';
import { isVerifiedDeadline } from './domain/attention.js';
export const eventKinds={hearing:{label:'Duruşma',short:'Duruşma'},followup:{label:'Dosya takibi',short:'Takip'},meeting:{label:'Müvekkil görüşmesi',short:'Görüşme'},discovery:{label:'Keşif',short:'Keşif'},expert:{label:'Bilirkişi',short:'Bilirkişi'},mediation:{label:'Arabuluculuk',short:'Arabuluculuk'},internal:{label:'Büro içi',short:'İç'},deadline:{label:'Süre incelemesi / son gün',short:'Süre'}};
export const todayKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const shiftDay=(key,n)=>new Date(Date.parse(key+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const weekStart=key=>shiftDay(key,-((new Date(key+'T12:00:00Z').getUTCDay()+6)%7));
export const monthDays=key=>{const start=weekStart(key.slice(0,7)+'-01');return Array.from({length:42},(_,i)=>shiftDay(start,i))};
export function moveMonth(key,n){const d=new Date(key.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10)}
export const labelDate=(key,options={day:'numeric',month:'long'})=>new Date(key+'T12:00:00Z').toLocaleDateString('tr-TR',{...options,timeZone:'UTC'});
export function conflicts(a,b){return a.id!==b.id&&a.lawyer===b.lawyer&&a.date===b.date&&!a.allDay&&!b.allDay&&a.status==='planned'&&b.status==='planned'&&a.start<b.end&&b.start<a.end}
export function validateEvent(e){if(!e.title.trim())return 'Etkinlik başlığı gerekli.';if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date))||new Date(e.date+'T12:00:00Z').toISOString().slice(0,10)!==e.date)return 'Geçerli bir tarih seçin.';if(!eventKinds[e.kind])return 'Etkinlik türünü seçin.';if(!e.allDay&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.end)||e.end<=e.start))return 'Bitiş saati başlangıçtan sonra olmalı. Geceyi aşan etkinliği ayrı günlere bölün.';if(e.shared&&!e.matterId)return 'Müvekkille paylaşmak için bir dosya seçin.';return '';}
export function calendarEvents(saved,cases,role,lawyer){
  if(role==='admin')return [];
  const authorized=cases.filter(c=>!isArchived(c)), ids=new Set(authorized.filter(c=>role!=='client'||c.shared).map(c=>c.id));
  const manual=saved.filter(e=>role==='client'?e.shared&&ids.has(e.matterId):e.lawyer===lawyer);
  const derived=[];
  const parts=value=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  for(const raw of authorized){
    const m=trackingMatter(raw);
    if(role==='client'&&!m.shared)continue;
    for(const a of m.agendaItems){
      if(role==='client'&&!a.sharedWithClient)continue;
      if(a.ownerId&&a.ownerId!==lawyer&&role!=='client')continue;
      if(!a.startsAt||!Number.isFinite(Date.parse(a.startsAt)))continue;
      const start=parts(a.startsAt),end=parts(a.endsAt||a.startsAt);
      derived.push({id:'agenda-'+a.id,kind:a.kind==='client_meeting'?'meeting':a.kind,title:a.title,date:`${start.year}-${start.month}-${start.day}`,start:`${start.hour}:${start.minute}`,end:`${end.hour}:${end.minute}`,allDay:false,matterId:m.id,status:a.status||'planned',derived:true,shared:a.sharedWithClient,lawyer:a.ownerId||lawyer,location:a.location,derivedDescription:'Dosyanın ajanda kaydından gelir. Sonuç ve değişiklikler için dosyayı açın.'});
    }
    if(role==='client')continue;
    for(const t of m.tasks.filter(isOpenTask).filter(t=>t.dueOn))derived.push({id:'task-'+t.id,kind:'followup',title:t.title,date:t.dueOn,allDay:true,matterId:m.id,status:'planned',derived:true,shared:false,lawyer:t.assigneeId||lawyer,derivedDescription:'Görevin çalışma hedefidir; hukuki süre değildir. Görevi düzenlemek için dosyayı açın.'});
    for(const d of m.deadlines.filter(d=>['proposed','invalidated','verified','missed'].includes(d.status))){
      const verified=isVerifiedDeadline(d),due=verified?d.verifiedDueAt:d.proposedDueAt;
      if(!due)continue;
      const date=due.includes('T')?(()=>{const p=parts(due);return `${p.year}-${p.month}-${p.day}`})():due;
      derived.push({id:'deadline-'+d.id,kind:'deadline',title:(verified?'Avukatın doğruladığı son gün: ':'Doğrulama bekliyor: ')+(d.title||'Süre incelemesi'),date,allDay:true,matterId:m.id,status:'planned',derived:true,shared:false,verified,derivedDescription:verified?'Doğrulayan kişi ve kaynak dosyanın süre bölümündedir.':'Doğrulanmamış öneridir; hukuki son gün kabul edilmez.'});
    }
    if(m.due&&!m.tasks.some(t=>t.dueOn===m.due&&t.title===m.next))derived.push({id:'target-'+m.id,kind:'followup',title:m.next||m.title,date:m.due,allDay:true,matterId:m.id,status:'planned',derived:true,shared:false,verified:false,derivedDescription:'Manuel çalışma hedefidir; hukuki süre değildir.'});
  }
  return [...manual,...derived].filter(e=>eventKinds[e.kind]).sort((a,b)=>a.date.localeCompare(b.date)||(a.allDay?'00:00':a.start).localeCompare(b.allDay?'00:00':b.start));
}
export const demoEvents=[{id:'hearing-demo',kind:'hearing',title:'Ön inceleme duruşması',date:'2026-11-06',start:'10:00',end:'11:00',allDay:false,matterId:'3',location:'İstanbul 3. Aile Mahkemesi',shared:false,status:'planned',lawyer:'demo-lawyer-a'},{id:'meeting-demo',kind:'meeting',title:'Dosya değerlendirme görüşmesi',date:'2026-11-03',start:'14:00',end:'14:45',allDay:false,matterId:'1',location:'Çevrim içi görüşme',shared:true,status:'planned',lawyer:'demo-lawyer-a'},{id:'review-demo',kind:'followup',title:'Evrak kontrolü',date:'2026-11-05',start:'11:00',end:'11:30',allDay:false,matterId:'2',location:'Büro',shared:false,status:'planned',lawyer:'demo-lawyer-b'}];
