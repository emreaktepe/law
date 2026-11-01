import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readSheet } from 'read-excel-file/node';
import { parseMatterCsv, previewMatterImport, guessImportMapping, importErrorCsv } from '../src/domain/matter-import.js';
import { createImportMatterRepository } from '../src/data/importMatterRepository.js';
const text = '\uFEFFBaşlık;Dosya türü;Birincil no;Makam;İlk iş;Çalışma hedefi\r\n"Örnek; takip";İcra;2026 / 00184 E.;Örnek daire;İncele;2026-11-03\r\n';
const table = parseMatterCsv(text), mapping = guessImportMapping(table[0]), context = { role: 'lawyer', actorId: 'owner' };
function memory(initial = []) { let data = structuredClone(initial), writes = 0; return { listMatters: () => structuredClone(data), saveMatters: next => { writes++; data = structuredClone(next); }, get writes() { return writes; }, set data(value) { data = value; } }; }
test('CSV BOM, noktalı virgül, tırnak içi ayırıcı/satır ve kaçış korunur', () => {
  assert.equal(table[1][0], 'Örnek; takip'); assert.equal(mapping.title, 0); assert.equal(mapping.type, 1);
  assert.equal(parseMatterCsv('Başlık,Tür\n"Bir\nikinin ""alıntısı""",İcra')[1][0], 'Bir\nikinin "alıntısı"');
  assert.throws(() => parseMatterCsv('A,B\n"Eksik,B'), /tırnak/);
});
test('eşleme ve önizleme satır hatalarını verir; tarih veya tür tahmin edilmez', () => {
  const preview = previewMatterImport(table, mapping); assert.equal(preview.errors.length, 0); assert.equal(preview.valid[0].draft.clientMode, 'none');
  const bad = structuredClone(table); bad.push(['Bozuk', 'Bilinmeyen tür', '2026/1', '', 'İş', '03/11/2026']);
  const errors = previewMatterImport(bad, mapping).errors; assert.ok(errors.some(error => error.row === 3 && error.field === 'type')); assert.ok(errors.some(error => error.field === 'targetDate'));
  assert.throws(() => previewMatterImport(table, { ...mapping, type: mapping.title }), /yalnız bir/);
  assert.match(importErrorCsv(errors), /Satır/); assert.match(importErrorCsv([{ row: 2, field: 'title', message: '=FORMULA' }]), /'=FORMULA/);
});
test('normalize numara aynı makamda mükerrer olamaz; başka makam ayrı kalır', () => {
  assert.equal(previewMatterImport(table, mapping, [{ number: '2026/184', court: 'Örnek daire' }]).errors[0].field, 'number');
  assert.equal(previewMatterImport(table, mapping, [{ number: '2026/184', court: 'Başka daire' }]).errors.length, 0);
  const duplicate = [...table, [...table[1]]]; assert.equal(previewMatterImport(duplicate, mapping).errors[0].row, 3);
});
test('önizleme yazmaz, aktarım tek write yapar; reload sonrası geri alma arşiv ve audit korur', async () => {
  const store = memory(), repository = createImportMatterRepository(store); repository.preview(table, mapping); assert.equal(store.writes, 0);
  const result = await repository.commit(table, mapping, context); assert.equal(store.writes, 1); assert.equal(result.matters[0].shared, false); assert.equal(result.matters[0].numbers[0].normalizedValue, '2026/184');
  const fresh = createImportMatterRepository(store); assert.equal(fresh.batches(context)[0].id, result.batchId);
  const undone = await fresh.undo(result.batchId, context); assert.equal(store.writes, 2); assert.equal(undone[0].status, 'archived'); assert.equal(undone[0].tasks[0].status, 'cancelled'); assert.equal(undone[0].auditHistory.at(-1).action, 'import_undone'); assert.equal(undone[0].number, result.matters[0].number);
});
test('sonradan değişen dosya veya başka actor varsa geri alma bütün olarak reddedilir', async () => {
  const store = memory(), repository = createImportMatterRepository(store), result = await repository.commit(table, mapping, context);
  await assert.rejects(repository.undo(result.batchId, { ...context, actorId: 'other' })); assert.equal(store.writes, 1);
  store.data = result.matters.map(matter => ({ ...matter, notes: 'Sonradan çalışma yapıldı' }));
  await assert.rejects(repository.undo(result.batchId, context), /sonradan değişti/); assert.equal(store.writes, 1);
});
test('hatalı satır, yetkisiz rol ve quota hatası kısmi veya başarılı aktarım üretmez', async () => {
  const store = memory(), repository = createImportMatterRepository(store), bad = structuredClone(table); bad[1][1] = 'Bilinmeyen';
  await assert.rejects(repository.commit(bad, mapping, context)); assert.equal(store.writes, 0);
  await assert.rejects(repository.commit(table, mapping, { ...context, role: 'admin' })); assert.equal(store.writes, 0);
  const failing = createImportMatterRepository({ listMatters: () => [], saveMatters: () => { throw new Error('quota'); } }); await assert.rejects(failing.commit(table, mapping, context), /quota/);
});
test('XLSX gerçek parser ile okunur; kolon eşleme CSV ile aynı domain doğrulamasından geçer', async () => {
  const rows = await readSheet(readFileSync(new URL('./fixtures/matter-import.xlsx', import.meta.url)));
  const preview = previewMatterImport(rows, guessImportMapping(rows[0])); assert.equal(preview.errors.length, 0); assert.equal(preview.valid[0].draft.title, 'XLSX örnek takip');
});
