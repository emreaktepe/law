import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMatterNumber,parseMatterNumber,matterNumberMatches,normalizeSearchText} from '../src/lib/normalize.js';
import {matterTemplates,getMatterTemplate,createMatterStageSnapshot} from '../src/domain/stages.js';
import {eventCatalog,buildProceedingSuggestions,getProceedingType} from '../src/domain/events.js';

test('farklı numara biçimleri aynı dosyayı bulur; gösterim bilgisi kaybolmaz',()=>{
  for(const value of ['2026 / 184 E.','2026/184','2026-184 esas','2026 184']) assert.equal(normalizeMatterNumber(value),'2026/184');
  assert.equal(matterNumberMatches('2026/184 E.','2026 184'),true);
  assert.equal(matterNumberMatches('2026/184 E.','2026/185'),false);
  assert.deepEqual(parseMatterNumber('2026/00184 K.'),{year:'2026',serial:'00184',suffix:'karar',normalized:'2026/184'});
  assert.equal(matterNumberMatches('2026/00184 K.','2026 184'),true);
});
test('belirsiz numara, metindeki ek sayılar ve boş sorgu tahmin edilmez',()=>{
  for(const value of ['2026/184/2','26/184','2026184','Dosya 2026/184',null,'']) assert.equal(normalizeMatterNumber(value),'');
  assert.equal(matterNumberMatches('2026/184',''),false);
});
test('Türkçe aramada büyük/küçük harf ve aksan tutarlı normalleşir',()=>{
  assert.equal(normalizeSearchText('İSTANBUL  Şişli'),'istanbul sisli');
  assert.equal(normalizeSearchText('IĞDIR'),normalizeSearchText('ığdır'));
});
test('12 sürümlü şablon doğrulanmamış ve tüm aşamalar sade müvekkil etiketi içerir',()=>{
  assert.equal(matterTemplates.length,12);
  assert.equal(new Set(matterTemplates.map(t=>t.key)).size,12);
  for(const t of matterTemplates){
    assert.equal(t.unverified,true); assert.equal(t.verifiedByLawyer,false);assert.ok(t.version.startsWith('draft-'));
    assert.ok(t.notice.includes('Doğrulanmamış'));assert.ok(t.subtypes.length);
    assert.equal(new Set(t.stages.map(s=>s.key)).size,t.stages.length);
    for(const s of t.stages){assert.ok(s.clientLabel);assert.ok(s.label)}
  }
  assert.equal(getMatterTemplate('İdari').key,'idari_vergi');
  assert.equal(getMatterTemplate('İŞ').key,'is');
  assert.equal(getMatterTemplate('Is hukuku').key,'is');
  assert.equal(getMatterTemplate('Aile / Bosanma').key,'aile');
  assert.equal(getMatterTemplate('tanınmayan'),null);
});
test('dosya şablon snapshot değişikliği ortak katalogu ve diğer dosyayı değiştirmez',()=>{
  const first=createMatterStageSnapshot('İcra'),second=createMatterStageSnapshot('İcra');
  first.stages[0].label='Dosyaya özel';first.version='özel';
  assert.notEqual(second.stages[0].label,'Dosyaya özel');
  assert.equal(second.version,getMatterTemplate('İcra').version);
});
test('24 safahat türü paylaşımı kapalı başlatır ve sade etiket taşır',()=>{
  assert.equal(eventCatalog.length,24);assert.equal(new Set(eventCatalog.map(e=>e.key)).size,24);
  for(const event of eventCatalog){assert.equal(event.defaultShared,false);assert.equal(event.unverified,true);assert.ok(event.clientLabel)}
  assert.equal(getProceedingType('bilinmeyen'),null);
});
test('tebligat önerisi tipe göre taslak üretir; kesin hukuki tarih üretmez',()=>{
  const execution=buildProceedingSuggestions({eventType:'tebligat_alindi',matterType:'İcra'});
  assert.equal(execution.deadlineCandidates[0].ruleKey,'itiraz_icra');
  const labour=buildProceedingSuggestions({eventType:'tebligat_alindi',matterType:'İş'});
  assert.equal(labour.deadlineCandidates[0].ruleKey,'cevap_dilekcesi');
  for(const candidate of [...execution.deadlineCandidates,...labour.deadlineCandidates]){
    assert.equal(candidate.dueAt,null);assert.equal(candidate.status,'proposed');assert.equal(candidate.unverified,true);
  }
  assert.equal(execution.defaultShared,false);assert.ok(execution.tasks.every(t=>t.sharedWithClient===false));
  assert.equal(buildProceedingSuggestions({eventType:'tebligat_alindi',matterType:'bilinmeyen'}).deadlineCandidates.length,0);
});
test('duruşma önerisi otomatik zaman/paylaşım açmaz; tekrar çağrı bağımsızdır',()=>{
  const first=buildProceedingSuggestions({eventType:'durusma_yapildi',matterType:'İş'});
  assert.equal(first.agenda[0].startsAt,null);assert.equal(first.agenda[0].sharedWithClient,false);
  first.tasks[0].title='değişti';
  assert.notEqual(buildProceedingSuggestions({eventType:'durusma_yapildi',matterType:'İş'}).tasks[0].title,'değişti');
  assert.deepEqual(buildProceedingSuggestions({eventType:'bilinmeyen',matterType:'İş'}),{tasks:[],deadlineCandidates:[],agenda:[],defaultShared:false});
});
