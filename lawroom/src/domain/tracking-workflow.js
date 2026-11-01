import { trackingMatter, isArchived, isOpenTask, partyRoles, numberKinds, expenseCategories } from './tracking-model.js';
import { getProceedingType, buildProceedingSuggestions } from './events.js';
import { normalizeMatterNumber } from '../lib/normalize.js';
import { completeMatterTask } from './matter-actions.js';

const fail = message => { throw new Error(message); };
const text = (value, label, max = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} gerekli; en fazla ${max} karakter girin.`);
  return value.trim();
};
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number), date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
const day = (value, label, optional = false) => !value && optional ? null : validDay(value) ? value : fail(`${label}: geçerli bir tarih girin.`);
const stamp = value => typeof value === 'string' && /T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const select = (value, values, label) => values.includes(value) ? value : fail(`${label} geçersiz.`);

/** Decimal string to minor units: no floating point money or locale ambiguity. */
export function expenseMinor(value) {
  const match = String(value).trim().match(/^(0|[1-9]\d{0,8})(?:[.,](\d{1,2}))?$/);
  if (!match) fail('Tutarı binlik ayırıcı olmadan, en fazla iki ondalıkla girin.');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}
export function expenseTotals(expenses) {
  return expenses.filter(e => !e.reversesId && !expenses.some(r => r.reversesId === e.id)).reduce((totals, e) => {
    const total = totals[e.currency] ||= { totalMinor: 0, billableMinor: 0 };
    total.totalMinor += e.amountMinor;
    if (e.billableToClient) total.billableMinor += e.amountMinor;
    return totals;
  }, {});
}
const openTask = (m, id) => m.tasks.find(t => t.id === id && isOpenTask(t)) || fail('Açık görev bulunamadı.');
const assignee = (m, actor, id) => {
  const selected = id || actor;
  if (selected !== actor && !(m.members || []).some(member => member.userId === selected && ['responsible', 'collaborator'].includes(member.role) && member.active !== false)) fail('Görev yalnız dosyanın aktif çalışma ekibine atanabilir.');
  return selected;
};
function task(m, input, ctx, sourceEventId = null) {
  return { id: ctx.makeId(), title: text(input.title, 'Görev başlığı', 200), dueOn: day(input.dueOn, 'Görev hedefi', true),
    assigneeId: assignee(m, ctx.actorId, input.assigneeId), priority: select(input.priority || 'normal', ['normal', 'high', 'critical'], 'Öncelik'),
    status: 'open', done: false, sourceEventId, createdAt: ctx.now, createdBy: ctx.actorId,
    kind: input.kind === 'client_document_request' ? 'client_document_request' : 'work',
    sharedWithClient: input.kind === 'client_document_request' && input.sharedWithClient === true,
    note: (input.note || '').trim().slice(0, 2000), };
}
function agenda(input, ctx) {
  if (!stamp(input.startsAt) || !stamp(input.endsAt) || Date.parse(input.endsAt) <= Date.parse(input.startsAt)) fail('Takvim başlangıç ve bitişini saat dilimiyle girin; bitiş daha sonra olmalı.');
  return { id: ctx.makeId(), title: text(input.title, 'Takvim başlığı', 200),
    kind: select(input.kind, ['hearing', 'discovery', 'expert', 'client_meeting', 'mediation', 'followup', 'internal'], 'Takvim türü'),
    startsAt: input.startsAt, endsAt: input.endsAt, location: (input.location || '').trim().slice(0, 300),
    sharedWithClient: input.sharedWithClient === true, status: 'planned', ownerId: ctx.actorId, createdAt: ctx.now };
}

/** Pure aggregate transaction. Use server RLS/RPC for live data; demo roles do not authorize live access. */
export function applyTrackingCommand(original, command, context) {
  const ctx = { now: new Date().toISOString(), makeId: () => crypto.randomUUID(), ...context };
  text(ctx.actorId, 'İşlemi yapan kişi', 200);
  if (ctx.role !== 'lawyer') fail('Bu işlem avukat çalışma alanına aittir.');
  if (!stamp(ctx.now)) fail('İşlem zamanı geçersiz.');
  if (!command || !command.type) fail('İşlem seçin.');
  if (command.key && original.auditHistory?.some(e => e.commandKey === command.key)) return original;
  const m = trackingMatter(original), p = command.payload || {};
  if (isArchived(m) && command.type !== 'reopen') fail('Arşiv dosya salt okunur. Önce gerekçesiyle yeniden açın.');
  let entityId = m.id;
  switch (command.type) {
    case 'add_event': {
      const definition = getProceedingType(p.eventType) || fail('Safahat türünü seçin.');
      const occurredOn = day(p.occurredOn, 'Olay tarihi');
      const servedOn = day(p.servedOn, 'Tebliğ tarihi', true);
      if (p.sourceDocumentId && !(m.documents || []).some(d => d.id === p.sourceDocumentId)) fail('Kaynak belge bulunamadı.');
      if (p.servedOn && !p.serviceMethod?.trim()) fail('Tebliğ yöntemi gereklidir.');
      const corrects = p.correctsEventId ? m.events.find(e => e.id === p.correctsEventId) || fail('Düzeltilecek kayıt bulunamadı.') : null;
      if (corrects && !p.correctionReason?.trim()) fail('Düzeltme gerekçesi gereklidir.');
      const id = ctx.makeId(); entityId = id;
      const suggestions = buildProceedingSuggestions({ eventType: p.eventType, matterType: m.type });
      const selected = p.taskIndexes || [];
      if (!Array.isArray(selected) || selected.some(i => !Number.isInteger(i) || !suggestions.tasks[i])) fail('Görev önerisi geçersiz.');
      const tasks = [...new Set(selected)].map(i => task(m, suggestions.tasks[i], ctx, id));
      const deadlines = [];
      if (p.requestDeadlineReview) {
        if (!servedOn || !p.serviceMethod?.trim() || !p.sourceReference?.trim()) fail('Süre incelemesi için tebliğ, yöntem ve kaynak gereklidir.');
        deadlines.push({ id: ctx.makeId(), title: 'Tebliğden doğan süreyi incele', status: 'proposed', sourceEventId: id,
          triggerDate: servedOn, serviceMethod: p.serviceMethod.trim(), sourceReference: p.sourceReference.trim(),
          proposedDueAt: day(p.proposedDueAt, 'Önerilen son gün', true), unverified: true, createdAt: ctx.now });
      }
      m.events.push({ id, title: text(p.title || definition.label, 'Safahat başlığı', 200), eventType: p.eventType,
        occurredOn, date: occurredOn, note: (p.note || '').trim().slice(0, 4000), servedOn,
        serviceMethod: (p.serviceMethod || '').trim(), sourceReference: (p.sourceReference || '').trim(),
        correctsEventId: corrects?.id || null, correctionReason: (p.correctionReason || '').trim(),
        sourceDocumentId: p.sourceDocumentId || null, shared: p.shared === true, clientSummary: p.shared ? text(p.clientSummary, 'Müvekkile açık açıklama', 1000) : '',
        createdAt: ctx.now, createdBy: ctx.actorId });
      m.tasks.push(...tasks); m.deadlines.push(...deadlines);
      if (corrects) m.deadlines = m.deadlines.map(d => d.sourceEventId === corrects.id && !['met', 'waived'].includes(d.status) ? { ...d, status: 'invalidated', invalidatedAt: ctx.now, invalidatedByEventId: id } : d);
      break;
    }
    case 'add_task': { const t = task(m, p, ctx); m.tasks.push(t); entityId = t.id; break; }
    case 'complete_task': return completeMatterTask({ ...m, tasks: m.tasks.map(t => t.id === p.id && t.status === 'review' ? { ...t, status: 'open' } : t) }, p.id, ctx.actorId, ctx);
    case 'postpone_task': {
      const t = openTask(m, p.id), reason = text(p.reason, 'Erteleme gerekçesi', 1000), dueOn = day(p.dueOn, 'Yeni hedef');
      if (t.dueOn && dueOn <= t.dueOn) fail('Yeni hedef önceki hedeften sonra olmalı.');
      m.tasks = m.tasks.map(item => item.id === t.id ? { ...item, dueOn, postponements: [...(item.postponements || []), { from: t.dueOn, to: dueOn, reason, actorId: ctx.actorId, at: ctx.now }] } : item);
      entityId = t.id; break;
    }
    case 'change_stage': {
      const stage = m.stageTemplate?.stages.find(s => s.key === p.stageKey) || fail('Dosya şablonundan bir aşama seçin.');
      const note = text(p.note, 'Aşama değişikliği notu', 1000);
      if (m.stageKey === stage.key) fail('Dosya zaten bu aşamada.');
      m.stageHistory.push({ id: ctx.makeId(), fromStage: m.stage, toStage: stage.label, actorId: ctx.actorId, at: ctx.now, note });
      m.stageKey = stage.key; m.stage = stage.label; break;
    }
    case 'add_number': {
      const value = text(p.value, 'Dosya numarası', 120), normalized = normalizeMatterNumber(value);
      const kind = select(p.kind, Object.keys(numberKinds), 'Numara türü');
      if (m.numbers.some(n => n.kind === kind && (normalized ? normalizeMatterNumber(n.value) === normalized : n.value === value))) fail('Bu numara zaten kayıtlı.');
      const n = { id: ctx.makeId(), value, normalized, kind, authority: (p.authority || '').trim(), isPrimary: !m.numbers.length || p.isPrimary === true, createdAt: ctx.now };
      if (n.isPrimary) { m.numbers = m.numbers.map(n => ({ ...n, isPrimary: false })); m.number = value; }
      m.numbers.push(n); entityId = n.id; break;
    }
    case 'add_party': {
      const party = { id: ctx.makeId(), name: text(p.name, 'Taraf adı', 200), role: select(p.role, partyRoles, 'Taraf rolü'),
        kind: select(p.kind || 'person', ['person', 'institution'], 'Taraf türü'), isClientSide: p.isClientSide === true,
        contactNote: (p.contactNote || '').trim().slice(0, 1000), createdAt: ctx.now };
      m.parties.push(party); entityId = party.id; break;
    }
    case 'add_note': {
      const note = { id: ctx.makeId(), body: text(p.body, 'İç not', 8000), actorId: ctx.actorId, createdAt: ctx.now };
      m.internalNotes.push(note); entityId = note.id; break;
    }
    case 'add_message': {
      if (!m.shared || !m.client) fail('Müvekkile mesaj için dosya paylaşımı ve müvekkil bağlantısı gereklidir.');
      const message = { id: ctx.makeId(), body: text(p.body, 'Mesaj', 8000), role: 'lawyer', createdAt: ctx.now };
      m.messages.push(message); entityId = message.id; break;
    }
    case 'add_expense': {
      const expense = { id: ctx.makeId(), category: select(p.category, expenseCategories, 'Masraf kalemi'), amountMinor: expenseMinor(p.amount),
        currency: select(p.currency || 'TRY', ['TRY', 'USD', 'EUR'], 'Para birimi'), spentOn: day(p.spentOn, 'Masraf tarihi'),
        paidBy: select(p.paidBy, ['office', 'client'], 'Ödeyen'), billableToClient: p.billableToClient === true,
        note: (p.note || '').trim().slice(0, 1000), createdAt: ctx.now, createdBy: ctx.actorId };
      m.expenses.push(expense); entityId = expense.id; break;
    }
    case 'reverse_expense': {
      const expense = m.expenses.find(e => e.id === p.id && !e.reversesId) || fail('Masraf bulunamadı.');
      if (m.expenses.some(e => e.reversesId === expense.id)) fail('Masraf zaten ters kaydedilmiş.');
      m.expenses.push({ id: ctx.makeId(), reversesId: expense.id, reason: text(p.reason, 'Ters kayıt gerekçesi', 1000), createdAt: ctx.now, createdBy: ctx.actorId });
      entityId = expense.id; break;
    }
    case 'add_agenda': { const a = agenda(p, ctx); m.agendaItems.push(a); entityId = a.id; break; }
    case 'hearing_outcome': {
      const hearing = m.agendaItems.find(a => a.id === p.id && a.kind === 'hearing' && a.status === 'planned') || fail('Sonuç bekleyen duruşma bulunamadı.');
      if (Date.parse(hearing.startsAt) > Date.parse(ctx.now)) fail('Gelecekteki duruşmaya sonuç girilemez.');
      const result = select(p.result, ['Ara karar', 'Ertelendi', 'Karar'], 'Duruşma sonucu');
      const note = text(p.note, 'Duruşma sonucu', 4000), eventId = ctx.makeId();
      const tasks = (p.tasks || []).map(t => task(m, t, ctx, eventId));
      let next = null;
      if (p.nextHearing) {
        next = agenda({ ...p.nextHearing, kind: 'hearing' }, ctx);
        if (Date.parse(next.startsAt) <= Date.parse(ctx.now)) fail('Sonraki duruşma gelecekte olmalı.');
      }
      m.events.push({ id: eventId, title: `Duruşma sonucu: ${result}`, eventType: 'durusma_yapildi', occurredOn: hearing.startsAt.slice(0, 10), date: hearing.startsAt.slice(0, 10), note,
        shared: p.shared === true, clientSummary: p.shared ? text(p.clientSummary, 'Müvekkile açık özet', 1000) : '', createdAt: ctx.now, createdBy: ctx.actorId });
      m.agendaItems = m.agendaItems.map(a => a.id === p.id ? { ...a, status: 'done', outcomeEventId: eventId } : a);
      if (next) m.agendaItems.push(next);
      m.tasks.push(...tasks); entityId = eventId; break;
    }
    case 'verify_deadline': {
      const deadline = m.deadlines.find(d => d.id === p.id && ['proposed', 'invalidated'].includes(d.status)) || fail('Doğrulanacak süre bulunamadı.');
      if (deadline.status === 'invalidated') fail('Kaynağı değişen süre için yeni safahat ve süre önerisi oluşturun.');
      const due = day(p.dueOn, 'Doğrulanmış son gün'), legalBasis = text(p.legalBasis, 'Hukuki dayanak', 1000), sourceReference = text(p.sourceReference, 'Kaynak referansı', 1000);
      if (!validDay(deadline.triggerDate) || !deadline.serviceMethod) fail('Tebliğ bilgileri eksik.');
      if (due < deadline.triggerDate) fail('Son gün tetikleyici tarihten önce olamaz.');
      if (deadline.proposedDueAt && deadline.proposedDueAt !== due && !p.note?.trim()) fail('Önerilen tarihi değiştirme gerekçesi gereklidir.');
      if (p.confirmed !== true) fail('Tebliğ, kaynak ve dayanağı kontrol ettiğinizi onaylayın.');
      m.deadlines = m.deadlines.map(d => d.id === p.id ? { ...d, status: 'verified', verifiedDueAt: due, verifiedAt: ctx.now, verifiedBy: ctx.actorId,
        legalBasis, sourceReference, ruleVersion: text(p.ruleVersion, 'Kural / inceleme sürümü', 100), verificationNote: (p.note || '').trim(), unverified: false } : d);
      entityId = p.id; break;
    }
    case 'resolve_deadline': {
      const d = m.deadlines.find(d => d.id === p.id && !['met', 'waived'].includes(d.status)) || fail('Açık süre bulunamadı.');
      const status = select(p.status, ['met', 'waived'], 'Süre sonucu');
      if (status === 'met' && d.status !== 'verified') fail('Önce süre ve dayanak doğrulanmalı.');
      m.deadlines = m.deadlines.map(d => d.id === p.id ? { ...d, status, resolutionNote: text(p.note, 'Sonuç / belge referansı', 1000), resolvedAt: ctx.now, resolvedBy: ctx.actorId } : d);
      entityId = p.id; break;
    }
    case 'cancel_task': {
      const t = openTask(m, p.id), reason = text(p.reason, 'İptal gerekçesi', 1000);
      m.tasks = m.tasks.map(item => item.id === t.id ? { ...item, status: 'cancelled', cancellationReason: reason, cancelledAt: ctx.now } : item);
      entityId = t.id; break;
    }
    case 'cancel_agenda': {
      const a = m.agendaItems.find(a => a.id === p.id && a.status === 'planned') || fail('Planlanmış kayıt bulunamadı.');
      m.agendaItems = m.agendaItems.map(item => item.id === a.id ? { ...item, status: 'cancelled', cancellationReason: text(p.reason, 'İptal gerekçesi', 1000) } : item); entityId = a.id; break;
    }
    case 'set_summary': m.summary = text(p.summary, 'Müvekkil açıklaması', 4000); break;
    case 'finish_manual_target':
      if (!m.next && !m.nextAction) fail('Açık manuel hedef bulunamadı.');
      m.next = ''; m.nextAction = ''; m.next_action = null; m.due = ''; m.targetDate = ''; m.target_date = null; break;
    case 'set_sharing':
      if (p.shared && !m.client) fail('Önce kabul edilmiş müvekkil bağlantısı kurulmalı.');
      m.shared = p.shared === true; break;
    case 'set_event_sharing': {
      const e = m.events.find(e => e.id === p.id) || fail('Safahat bulunamadı.');
      m.events = m.events.map(e => e.id === p.id ? { ...e, shared: p.shared === true, clientSummary: p.shared ? text(p.clientSummary, 'Müvekkile açık açıklama', 1000) : e.clientSummary } : e); entityId = p.id; break;
    }
    case 'archive': {
      const tasks = m.tasks.filter(isOpenTask).length, deadlines = m.deadlines.filter(d => !['met', 'waived', 'cancelled'].includes(d.status)).length,
        agendaItems = m.agendaItems.filter(a => a.status === 'planned' || !a.status).length;
      if (tasks + deadlines + agendaItems) fail(`Kapanıştan önce ${tasks} görev, ${deadlines} süre ve ${agendaItems} takvim kaydını sonuçlandırın.`);
      if (m.next || m.nextAction) fail('Kapanıştan önce manuel sıradaki iş hedefini sonuçlandırın.');
      m.closedReason = text(p.reason, 'Kapanış gerekçesi', 1000); m.closedOn = day(p.closedOn, 'Kapanış tarihi');
      m.status = 'archived'; m.archivedAt = ctx.now; m.shared = false; break;
    }
    case 'reopen':
      if (!isArchived(m)) fail('Dosya zaten açık.');
      text(p.reason, 'Yeniden açma gerekçesi', 1000); m.status = 'active'; m.archivedAt = null; m.archived_at = null;
      m.closedOn = null; break;
    default: fail('Bilinmeyen dosya işlemi.');
  }
  m.lastActivityAt = ctx.now;
  m.auditHistory.push({ id: ctx.makeId(), action: command.type, entityId, actorId: ctx.actorId, occurredAt: ctx.now,
    commandKey: command.key || null, reason: p.reason || p.note || null });
  return m;
}
