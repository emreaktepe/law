import { applyTrackingCommand, validDay } from './tracking-workflow.js';
import { isArchived } from './tracking-model.js';

/** Validate the entire selected set before returning any updated values. Demo/domain only. */
export function applyMatterBulk(matters, ids, command, context) {
  if (context?.role !== 'lawyer' || !context.actorId) throw new Error('Avukat çalışma alanı gerekir.');
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new Error('1–500 farklı dosya seçin.');
  const byId = new Map(matters.map(matter => [matter.id, matter]));
  const selected = ids.map(id => { const matter = byId.get(id); if (!matter || isArchived(matter)) throw new Error('Seçili dosyalardan biri bulunamadı veya arşivde.'); return matter; });
  const reason = typeof command.reason === 'string' ? command.reason.trim() : '';
  if (!reason || reason.length > 1000) throw new Error('İşlem gerekçesi 1–1000 karakter olmalıdır.');
  const now = context.now || new Date().toISOString(), makeId = context.makeId || (() => crypto.randomUUID());
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(now) || !validDay(now.slice(0, 10)) || !Number.isFinite(Date.parse(now))) throw new Error('İşlem zamanı geçersiz.');
  if (!['assign_responsible', 'archive'].includes(command.type)) throw new Error('Desteklenmeyen toplu işlem.');
  const updates = new Map(selected.map(matter => {
    if (command.type === 'archive') return [matter.id, applyTrackingCommand(matter, { type: 'archive', payload: { reason, closedOn: command.closedOn } }, { ...context, now, makeId })];
    const eligible = command.responsibleId === context.actorId || matter.responsibleId === command.responsibleId || (matter.members || []).some(member => member.userId === command.responsibleId && ['responsible', 'collaborator'].includes(member.role) && member.active !== false);
    if (!command.responsibleId || !eligible) throw new Error('Sorumlu, seçili her dosyanın aktif ekibinde olmalıdır.');
    return [matter.id, { ...matter, responsibleId: command.responsibleId, responsibleName: String(command.responsibleName || '').slice(0, 160), lastActivityAt: now,
      auditHistory: [...(matter.auditHistory || []), { id: makeId(), action: 'assign_responsible', actorId: context.actorId, occurredAt: now, previousResponsibleId: matter.responsibleId || null, responsibleId: command.responsibleId, reason }] }];
  }));
  return matters.map(matter => updates.get(matter.id) || matter);
}
