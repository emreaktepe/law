import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatterFromDraft, validateMatterDraft } from '../src/domain/matter-create.js';
import { completeMatterTask } from '../src/domain/matter-actions.js';
import { computeNextStep } from '../src/domain/matter-views.js';
import { getMatterTemplate } from '../src/domain/stages.js';
const base = { type: 'icra', subtype: 'İlamsız takip', title: 'Örnek takip', number: '2026 / 00184 E.', numberKind: 'icra_takip', court: 'Örnek İcra Dairesi', clientMode: 'none', stageKey: 'hazirlik', nextAction: '', targetDate: '' };
let id = 0; const options = () => ({ actorId: 'lawyer-a', now: '2026-11-01T12:00:00+03:00', makeId: () => 'id-' + (++id) });
test('müvekkilsiz dosya özel başlar; normal numara, snapshot ve audit korunur', () => {
  const before = structuredClone(base), result = buildMatterFromDraft(base, options());
  assert.deepEqual(base, before); assert.equal(result.shared, false); assert.equal(result.clientId, null); assert.deepEqual(result.clients, []);
  assert.equal(result.number, base.number); assert.equal(result.numbers[0].normalizedValue, '2026/184'); assert.equal(result.numbers[0].isPrimary, true);
  assert.equal(result.responsibleId, 'lawyer-a'); assert.equal(result.stageHistory[0].actorId, 'lawyer-a'); assert.equal(result.auditHistory[0].action, 'matter_created');
  result.stageSnapshot.stages[0].label = 'Dosyaya özel'; assert.notEqual(getMatterTemplate('icra').stages[0].label, 'Dosyaya özel');
  assert.deepEqual(result.deadlines, []); assert.equal(result.verified, false);
});
test('adı yazılan taraf portal hesabı bağlamaz; seçilmiş kabul paylaşım açmaz', () => {
  const party = buildMatterFromDraft({ ...base, clientMode: 'party', partyName: 'Örnek Kişi' }, options());
  assert.equal(party.parties[0].userId, null); assert.equal(party.clientId, null); assert.equal(party.shared, false);
  const acceptedClients = [{ id: 'client-a', name: 'Kabul edilen', status: 'accepted' }, { id: 'client-b', name: 'Atanan', status: 'assigned' }];
  const accepted = buildMatterFromDraft({ ...base, clientMode: 'accepted', clientId: 'client-a' }, { ...options(), acceptedClients });
  assert.equal(accepted.clientId, 'client-a'); assert.equal(accepted.shared, false);
  assert.throws(() => buildMatterFromDraft({ ...base, clientMode: 'accepted', clientId: 'client-b' }, { ...options(), acceptedClients }));
});
test('numara boş olabilir; belirsiz numara, yanlış aşama/tür ve geçersiz tarih reddedilir', () => {
  assert.deepEqual(buildMatterFromDraft({ ...base, number: '' }, options()).numbers, []);
  for (const patch of [{ type: 'missing' }, { subtype: 'missing' }, { stageKey: 'missing' }, { number: '2026/184/3' }, { targetDate: '2026-02-30', nextAction: 'İncele' }, { targetDate: '2026-11-02' }, { title: ' ' }]) assert.throws(() => buildMatterFromDraft({ ...base, ...patch }, options()));
  assert.equal(Object.keys(validateMatterDraft({ type: 'icra', subtype: 'İlamsız takip' }, 1)).length, 0);
});
test('ilk iş özel görev olur; çalışma tarihi hukuki süreye dönüşmez', () => {
  const result = buildMatterFromDraft({ ...base, nextAction: 'Evrakı incele', targetDate: '2026-11-03' }, options());
  assert.equal(result.tasks[0].dueOn, '2026-11-03'); assert.equal(result.tasks[0].assigneeId, 'lawyer-a'); assert.equal(result.tasks[0].sharedWithClient, false);
  assert.equal(result.tasks[0].status, 'open'); assert.deepEqual(result.deadlines, []); assert.equal(result.verified, false);
});

test('ilk görev tamamlanınca aynı iş manuel sonraki adım olarak geri dönmez', () => {
  const matter=buildMatterFromDraft({...base,nextAction:'Evrakı incele',targetDate:'2026-11-03'},options());
  const done=completeMatterTask(matter,matter.tasks[0].id,'lawyer-a',{now:'2026-11-02T09:00:00Z'});
  assert.equal(computeNextStep(done,'2026-11-02T09:00:00Z'),null);
});
