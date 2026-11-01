import test from 'node:test';
import assert from 'node:assert/strict';
import { cockpitModel, clientTrackingPreview, trackingMatter } from '../src/domain/tracking-model.js';
const now = '2026-11-01T09:00:00Z';
const matter = { id: 'm', title: 'Örnek', type: 'İş', number: '2026/184 E.', stage: 'Tahkikat', shared: true,
  summary: 'Paylaşılmış açıklama', notes: 'ÖZEL NOT', events: [{ title: 'Görünür', date: '2026-10-01', shared: true }, { title: 'Gizli', shared: false }],
  tasks: [{ id: 't', title: 'Hazırlık', dueOn: '2026-11-02' }], next: 'Manuel eski iş', due: '2026-11-01', messages: [] };
test('kokpit açık işten hesaplanır; eski manuel hedef veya verified boolean süreye dönüşmez', () => {
  const m = cockpitModel({ ...matter, verified: true }, now);
  assert.equal(m.next.title, 'Hazırlık'); assert.equal(m.counts.tasks, 1); assert.equal(m.matter.deadlines.length, 0);
  assert.equal(m.blockers.length, 1); assert.equal(m.matter.numbers[0].isPrimary, true);
});
test('müvekkil önizlemesi allow-list içerir; iç görev, not, özel olay, hesap ve ekip çıkmaz', () => {
  const view = clientTrackingPreview({ ...matter, expenses: [{ amount: 900 }], internalNotes: [{ body: 'ÇOK GİZLİ' }],
    tasks: [...matter.tasks, { id: 'r', title: 'Belgenizi iletin', kind: 'client_document_request', sharedWithClient: true }] });
  assert.equal(view.events.length, 1); assert.equal(view.requests.length, 1);
  assert.equal(view.stage, 'Deliller değerlendiriliyor');
  for (const text of ['ÖZEL', 'GİZLİ', 'Hazırlık', 'expenses', 'deadlines', 'auditHistory']) assert.ok(!JSON.stringify(view).includes(text));
  assert.equal(clientTrackingPreview({ ...matter, shared: false }), null);
});
test('legacy yansıtma orijinali değiştirmez; arşivde açık öğe ve salt okunur durum görünür', () => {
  const original = structuredClone(matter); const projected = trackingMatter(matter); projected.events[0].title = 'Değişti';
  assert.deepEqual(matter, original); assert.equal(cockpitModel({ ...matter, archivedAt: now }, now).readonly, true);
});
