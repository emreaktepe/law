import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTrackingCommand as apply, expenseMinor, expenseTotals } from '../src/domain/tracking-workflow.js';
import { createTrackingRepository } from '../src/data/trackingRepository.js';
import { clientTrackingPreview } from '../src/domain/tracking-model.js';
const fixture = () => ({ id: 'm', title: 'Örnek', type: 'İcra', stage: 'Hazırlık', tasks: [], events: [], messages: [] });
let seq = 0;
const context = { role: 'lawyer', actorId: 'lawyer-1', now: '2026-11-01T10:00:00Z', makeId: () => `new-${++seq}` };
const command = (type, payload = {}, key) => ({ type, payload, key });
const service = { eventType: 'tebligat_alindi', occurredOn: '2026-11-01', servedOn: '2026-11-01', serviceMethod: 'UETS kaydı incelenecek', sourceReference: 'Belge 3 / sayfa 1', taskIndexes: [0, 1], requestDeadlineReview: true };
test('tebligat tek aggregate içinde olay, seçilen görevler ve tarihsiz süre incelemesi oluşturur', () => {
  const source = fixture(), updated = apply(source, command('add_event', service, 'single'), context);
  assert.equal(source.events.length, 0); assert.equal(updated.events.length, 1); assert.equal(updated.tasks.length, 2);
  assert.equal(updated.deadlines[0].status, 'proposed'); assert.equal(updated.deadlines[0].proposedDueAt, null);
  assert.equal(updated.events[0].shared, false); assert.ok(updated.tasks.every(t => t.sourceEventId === updated.events[0].id));
  assert.equal(apply(updated, command('add_event', service, 'single'), context), updated);
});
test('geçersiz alt kayıt, paylaşım özeti veya tebliğ eksikse hiçbir kısmi kayıt kaydedilmez', () => {
  for (const payload of [{ ...service, taskIndexes: [100] }, { ...service, servedOn: '' }, { ...service, shared: true, clientSummary: '' }, { ...service, occurredOn: '2026-02-30' }]) {
    let saves = 0; const source = fixture();
    const repository = createTrackingRepository({ listMatters: () => [source], saveMatters: () => saves++ });
    assert.throws(() => repository.commit('m', command('add_event', payload), context)); assert.equal(saves, 0); assert.equal(source.events.length, 0);
  }
});
test('düzeltme orijinal safahatı korur; kaynak süre yeniden doğrulama gerektirir', () => {
  let m = apply(fixture(), command('add_event', service), context); const original = structuredClone(m.events[0]);
  m = apply(m, command('add_event', { ...service, correctsEventId: original.id, correctionReason: 'Tebliğ kaynağı değişti', requestDeadlineReview: false }), context);
  assert.deepEqual(m.events[0], original); assert.equal(m.events[1].correctsEventId, original.id); assert.equal(m.deadlines[0].status, 'invalidated');
  assert.throws(() => apply(m, command('verify_deadline', { id: m.deadlines[0].id }), context), /yeni safahat/);
});
test('görev ekip üyesine atanır; erteleme gerekçe ister ve önceki hedef audit ile korunur', () => {
  let m = apply(fixture(), command('add_task', { title: 'İncele', dueOn: '2026-11-02' }), context);
  const id = m.tasks[0].id;
  assert.throws(() => apply(m, command('postpone_task', { id, dueOn: '2026-11-03' }), context), /gerekçesi/);
  assert.throws(() => apply(m, command('add_task', { title: 'Yetkisiz', assigneeId: 'stranger' }), context), /ekibine/);
  m = apply(m, command('postpone_task', { id, dueOn: '2026-11-04', reason: 'Belge bekleniyor' }), context);
  assert.equal(m.tasks[0].postponements[0].from, '2026-11-02'); assert.equal(m.auditHistory.at(-1).action, 'postpone_task');
  m = apply(m, command('complete_task', { id }), context); assert.equal(m.tasks[0].done, true);
  assert.throws(() => apply(m, command('postpone_task', { id, dueOn: '2026-11-06', reason: 'Test' }), context), /Açık görev/);
});
test('aşama şablondan seçilir ve kişi/zaman/notla geçmişe eklenir', () => {
  const m = apply(fixture(), command('change_stage', { stageKey: 'tebligat', note: 'Evrak kontrol edildi' }), context);
  assert.equal(m.stageKey, 'tebligat'); assert.equal(m.stageHistory[0].actorId, context.actorId);
  assert.throws(() => apply(m, command('change_stage', { stageKey: 'uydurma', note: 'Test' }), context), /şablon/);
});
test('çoklu numara geçmişi korunur; tek birincil numara ve normalize mükerrer kontrolü', () => {
  let m = apply({ ...fixture(), number: '2026/184 E.' }, command('add_number', { kind: 'karar', value: '2027/20 K.', isPrimary: true }), context);
  assert.equal(m.numbers.length, 2); assert.equal(m.numbers.filter(n => n.isPrimary).length, 1); assert.equal(m.number, '2027/20 K.');
  assert.throws(() => apply(m, command('add_number', { kind: 'karar', value: '2027-020 karar' }), context), /zaten/);
});
test('para kuruşla tutulur; dövizler toplanmaz ve ters kayıt geçmişi silmez', () => {
  assert.equal(expenseMinor('0,10') + expenseMinor('0.20'), 30);
  for (const value of ['1.234,55', '-1', 'NaN', '1.234']) assert.throws(() => expenseMinor(value));
  let m = apply(fixture(), command('add_expense', { category: 'Harç', amount: '1234,56', paidBy: 'office', spentOn: '2026-11-01', billableToClient: true }), context);
  assert.deepEqual(expenseTotals(m.expenses).TRY, { totalMinor: 123456, billableMinor: 123456 });
  m = apply(m, command('reverse_expense', { id: m.expenses[0].id, reason: 'Yanlış kalem' }), context);
  assert.equal(m.expenses.length, 2); assert.deepEqual(expenseTotals(m.expenses), {});
});
test('duruşma sonucu atomik olarak safahat, ara karar görevleri ve sonraki duruşmayı oluşturur', () => {
  let m = apply(fixture(), command('add_agenda', { kind: 'hearing', title: 'İlk duruşma', startsAt: '2026-10-30T09:00:00+03:00', endsAt: '2026-10-30T10:00:00+03:00' }), context);
  const id = m.agendaItems[0].id;
  const payload = { id, result: 'Ara karar', note: 'Eksik bordrolar istenecek', tasks: [{ title: 'Bordroları iste', dueOn: '2026-11-05' }], nextHearing: { title: 'Sonraki duruşma', startsAt: '2026-12-01T09:00:00+03:00', endsAt: '2026-12-01T10:00:00+03:00' } };
  assert.throws(() => apply(m, command('hearing_outcome', { ...payload, tasks: [{ title: '' }] }), context)); assert.equal(m.agendaItems[0].status, 'planned');
  m = apply(m, command('hearing_outcome', payload), context);
  assert.equal(m.agendaItems[0].status, 'done'); assert.equal(m.agendaItems.length, 2); assert.equal(m.tasks.length, 1);
  assert.equal(m.tasks[0].sourceEventId, m.agendaItems[0].outcomeEventId);
  assert.throws(() => apply(m, command('hearing_outcome', payload), context), /bekleyen/);
});
test('süre doğrulaması kaynak/dayanak/tebliğ/kural/avukat onayı ister, karşılanma referansı tutulur', () => {
  let m = apply(fixture(), command('add_event', service), context), id = m.deadlines[0].id;
  const payload = { id, dueOn: '2026-11-09', legalBasis: 'Örnek dayanak — pilot avukat incelemesi', sourceReference: 'Tebliğ belge 3', ruleVersion: 'manual-review-1', confirmed: true };
  assert.throws(() => apply(m, command('verify_deadline', { ...payload, confirmed: false }), context), /onaylayın/);
  m = apply(m, command('verify_deadline', payload), context); assert.equal(m.deadlines[0].verifiedBy, context.actorId);
  m = apply(m, command('resolve_deadline', { id, status: 'met', note: 'Gönderim alındısı 42' }), context);
  assert.equal(m.deadlines[0].status, 'met'); assert.equal(m.deadlines[0].resolutionNote, 'Gönderim alındısı 42');
});
test('kapanış tüm açık öğeleri kontrol eder; arşiv yazılmaz, yeniden açma gerekçe/audit ister', () => {
  let m = apply(fixture(), command('add_task', { title: 'Açık iş' }), context);
  assert.throws(() => apply(m, command('archive', { reason: 'Bitti', closedOn: '2026-11-01' }), context), /1 görev/);
  m = apply(m, command('cancel_task', { id: m.tasks[0].id, reason: 'İşlem gereksiz' }), context);
  m = apply(m, command('archive', { reason: 'Tahsil edildi', closedOn: '2026-11-01' }), context);
  assert.equal(m.status, 'archived'); assert.equal(m.shared, false);
  assert.throws(() => apply(m, command('add_note', { body: 'Arşive yazma' }), context), /salt okunur/);
  assert.throws(() => apply(m, command('reopen'), context), /gerekçesi/);
  m = apply(m, command('reopen', { reason: 'Ek takip gerekiyor' }), context);
  assert.equal(m.status, 'active'); assert.equal(m.auditHistory.at(-1).action, 'reopen');
});
test('müvekkil/admin mutasyon yapamaz; özel taraf iletişimi ve notlar önizlemeye girmez', () => {
  for (const role of ['client', 'admin', 'viewer']) assert.throws(() => apply(fixture(), command('add_note', { body: 'Test' }), { ...context, role }), /avukat/);
  let m = apply({ ...fixture(), shared: true, client: 'Örnek Müvekkil' }, command('add_party', { name: 'Karşı taraf', role: 'Borçlu', contactNote: 'ÖZEL İLETİŞİM' }), context);
  m = apply(m, command('add_note', { body: 'ÖZEL STRATEJİ' }), context);
  assert.ok(!JSON.stringify(clientTrackingPreview(m)).includes('ÖZEL'));
});
test('çift yönlü dosya bağlantısı tek save; hatada iki taraf da korunur', () => {
  let rows = [fixture(), { ...fixture(), id: 'n' }], saves = 0;
  const repository = createTrackingRepository({ listMatters: () => structuredClone(rows), saveMatters: value => { rows = value; saves++; } });
  assert.throws(() => repository.link('m', 'm', 'related', context)); assert.equal(saves, 0);
  repository.link('m', 'n', 'enforcement_of', context); assert.equal(saves, 1);
  assert.equal(rows[0].links[0].matterId, 'n'); assert.equal(rows[1].links[0].matterId, 'm');
  assert.throws(() => repository.link('m', 'n', 'enforcement_of', context), /zaten/); assert.equal(saves, 1);
});
test('repository quota hatasını yayar; başarı sonucu üretmez ve taze aggregate üzerinden günceller', () => {
  const source = fixture(), repository = createTrackingRepository({ listMatters: () => [source], saveMatters: () => { throw new Error('quota'); } });
  assert.throws(() => repository.commit('m', command('add_note', { body: 'Test' }), context), /quota/); assert.equal(source.internalNotes, undefined);
});
test('türetilen icra dosyası ve iki yönlü bağlantı tek yazmada; istemci ve paylaşım aktarılmaz', () => {
  let rows=[{...fixture(),client:'Örnek',shared:true}],saves=0;
  const repository=createTrackingRepository({listMatters:()=>structuredClone(rows),saveMatters:value=>{rows=value;saves++}});
  const result=repository.derive('m',{type:'icra',subtype:'İlamsız takip',title:'Türetilmiş icra',stageKey:'hazirlik',number:'2026/184',numberKind:'icra_takip',linkKind:'enforcement_of'},context);
  assert.equal(saves,1);assert.equal(result.matter.shared,false);assert.equal(result.matter.client,'');
  assert.equal(rows[0].links[0].matterId,result.matter.id);assert.equal(result.matter.links[0].matterId,'m');
  assert.throws(()=>repository.derive('m',{type:'icra',title:''},context));assert.equal(saves,1);
});
test('manuel çalışma hedefi sonuçlandırılmadan kapanış yapılamaz; arşivde sıradaki iş gösterilmez',()=>{
  let m={...fixture(),next:'Evrak kontrolü',due:'2026-11-02'};
  assert.throws(()=>apply(m,command('archive',{reason:'Bitti',closedOn:'2026-11-02'}),context),/manuel/);
  m=apply(m,command('finish_manual_target'),context);assert.equal(m.next,'');assert.equal(m.due,'');
  m=apply(m,command('archive',{reason:'Bitti',closedOn:'2026-11-02'}),context);assert.equal(m.status,'archived');
});
