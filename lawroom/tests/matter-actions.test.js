import test from 'node:test';
import assert from 'node:assert/strict';
import { completeMatterTask } from '../src/domain/matter-actions.js';
const matter = { id: 'm', tasks: [{ id: 't', title: 'İncele', status: 'open' }, { id: 'other', title: 'Diğer' }] };
const options = { now: '2026-11-01T12:00:00+03:00', makeId: () => 'audit-1' };
test('görev tamamlama kaynak kaydı değiştirmeden kişi, zaman ve audit ekler', () => {
  const before = structuredClone(matter), next = completeMatterTask(matter, 't', 'lawyer-a', options);
  assert.deepEqual(matter, before); assert.equal(next.tasks[0].done, true); assert.equal(next.tasks[0].completedBy, 'lawyer-a');
  assert.deepEqual(next.tasks[1], matter.tasks[1]); assert.equal(next.lastActivityAt, options.now);
  assert.deepEqual(next.auditHistory, [{ id: 'audit-1', action: 'task_completed', entityId: 't', actorId: 'lawyer-a', occurredAt: options.now }]);
});
test('kapalı/arşiv dosya, eksik kişi ve bulunmayan görev değiştirilemez', () => {
  for (const patch of [{ status: 'closed' }, { status: 'archived' }, { archived_at: options.now }]) assert.throws(() => completeMatterTask({ ...matter, ...patch }, 't', 'a', options));
  assert.throws(() => completeMatterTask(matter, 'missing', 'a', options)); assert.throws(() => completeMatterTask(matter, 't', '', options));
});
test('tamamlanan veya iptal görevde tekrar audit üretilmez', () => {
  const done = completeMatterTask(matter, 't', 'a', options);
  assert.throws(() => completeMatterTask(done, 't', 'a', options));
  assert.throws(() => completeMatterTask({ ...matter, tasks: [{ id: 't', status: 'cancelled' }] }, 't', 'a', options));
  assert.throws(() => completeMatterTask(matter, 't', 'a', { ...options, now: '2026-11-01' }));
});
