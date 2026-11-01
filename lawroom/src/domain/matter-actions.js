/** Pure demo/domain transition. Persistence and server authorization are separate boundaries. */
export function completeMatterTask(matter, taskId, actorId, { now = new Date().toISOString(), makeId = () => crypto.randomUUID() } = {}) {
  if (!actorId || typeof actorId !== 'string') throw new Error('İşlemi yapan kişi gereklidir.');
  if (matter.archivedAt || matter.archived_at || ['closed', 'archived'].includes(matter.status)) throw new Error('Kapalı veya arşiv dosyada görev değiştirilemez.');
  if (typeof now !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/u.test(now) || !Number.isFinite(Date.parse(now))) throw new Error('Geçerli işlem zamanı gereklidir.');
  const task = (matter.tasks || []).find(item => item.id === taskId);
  if (!task || task.done || task.completedAt || task.completed_at || (task.status && task.status !== 'open')) throw new Error('Açık görev bulunamadı.');
  return { ...matter, tasks: matter.tasks.map(item => item.id === taskId ? { ...item, done: true, status: 'completed', completedAt: now, completedBy: actorId } : item),
    lastActivityAt: now, auditHistory: [...(matter.auditHistory || []), { id: makeId(), action: 'task_completed', entityId: taskId, actorId, occurredAt: now }] };
}
