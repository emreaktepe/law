import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMatterRows,queryMatterRows,computeNextStep,groupMatterRows,serializeMatterView,parseMatterView,sanitizeMatterView,projectMatterListForRole} from '../src/domain/matter-views.js';
const now='2026-11-01T09:00:00Z';
const fixtures=[
  {id:'a',title:'İşe iade talebi',type:'İş',subtype:'İşe iade',number:'2026/184 E.',numbers:[{value:'2027/4 K.'}],court:'İstanbul 14. İş Mahkemesi',client:'Örnek Müvekkil',clientId:'c1',parties:[{name:'Örnek Şirket'}],responsibleId:'l1',status:'active',shared:true,tasks:[{id:'t',title:'Hazırlık',dueOn:'2026-11-03'}]},
  {id:'b',title:'Tahsilat',type:'İcra',number:'2026/185',court:'Ankara',responsibleId:'l2',status:'on_hold',shared:false,deadlines:[{id:'d',status:'proposed',proposedDueAt:'2026-11-05'}]},
  {id:'c',title:'Arşiv örneği',type:'İş',status:'archived',court:'İstanbul',tasks:[]},
];
test('normalize yıl/sıra ve ikincil numara araması eşleşme nedenini döner',()=>{
  const rows=prepareMatterRows(fixtures,now);
  assert.deepEqual(queryMatterRows(rows,{query:'2026 184'}).map(r=>r.record.id),['a']);
  assert.ok(queryMatterRows(rows,{query:'2026 184'})[0].matchFields.includes('number'));
  assert.deepEqual(queryMatterRows(rows,{query:'2027-4 karar'}).map(r=>r.record.id),['a']);
});
test('taraf, müvekkil, mahkeme ve Türkçe çok sözcüklü arama birlikte çalışır',()=>{
  const rows=prepareMatterRows(fixtures,now);
  assert.equal(queryMatterRows(rows,{query:'sirket istanbul'}).length,1);
  assert.equal(queryMatterRows(rows,{query:'müvekkil işe'}).length,1);
  assert.equal(queryMatterRows(rows,{query:'bulunamaz'}).length,0);
});
test('filtreler kesişim uygular; arşiv varsayılan gizlidir ve açıkça aranabilir',()=>{
  const rows=prepareMatterRows(fixtures,now);
  assert.deepEqual(queryMatterRows(rows).map(r=>r.record.id),['b','a']);
  assert.deepEqual(queryMatterRows(rows,{types:['İş'],subtypes:['İşe iade'],responsibleIds:['l1'],clientIds:['c1'],shared:'yes'}).map(r=>r.record.id),['a']);
  assert.equal(queryMatterRows(rows,{types:['İş'],responsibleIds:['l2']}).length,0);
  assert.deepEqual(queryMatterRows(rows,{statuses:['archived']}).map(r=>r.record.id),['c']);
  assert.deepEqual(queryMatterRows(rows,{unverified:'yes',attentionTiers:[3]}).map(r=>r.record.id),['b']);
});
test('sıradaki iş hesaplanır; tamamlanan görev ve manuel hedef önceliği bozamaz',()=>{
  const matter={id:'m',next:'Elle girilen',due:'2026-11-01',tasks:[{id:'done',done:true,title:'Bitti',dueOn:'2026-10-01'},{id:'open',title:'Açık görev',dueOn:'2026-11-05'}]};
  assert.equal(computeNextStep(matter,now).title,'Açık görev');
  assert.doesNotMatch(computeNextStep(matter,now).reason,/Çalışma hedefi/);
  assert.equal(computeNextStep({...matter,tasks:[]},now).kind,'manual');
  assert.match(computeNextStep({...matter,tasks:[]},now).reason,/hukuki süre değildir/);
});
test('sıralama ve gruplama görünüm dışında kaydı değiştirmez',()=>{
  const copy=structuredClone(fixtures),rows=prepareMatterRows(fixtures,now);
  const result=queryMatterRows(rows,{sortBy:'title'});assert.deepEqual(result.map(r=>r.record.id),['a','b']);
  assert.deepEqual(groupMatterRows(result,'type').map(g=>g.label),['İş','İcra']);assert.deepEqual(fixtures,copy);
});
test('URL durumu tüm filtreleri kayıpsız taşır, bilinmeyen değerler dar sözleşmeye alınmaz',()=>{
  const view=sanitizeMatterView({query:'2026 184',types:['İş'],statuses:[],courts:['İstanbul'],shared:'yes',unverified:'yes',attentionTiers:[1,3],groupBy:'court',sortBy:'nextDue',density:'compact'});
  assert.deepEqual(parseMatterView(serializeMatterView(view)),view);
  assert.equal(parseMatterView('mv_sortBy=__proto__&mv_density=huge&mv_tier=999').sortBy,'attention');
  assert.deepEqual(parseMatterView('mv_sortBy=__proto__&mv_density=huge&mv_tier=999').attentionTiers,[]);
  assert.throws(()=>parseMatterView('mv_q='+ 'x'.repeat(12000)),RangeError);
});
test('müvekkil liste DTO su özel not/taraf/süre/iç görev çıkarır; admin listesi boş',()=>{
  const records=[{...fixtures[0],privateNotes:'gizli',notes:'gizli',next:'iç adım',tasks:[{id:'private',title:'gizli'},{id:'public',title:'Belge hazırlayın',sharedWithClient:true}],deadlines:[{status:'proposed'}]}];
  const dto=projectMatterListForRole(records,'client');assert.equal(JSON.stringify(dto).includes('gizli'),false);assert.equal(dto[0].tasks.length,1);assert.deepEqual(dto[0].deadlines,[]);assert.equal(dto[0].parties,undefined);assert.equal(dto[0].next,undefined);
  assert.deepEqual(projectMatterListForRole(records,'admin'),[]);
});
test('500 dosya ve 10 bin olayda indeks+filtre+sıralama medyanı 300ms altında',t=>{
  const matters=Array.from({length:500},(_,i)=>({id:String(i),title:`Dosya ${i}`,type:i%2?'İş':'İcra',number:`2026/${i+1}`,court:'Örnek Mahkeme',client:'Örnek',status:'active',tasks:[{id:`t${i}`,title:'İncele',dueOn:'2026-11-03'}],events:Array.from({length:20},(_,e)=>({id:`${i}:${e}`,title:'Fixture'}))}));
  const times=[];for(let i=0;i<3;i++){const start=performance.now(),rows=queryMatterRows(prepareMatterRows(matters,now),{query:'Örnek',sortBy:'nextDue'});times.push(performance.now()-start);assert.equal(rows.length,500)}
  times.sort((a,b)=>a-b);t.diagnostic(`500 matter / 10000 event median: ${times[1].toFixed(1)}ms`);assert.ok(times[1]<300,`median ${times[1]}ms`);
});

test('toplu dikkat yeniden kullanıldığında tekil sonraki iş sonucu ve girdiler korunur',()=>{
  const data=[...fixtures,{id:'no-attention',title:'İleri tarihli iş',tasks:[{id:'later',title:'İncele',dueOn:'2027-01-01'}]}];
  const before=structuredClone(data),rows=prepareMatterRows(data,now);
  for(const row of rows)assert.deepEqual(row.nextStep,computeNextStep(row.matter,now));
  assert.deepEqual(data,before);
});
