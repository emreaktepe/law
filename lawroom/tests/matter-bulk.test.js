import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMatterBulk } from '../src/domain/matter-bulk.js';
import { createBulkMatterRepository } from '../src/data/bulkMatterRepository.js';
const matters = [{ id: 'a', type: 'İcra', tasks: [], events: [], messages: [], responsibleId: 'owner', members: [{ userId: 'team', role: 'collaborator', active: true }] }, { id: 'b', type: 'İcra', tasks: [], events: [], messages: [], responsibleId: 'owner', members: [{ userId: 'team', role: 'collaborator', active: true }] }];
const context = { role: 'lawyer', actorId: 'owner', now: '2026-11-02T09:00:00Z', makeId: () => 'fixture' };
test('toplu sorumlu atama tüm dosyalarda üyelik ister ve audit ekler; girdi değişmez', () => {
  const before = structuredClone(matters), command = { type: 'assign_responsible', responsibleId: 'team', responsibleName: 'Ekip', reason: 'İş paylaşımı' };
  const next = applyMatterBulk(matters, ['a', 'b'], command, context);
  assert.deepEqual(matters, before); assert.equal(next[0].responsibleId, 'team'); assert.equal(next[1].auditHistory[0].previousResponsibleId, 'owner');
  assert.throws(() => applyMatterBulk([matters[0], { ...matters[1], members: [] }], ['a', 'b'], command, context));
});
test('arşiv önizleme yazmaz, commit bir kez yazar; açık öğede hiçbir dosya değişmez', () => {
  let saved = 0, data = structuredClone(matters); const repository = createBulkMatterRepository({ listMatters: () => structuredClone(data), saveMatters: next => { saved++; data = next; } });
  const command = { type: 'archive', reason: 'Takip tamamlandı', closedOn: '2026-11-02' };
  assert.equal(repository.preview(['a', 'b'], command, context).length, 2); assert.equal(saved, 0); repository.commit(['a', 'b'], command, context); assert.equal(saved, 1); assert.equal(data[1].shared, false);
  const blocked = [matters[0], { ...matters[1], tasks: [{ id: 'open', title: 'İş' }] }], before = structuredClone(blocked);
  assert.throws(() => applyMatterBulk(blocked, ['a', 'b'], command, context)); assert.deepEqual(blocked, before);
});
test('eksik/tekrar seçim, yetkisiz rol, gerekçesiz ve depo hatası atomik başarısızdır', () => {
  const command = { type: 'assign_responsible', responsibleId: 'owner', reason: 'Dağılım' };
  for (const ids of [[], ['a', 'a'], ['a', 'missing']]) assert.throws(() => applyMatterBulk(matters, ids, command, context));
  assert.throws(() => applyMatterBulk(matters, ['a'], command, { ...context, role: 'admin' })); assert.throws(() => applyMatterBulk(matters, ['a'], { ...command, reason: '' }, context));
  const repository = createBulkMatterRepository({ listMatters: () => matters, saveMatters: () => { throw new Error('quota'); } });
  assert.throws(() => repository.commit(['a'], command, context), /quota/); assert.equal(matters[0].responsibleId, 'owner');
});
