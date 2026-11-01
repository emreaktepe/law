import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecentMatterRepository } from '../src/data/recentMatterRepository.js';
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
test('son beş dosya tekilleşir; yeniden açılan dosya üste çıkar ve reload korunur', () => {
  const storage = memory(), repository = createRecentMatterRepository({ storage, ownerId: 'a', now: () => 'fixture' });
  for (let i = 0; i < 7; i++) repository.visit(String(i));
  assert.deepEqual(repository.list().map(item => item.id), ['6', '5', '4', '3', '2']); repository.visit('4');
  assert.deepEqual(createRecentMatterRepository({ storage, ownerId: 'a' }).list().map(item => item.id), ['4', '6', '5', '3', '2']);
});
test('hesaplar ayrıdır, içerik önbelleğe alınmaz ve dönen liste depo kaydını değiştirmez', () => {
  const storage = memory(), a = createRecentMatterRepository({ storage, ownerId: 'a' }), b = createRecentMatterRepository({ storage, ownerId: 'b' });
  a.visit('m'); assert.deepEqual(b.list(), []); const list = a.list(); list[0].id = 'changed'; assert.equal(a.list()[0].id, 'm');
  assert.deepEqual(Object.keys(a.list()[0]).sort(), ['id', 'visitedAt']);
});
test('bozuk kayıt boş döner; başarısız yazma başarı diye sunulmaz', () => {
  const repository = createRecentMatterRepository({ ownerId: 'a', storage: { getItem: () => 'invalid', setItem: () => { throw new Error('quota'); } } });
  assert.deepEqual(repository.list(), []); assert.throws(() => repository.visit('m'), /quota/); assert.throws(() => repository.visit(''));
});
