import { getMatterTemplate, createMatterStageSnapshot } from './stages.js';
import { normalizeMatterNumber } from '../lib/normalize.js';
const text = value => typeof value === 'string' ? value.trim() : '';
export const numberKinds = Object.freeze({ esas: 'Esas', karar: 'Karar', icra_takip: 'İcra takip', sorusturma: 'Soruşturma', istinaf_esas: 'İstinaf esas', temyiz_esas: 'Temyiz esas', arabuluculuk: 'Arabuluculuk', diger: 'Diğer' });
export function validMatterDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number), date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function validateMatterDraft(input, step = 5, acceptedClients = []) {
  const errors = {}, template = getMatterTemplate(input.type);
  if (step >= 1) {
    if (!template) errors.type = 'Dosya türünü seçin.';
    if (template && !template.subtypes.includes(input.subtype)) errors.subtype = 'Bu dosya türünden bir alt tür seçin.';
  }
  if (step >= 2) {
    if (!text(input.title) || text(input.title).length > 160) errors.title = 'Başlık 1–160 karakter olmalıdır.';
    if (text(input.number) && (!normalizeMatterNumber(input.number) || input.number.length > 100)) errors.number = 'Yıl ve sıra numarasını kontrol edin. Örnek: 2026/184 E.';
    if (text(input.number) && !Object.hasOwn(numberKinds, input.numberKind)) errors.numberKind = 'Numara türünü seçin.';
    if (text(input.court).length > 200) errors.court = 'Makam 200 karakteri aşamaz.';
  }
  if (step >= 3) {
    if (!['none', 'accepted', 'party'].includes(input.clientMode)) errors.clientMode = 'Müvekkil seçimini kontrol edin.';
    if (input.clientMode === 'accepted' && !acceptedClients.some(client => client.id === input.clientId && client.status === 'accepted')) errors.clientId = 'Yalnız kabul edilmiş müvekkiller bağlanabilir.';
    if (input.clientMode === 'party' && (!text(input.partyName) || text(input.partyName).length > 160)) errors.partyName = 'Taraf adı 1–160 karakter olmalıdır.';
  }
  if (step >= 4) {
    if (template && !template.stages.some(stage => stage.key === input.stageKey)) errors.stageKey = 'Başlangıç aşamasını seçin.';
    if (text(input.nextAction).length > 500) errors.nextAction = 'İlk iş 500 karakteri aşamaz.';
    if (text(input.targetDate) && !validMatterDate(input.targetDate)) errors.targetDate = 'Geçerli hedef tarihi girin.';
    if (text(input.targetDate) && !text(input.nextAction)) errors.nextAction = 'Hedef tarihin ait olduğu işi yazın.';
  }
  return errors;
}

/** Creates a demo/domain value; never creates membership or shares data on a server. */
export function buildMatterFromDraft(input, { actorId, acceptedClients = [], now = new Date().toISOString(), makeId = () => crypto.randomUUID() }) {
  const errors = validateMatterDraft(input, 5, acceptedClients);
  if (Object.keys(errors).length) throw Object.assign(new Error('Dosya bilgilerini kontrol edin.'), { fields: errors });
  if (!actorId || typeof actorId !== 'string') throw new Error('Sorumlu avukat gereklidir.');
  if (!/(Z|[+-]\d{2}:\d{2})$/u.test(now) || !Number.isFinite(Date.parse(now))) throw new Error('İşlem zamanı geçersiz.');
  const template = createMatterStageSnapshot(input.type), stage = template.stages.find(item => item.key === input.stageKey);
  const accepted = input.clientMode === 'accepted' ? acceptedClients.find(client => client.id === input.clientId && client.status === 'accepted') : null;
  const number = text(input.number), firstTask = text(input.nextAction), partyName = input.clientMode === 'party' ? text(input.partyName) : '';
  return { id: makeId(), title: text(input.title), type: template.label, typeKey: template.key, subtype: input.subtype,
    number, numbers: number ? [{ id: makeId(), kind: input.numberKind, value: number, normalizedValue: normalizeMatterNumber(number), authority: text(input.court), isPrimary: true, validFrom: now.slice(0, 10) }] : [],
    court: text(input.court), client: accepted?.name || '', clientId: accepted?.id || null,
    clients: accepted ? [{ id: accepted.id, name: accepted.name }] : [],
    parties: partyName ? [{ id: makeId(), name: partyName, role: 'client_side', userId: null }] : [],
    responsibleId: actorId, status: 'active', shared: false, stageKey: stage.key, stage: stage.label,
    templateVersion: template.version, stageSnapshot: template, createdAt: now, lastActivityAt: now,
    stageHistory: [{ id: makeId(), from: null, to: stage.key, actorId, occurredAt: now, note: 'Dosya oluşturuldu.' }],
    auditHistory: [{ id: makeId(), action: 'matter_created', actorId, occurredAt: now }],
    next: '', nextAction: '', due: '', targetDate: '', verified: false,
    tasks: firstTask ? [{ id: makeId(), title: firstTask, dueOn: text(input.targetDate) || null, assigneeId: actorId, priority: 'normal', done: false, status: 'open', sharedWithClient: false }] : [],
    deadlines: [], agendaItems: [], events: [], messages: [], notes: '', summary: '',
  };
}
