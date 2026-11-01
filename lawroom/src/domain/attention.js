const HOUR=3600000;
const DAY=24*HOUR;
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'});

function timestamp(value){
  if(value instanceof Date)return Number.isFinite(value.getTime())?value.getTime():null;
  if(typeof value!=='string')return null;
  const parts=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u);
  if(!parts)return null;
  const [year,month,date,hour,minute,second]=parts.slice(1).map(Number);
  const actual=new Date(Date.UTC(year,month-1,date));
  if(actual.getUTCFullYear()!==year||actual.getUTCMonth()!==month-1||actual.getUTCDate()!==date||hour>23||minute>59||(Number.isFinite(second)&&second>59))return null;
  const n=Date.parse(value);return Number.isFinite(n)?n:null;
}
function day(value){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(value)){
    const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
    return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.getTime()/DAY:null;
  }
  const ts=timestamp(value);if(ts===null)return null;
  const parts=Object.fromEntries(formatter.formatToParts(ts).map(p=>[p.type,p.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/DAY;
}
function sortTime(value){return timestamp(value)??((day(value)??Infinity)*DAY)}
function expired(value,now,nowDay){const ts=timestamp(value);return ts===null?(day(value)!==null&&day(value)<nowDay):ts<now}
function openTask(task){return !task.done&&!task.completedAt&&(!task.status||task.status==='open')}
function verified(deadline){
  const text=value=>typeof value==='string'&&Boolean(value.trim());
  return ['verified','missed'].includes(deadline.status)&&Boolean(text(deadline.verifiedBy)&&timestamp(deadline.verifiedAt)!==null&&
    text(deadline.legalBasis)&&text(deadline.sourceReference)&&text(deadline.ruleVersion)&&day(deadline.triggerDate)!==null&&text(deadline.serviceMethod));
}
function positive(value,fallback){if(value===undefined)return fallback;if(!Number.isFinite(value)||value<=0)throw new RangeError('Dikkat eşikleri pozitif sayı olmalıdır.');return value}

/**
 * Rank authorized matters only; this function does not implement access control.
 * Returns a single highest-priority reason per matter, without private content.
 * Dates are ISO date-only values or timestamps with an explicit offset.
 * A verified deadline requires lawyer/source metadata, never just a boolean.
 * @param {Array<{id:string,status?:string,archivedAt?:string,lastActivityAt?:string,targetDate?:string,tasks?:Array<object>,deadlines?:Array<object>,agendaItems?:Array<object>,messages?:Array<object>}>} matters
 * @param {string|Date} now
 * @param {{soonDays?:number,quietDays?:number,unansweredHours?:number,hearingWindowHours?:number}} options
 * @returns {Array<{matterId:string,tier:number,reason:string,dueAt:string|null,sourceId:string|null}>}
 */
export function rankAttention(matters,now,options={}){
  const nowTs=timestamp(now),nowDay=day(now);
  if(nowTs===null||nowDay===null)throw new TypeError('Açık zaman dilimli geçerli bir şimdi değeri gerekir.');
  const soonDays=positive(options.soonDays,7),quietDays=positive(options.quietDays,30);
  const unansweredHours=positive(options.unansweredHours,24),hearingWindowHours=positive(options.hearingWindowHours,48);
  const ranked=[];
  for(const matter of matters){
    if(matter.archivedAt||['closed','archived'].includes(matter.status))continue;
    const candidates=[];
    const add=(tier,reason,dueAt,sourceId)=>candidates.push({matterId:matter.id,tier,reason,dueAt:dueAt??null,sourceId:sourceId??null});
    const tasks=(matter.tasks??[]).filter(openTask);
    const deadlines=(matter.deadlines??[]).filter(d=>!['met','waived','cancelled'].includes(d.status));
    const agenda=(matter.agendaItems??[]).filter(a=>!a.status||a.status==='planned');
    for(const d of deadlines){
      const due=d.verifiedDueAt;
      if(d.status==='missed'){
        if(verified(d)&&day(due)!==null&&expired(due,nowTs,nowDay))add(1,'Kaçırıldığı kaydedilen süre için takip gerekiyor',due,d.id);
        else add(3,'Kaçırıldı işaretli sürenin tarih ve doğrulamasını kontrol edin',due,d.id);
        continue;
      }
      if(verified(d)&&day(due)!==null){
        if(expired(due,nowTs,nowDay))add(1,'Doğrulanmış süre için son tarih geçti',due,d.id);
        else if(day(due)-nowDay<=1)add(2,day(due)===nowDay?'Doğrulanmış süre bugün doluyor':'Doğrulanmış süre yarın doluyor',due,d.id);
      }else if(['proposed','invalidated','verified'].includes(d.status)){
        add(3,d.status==='invalidated'?'Kaynak değişti; süre yeniden doğrulanmalı':'Süre önerisi avukat doğrulaması bekliyor',d.proposedDueAt??due,d.id);
      }
    }
    for(const hearing of agenda.filter(a=>a.kind==='hearing')){
      const starts=timestamp(hearing.startsAt),ends=timestamp(hearing.endsAt)??starts;
      if(starts===null)continue;
      const preparation=tasks.filter(t=>t.agendaItemId===hearing.id||(t.kind==='hearing_preparation'&&!t.agendaItemId));
      if(starts>=nowTs&&starts-nowTs<=hearingWindowHours*HOUR&&preparation.length){
        add(4,`Yaklaşan duruşma için ${preparation.length} açık hazırlık görevi var`,hearing.startsAt,hearing.id);
      }
      if(ends<nowTs&&!hearing.outcomeEventId)add(6,'Geçmiş duruşmanın sonucu bekleniyor',hearing.startsAt,hearing.id);
    }
    for(const task of tasks){if(expired(task.dueOn,nowTs,nowDay))add(5,'Görevin hedef tarihi geçti',task.dueOn,task.id)}
    const messages=(matter.messages??[]).map(m=>({...m,ts:timestamp(m.createdAt)})).filter(m=>m.ts!==null);
    const lastLawyer=Math.max(-Infinity,...messages.filter(m=>m.role==='lawyer').map(m=>m.ts));
    const unanswered=messages.filter(m=>m.role==='client'&&m.ts>lastLawyer&&m.ts<=nowTs).sort((a,b)=>a.ts-b.ts)[0];
    if(unanswered&&nowTs-unanswered.ts>=unansweredHours*HOUR)add(7,'Müvekkil mesajı yanıt bekliyor',unanswered.createdAt,unanswered.id);
    const upcoming=[
      ...tasks.map(t=>({date:t.dueOn,id:t.id,label:'Görev hedefi yaklaşıyor'})),
      ...deadlines.filter(verified).map(d=>({date:d.verifiedDueAt,id:d.id,label:'Doğrulanmış süre yaklaşıyor'})),
      ...agenda.map(a=>({date:a.startsAt??a.allDayDate,id:a.id,label:'Takvimde yaklaşan bir işlem var'})),
      {date:matter.targetDate,id:null,label:'Çalışma hedefi yaklaşıyor; hukuki süre değildir'},
    ];
    for(const item of upcoming){const difference=day(item.date)===null?null:day(item.date)-nowDay;if(difference!==null&&difference>=0&&difference<=soonDays&&!expired(item.date,nowTs,nowDay))add(8,item.label,item.date,item.id)}
    const lastDay=day(matter.lastActivityAt);
    if((!matter.status||matter.status==='active')&&lastDay!==null&&nowDay-lastDay>=quietDays)add(9,`${nowDay-lastDay} gündür hareket yok; bir göz atın`,matter.lastActivityAt,null);
    candidates.sort((a,b)=>a.tier-b.tier||sortTime(a.dueAt)-sortTime(b.dueAt));
    if(candidates[0])ranked.push(candidates[0]);
  }
  return ranked.sort((a,b)=>a.tier-b.tier||sortTime(a.dueAt)-sortTime(b.dueAt)||(String(a.matterId)<String(b.matterId)?-1:String(a.matterId)>String(b.matterId)?1:0));
}

export { verified as isVerifiedDeadline };
