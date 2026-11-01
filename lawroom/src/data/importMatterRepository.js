import { demoRepository } from './demoRepository.js';
import { buildMatterFromDraft } from '../domain/matter-create.js';
import { normalizeImportTable, parseMatterCsv, previewMatterImport } from '../domain/matter-import.js';

/** Local file parsing only; no upload or application API request. */
export async function readMatterImportFile(file) {
  if (!file || file.size > 5 * 1024 * 1024) throw new Error('En fazla 5 MB CSV veya XLSX dosyası seçin.');
  if (/\.csv$/iu.test(file.name)) return parseMatterCsv(await file.text());
  if (!/\.xlsx$/iu.test(file.name)) throw new Error('CSV veya XLSX seçin. Eski XLS ve makrolu dosyalar desteklenmez.');
  const { readSheet } = await import('read-excel-file/browser');
  return normalizeImportTable(await readSheet(file));
}
async function fingerprint(matter) {
  const copy = { ...matter }; for (const key of ['importBatchId', 'importRow', 'importedAt', 'importFingerprint', 'importUndoneAt']) delete copy[key];
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(copy)));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function createImportMatterRepository(repository = demoRepository) {
  return {
    preview(table, mapping) { return previewMatterImport(table, mapping, repository.listMatters()); },
    async commit(table, mapping, context) {
      if (context?.role !== 'lawyer' || !context.actorId) throw new Error('Avukat çalışma alanı gerekir.');
      const current = repository.listMatters(), original = JSON.stringify(current), preview = previewMatterImport(table, mapping, current);
      if (preview.errors.length || !preview.valid.length) throw new Error('Aktarımdan önce tüm hataları düzeltin. Hiçbir kayıt oluşturulmadı.');
      const batchId = crypto.randomUUID(), now = new Date().toISOString();
      const created = await Promise.all(preview.valid.map(async row => { const matter = { ...buildMatterFromDraft(row.draft, { actorId: context.actorId, now }), responsibleName: context.actorName || '', notes: row.notes };
        return { ...matter, importBatchId: batchId, importRow: row.row, importedAt: now, importFingerprint: await fingerprint(matter) }; }));
      if (JSON.stringify(repository.listMatters()) !== original) throw new Error('Dosyalar aktarım sırasında değişti. Önizlemeyi yenileyin.');
      const next = [...current, ...created]; repository.saveMatters(next); return { matters: next, batchId, count: created.length };
    },
    batches(context) {
      const batches = new Map(); for (const matter of repository.listMatters()) if (matter.importBatchId && !matter.importUndoneAt && (!context?.actorId || matter.auditHistory?.[0]?.actorId === context.actorId)) { const batch = batches.get(matter.importBatchId) || { id: matter.importBatchId, importedAt: matter.importedAt, count: 0 }; batch.count++; batches.set(batch.id, batch); }
      return [...batches.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    },
    async undo(batchId, context) {
      if (context?.role !== 'lawyer' || !context.actorId) throw new Error('Avukat çalışma alanı gerekir.');
      const current = repository.listMatters(), original = JSON.stringify(current), batch = current.filter(matter => matter.importBatchId === batchId && !matter.importUndoneAt);
      if (!batch.length) throw new Error('Geri alınabilecek aktarım bulunamadı.');
      if (batch.some(matter => matter.auditHistory?.[0]?.actorId !== context.actorId)) throw new Error('Yalnız kendi aktarımınızı geri alabilirsiniz.');
      const unchanged = await Promise.all(batch.map(async matter => matter.importFingerprint && matter.importFingerprint === await fingerprint(matter)));
      if (unchanged.some(value => !value)) throw new Error('Aktarılan dosyalardan biri sonradan değişti. Toplu geri alma yapılmadı; dosyaları ayrı inceleyin.');
      if (JSON.stringify(repository.listMatters()) !== original) throw new Error('Dosyalar kontrol sırasında değişti. Yeniden deneyin.');
      const now = new Date().toISOString(), next = current.map(matter => batch.includes(matter) ? { ...matter, status: 'archived', archivedAt: now, closedOn: now.slice(0, 10), closedReason: 'İçe aktarma geri alındı', shared: false, importUndoneAt: now,
        tasks: matter.tasks.map(task => ({ ...task, status: 'cancelled', cancellationReason: 'İçe aktarma geri alındı', cancelledAt: now })),
        auditHistory: [...matter.auditHistory, { id: crypto.randomUUID(), action: 'import_undone', actorId: context.actorId, occurredAt: now }] } : matter);
      repository.saveMatters(next); return next;
    },
  };
}
export const importMatterRepository = createImportMatterRepository();
