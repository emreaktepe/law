import test from 'node:test';
import assert from 'node:assert/strict';
import {rankAttention} from '../src/domain/attention.js';
const now='2026-11-01T09:00:00Z';
const deadline=(due,extra={})=>({id:'deadline',status:'verified',verifiedDueAt:due,verifiedBy:'lawyer',verifiedAt:'2026-10-01T09:00:00Z',legalBasis:'Doğrulanmış fixture',sourceReference:'fixture-document',ruleVersion:'test-1',triggerDate:'2026-10-01',serviceMethod:'fixture',...extra});
const rank=m=>rankAttention([{id:'matter',...m}],now)[0];
test('1: doğrulanmış geçmiş süre en yüksek önceliktir; tek gerekçe döner',()=>{
  const item=rank({deadlines:[deadline('2026-10-31')],tasks:[{dueOn:'2026-10-20'}]});assert.equal(item.tier,1);assert.ok(item.reason);assert.equal(item.sourceId,'deadline');
  assert.equal(rank({deadlines:[deadline('2026-10-31',{status:'missed'})]}).tier,1);
  assert.equal(rank({deadlines:[deadline('2026-11-10',{status:'missed'})]}).tier,3);
  assert.equal(rank({deadlines:[deadline('2026-10-31',{status:'met'})]}),undefined);
});
test('2: bugün ve yarın doğrulanmış süre; gün İstanbul sınırına göre',()=>{
  assert.equal(rank({deadlines:[deadline('2026-11-01')]}).tier,2);
  assert.equal(rank({deadlines:[deadline('2026-11-02')]}).tier,2);
  assert.match(rankAttention([{id:'m',deadlines:[deadline('2027-01-01')]}],'2026-12-31T22:00:00Z')[0].reason,/bugün/);
});
test('3: öneri/geçersizleşmiş süre ve eksik doğrulama kanıtı kesin gösterilmez',()=>{
  assert.equal(rank({deadlines:[{status:'proposed'}]}).tier,3);
  assert.match(rank({deadlines:[{status:'invalidated'}]}).reason,/yeniden/);
  assert.equal(rank({deadlines:[deadline('2026-10-01',{verifiedBy:null})]}).tier,3);
  assert.equal(rank({deadlines:[deadline('2026-10-01',{sourceReference:''})]}).tier,3);
});
test('4: 48 saat içindeki duruşma sadece açık hazırlık görevi varsa yükselir',()=>{
  const hearing={id:'h',kind:'hearing',startsAt:'2026-11-02T09:00:00Z'};
  assert.equal(rank({agendaItems:[hearing],tasks:[{agendaItemId:'h',status:'open'}]}).tier,4);
  assert.equal(rank({agendaItems:[hearing],tasks:[{agendaItemId:'other',status:'open'}]}).tier,8);
  assert.equal(rank({agendaItems:[hearing],tasks:[{agendaItemId:'h',done:true}]}).tier,8);
});
test('5: gecikmiş açık görevler; tamamlanan ve iptal edilenler hariç',()=>{
  assert.equal(rank({tasks:[{dueOn:'2026-10-31'}]}).tier,5);
  assert.equal(rank({tasks:[{dueOn:'2026-10-31',status:'cancelled'}]}),undefined);
  assert.equal(rank({tasks:[{dueOn:'2026-10-31',done:true}]}),undefined);
});
test('6: bitmiş duruşma sonucu bekler; devam eden/tamamlanmış duruşma hariç',()=>{
  const hearing={id:'h',kind:'hearing',startsAt:'2026-11-01T07:00:00Z',endsAt:'2026-11-01T08:00:00Z'};
  assert.equal(rank({agendaItems:[hearing]}).tier,6);
  assert.equal(rank({agendaItems:[{...hearing,outcomeEventId:'event'}]}),undefined);
  assert.equal(rank({agendaItems:[{...hearing,endsAt:'2026-11-01T10:00:00Z'}]}),undefined);
});
test('7: ilk yanıtsız müvekkil mesajı dikkate alınır; avukat yanıtı kuyruğu kapatır',()=>{
  const messages=[{id:'old',role:'client',createdAt:'2026-10-30T08:00:00Z'},{id:'new',role:'client',createdAt:'2026-11-01T08:00:00Z'}];
  assert.equal(rank({messages}).tier,7);assert.equal(rank({messages}).sourceId,'old');
  assert.equal(rank({messages:[...messages,{role:'lawyer',createdAt:'2026-11-01T08:30:00Z'}]}),undefined);
});
test('8: 7 günlük çalışma hedefi hukuk süresi olarak sunulmaz',()=>{
  assert.equal(rank({targetDate:'2026-11-08'}).tier,8);assert.match(rank({targetDate:'2026-11-08'}).reason,/hukuki süre değildir/);
  assert.equal(rank({targetDate:'2026-11-09'}),undefined);
});
test('9: aktif dosya 30 gün sessizse görünür; eşikler ayarlanabilir',()=>{
  assert.equal(rank({lastActivityAt:'2026-10-02'}).tier,9);
  assert.equal(rank({lastActivityAt:'2026-10-03'}),undefined);
  assert.equal(rankAttention([{id:'m',lastActivityAt:'2026-10-25'}],now,{quietDays:7})[0].tier,9);
});
test('arşiv/kapalı dosya, belirsiz tarih ve geçersiz takvim günü sıralanmaz',()=>{
  assert.equal(rank({status:'archived',deadlines:[deadline('2026-10-01')]}),undefined);
  assert.equal(rank({status:'closed',targetDate:'2026-11-02'}),undefined);
  assert.equal(rank({tasks:[{dueOn:'2026-02-30'}]}),undefined);
  assert.equal(rank({tasks:[{dueOn:'2026-02-30T10:00:00Z'}]}),undefined);
  assert.equal(rank({agendaItems:[{kind:'hearing',startsAt:'2026-10-01T10:00:00'}]}),undefined);
  assert.throws(()=>rankAttention([], '2026-11-01T09:00:00'),TypeError);
  assert.throws(()=>rankAttention([],now,{quietDays:-1}),RangeError);
});
test('aynı kademede tarihe göre sıralanır; girdi değişmez ve özel veri çıktıya girmez',()=>{
  const input=[{id:'later',privateNotes:'gizli',tasks:[{dueOn:'2026-10-31'}]},{id:'earlier',tasks:[{dueOn:'2026-10-30'}]}];
  const copy=structuredClone(input),result=rankAttention(input,now);
  assert.deepEqual(result.map(r=>r.matterId),['earlier','later']);assert.deepEqual(input,copy);assert.equal(JSON.stringify(result).includes('gizli'),false);
});
