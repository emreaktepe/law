import { getMatterTemplate } from './stages.js';
import { matterViewRecord, computeNextStep } from './matter-views.js';
import { normalizeSearchText } from '../lib/normalize.js';

export const trackingTabs = ['Genel', 'Safahat', 'Süre & görev', 'Takvim', 'Belgeler', 'Taraflar', 'Masraf', 'Mesajlar', 'İç notlar', 'Paylaşım', 'Geçmiş'];
export const partyRoles = ['Davacı', 'Davalı', 'Alacaklı', 'Borçlu', 'Şüpheli', 'Sanık', 'Müşteki', 'Katılan', 'Karşı vekil', 'Bilirkişi', 'Arabulucu', 'Diğer'];
export const numberKinds = { esas: 'Esas', karar: 'Karar', icra_takip: 'İcra takip', sorusturma: 'Soruşturma', istinaf_esas: 'İstinaf', temyiz_esas: 'Temyiz', arabuluculuk: 'Arabuluculuk', diger: 'Diğer' };
export const linkKinds = { derived_from: 'Türetilen dosya', enforcement_of: 'İcra bağlantısı', appeal_of: 'Kanun yolu', related: 'İlgili dosya' };
export const expenseCategories = ['Harç', 'Tebligat', 'Bilirkişi', 'Keşif', 'Yol', 'Diğer'];
export const isOpenTask = t => !t.done && !t.completedAt && !t.completed_at && (!t.status || t.status === 'open' || t.status === 'review');
export const isArchived = m => Boolean(m.archivedAt || m.archived_at || ['closed', 'archived'].includes(m.status));

/** Compatibility projection only: it never writes or authorizes an account. */
export function trackingMatter(matter) {
  const m = structuredClone(matter);
  const template = m.stageTemplate || m.stageSnapshot || getMatterTemplate(m.type || m.matter_type);
  const resolvedStage = template?.stages.find(s => s.key === (m.stageKey || m.stage_key) || s.label === m.stage || s.key === normalizeSearchText(m.stage).replaceAll(' ', '_'));
  return { ...matterViewRecord(m), client: m.client ?? (m.clients || []).map(c=>c.name).filter(Boolean).join(', '), stageKey: resolvedStage?.key || m.stageKey || m.stage_key || m.stage, number: m.number || m.reference || '', type: m.type || m.matter_type || 'Diğer',
    summary: m.summary || m.client_summary || '', stageTemplate: template ? structuredClone(template) : null,
    tasks: (m.tasks || []).map((t, i) => ({ ...t, id: t.id || `legacy-task-${m.id}-${i}`, dueOn: t.dueOn || t.due_on || null })),
    events: (m.events || []).map((e, i) => ({ ...e, id: e.id || `legacy-event-${m.id}-${i}`, occurredOn: e.occurredOn || e.occurred_on || e.date, eventType: e.eventType || e.event_type || 'diger' })),
    numbers: m.numbers?.length ? m.numbers : m.number || m.reference ? [{ id: `legacy-number-${m.id}`, kind: 'esas', value: m.number || m.reference, isPrimary: true, authority: m.court || '' }] : [],
    parties: m.parties || [], deadlines: matterViewRecord(m).deadlines, agendaItems: matterViewRecord(m).agendaItems,
    stageHistory: (m.stageHistory || []).map(e => ({ ...e, fromStage: e.fromStage ?? e.from, toStage: e.toStage ?? e.to, at: e.at || e.occurredAt })), auditHistory: m.auditHistory || [], links: m.links || [], expenses: m.expenses || [],
    internalNotes: m.internalNotes || (m.notes ? [{ id: `legacy-note-${m.id}`, body: m.notes, createdAt: null, actorId: 'Eski kayıt' }] : []),
  };
}

export function cockpitModel(matter, now = new Date().toISOString()) {
  const m = trackingMatter(matter);
  const next = isArchived(m) ? null : computeNextStep(m, now);
  const upcoming = [
    ...m.tasks.filter(isOpenTask).map(t => ({ id: t.id, title: t.title, date: t.dueOn, kind: 'Çalışma hedefi' })),
    ...m.agendaItems.filter(a => a.status === 'planned' || !a.status).map(a => ({ id: a.id, title: a.title, date: a.startsAt || a.allDayDate, kind: a.kind === 'hearing' ? 'Duruşma' : 'Takvim' })),
  ].filter(i => i.date).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 5);
  const blockers = [
    ...(next?.kind === 'manual' ? [{ kind: 'Manuel hedef', id: 'manual-target', title: next.title }] : []),
    ...m.tasks.filter(isOpenTask).map(t => ({ kind: 'Görev', id: t.id, title: t.title })),
    ...m.deadlines.filter(d => !['met', 'waived', 'cancelled'].includes(d.status)).map(d => ({ kind: 'Süre', id: d.id, title: d.title || 'Süre incelemesi' })),
    ...m.agendaItems.filter(a => !a.status || a.status === 'planned').map(a => ({ kind: 'Takvim', id: a.id, title: a.title })),
  ];
  return { matter: m, next, upcoming, blockers, readonly: m.readonly === true || isArchived(m), counts: { tasks: m.tasks.filter(isOpenTask).length, deadlines: m.deadlines.filter(d => ['proposed', 'invalidated'].includes(d.status)).length, events: m.events.length } };
}

/** Explicit allow-list. This demo preview is never a substitute for server RLS. */
export function clientTrackingPreview(matter) {
  const m = trackingMatter(matter);
  if (!m.shared || isArchived(m)) return null;
  const template = m.stageTemplate;
  const stage = template?.stages.find(s => s.key === m.stageKey || s.label === m.stage || s.key === normalizeSearchText(m.stage).replaceAll(' ', '_'));
  return { id: m.id, title: m.title, number: m.number, stage: stage?.clientLabel || 'Avukatınız süreci takip ediyor', summary: m.summary,
    events: m.events.filter(e => e.shared).map(e => ({ id: e.id, title: e.clientSummary || e.title, occurredOn: e.occurredOn })),
    agendaItems: m.agendaItems.filter(a => a.sharedWithClient && a.status !== 'cancelled').map(a => ({ id: a.id, title: a.title, startsAt: a.startsAt, allDayDate: a.allDayDate })),
    requests: m.tasks.filter(t => t.kind === 'client_document_request' && t.sharedWithClient && isOpenTask(t)).map(t => ({ id: t.id, title: t.title, dueOn: t.dueOn, status: t.status || 'open' })),
    documents: (m.documents || []).filter(d => d.shared).map(d => ({ id: d.id, name: d.name, shared: true, category: d.category, versions: d.versions.map(v => ({ id: v.id, name: v.name, number: v.number, sizeBytes: v.sizeBytes, mediaType: v.mediaType, createdAt: v.createdAt })) })),
  };
}
