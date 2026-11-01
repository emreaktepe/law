import { validDay } from './tracking-workflow.js';

const DAY = 86400000;
const toDay = value => Date.parse(value + 'T00:00:00Z');
const key = value => new Date(value).toISOString().slice(0, 10);
const unknown = reason => ({ status: 'uncalculable', proposedDueAt: null, unverified: true, reason, steps: [] });

/**
 * Arithmetic proposal only. No Turkish procedure or duration is assumed.
 * The caller supplies an explicitly sourced rule and a complete holiday year set.
 * A successful calculation NEVER verifies a deadline; a lawyer must review it separately.
 */
export function calculateDeadline({ triggerDate, serviceMethod, rule, calendar }) {
  if (!validDay(triggerDate) || !serviceMethod?.trim()) return unknown('Tetikleyici tarih ve tebliğ yöntemi açık olmalıdır.');
  if (!rule || !rule.key || !rule.version || !rule.legalBasis?.trim() || !rule.sourceReference?.trim()) return unknown('Kaynaklı ve sürümlü kural seçilmedi.');
  if (!Number.isInteger(rule.value) || rule.value < 1 || rule.value > 3660 || !['day', 'week', 'month'].includes(rule.unit)) return unknown('Süre miktarı veya birimi belirsiz.');
  if (!['following_day', 'trigger_day'].includes(rule.countFrom)) return unknown('Sayımın hangi günden başlayacağı belirlenmedi.');
  if (!['next_business_day', 'keep'].includes(rule.nonBusinessDay)) return unknown('Son günün tatil etkisi belirlenmedi.');
  if (!['does_not_apply', 'extend_after_recess'].includes(rule.judicialRecess?.mode)) return unknown('Adli tatil etkisi belirsiz; hukukçu incelemesi gerekli.');
  if (!Array.isArray(calendar?.completeYears) || !Array.isArray(calendar.days)) return unknown('Kaynaklı ve tam tatil takvimi gerekli.');
  if (calendar.days.some(h => !validDay(h.day) || !h.source?.trim() || !['official', 'half_day'].includes(h.kind))) return unknown('Tatil takviminde kaynaksız veya geçersiz kayıt var.');
  let due = toDay(triggerDate), steps = [];
  if (rule.unit === 'month') {
    if (rule.countFrom !== 'following_day' || rule.monthOverflow !== 'last_day') return unknown('Ay hesabında başlangıç veya ay sonu davranışı belirsiz.');
    const start = new Date(due), year = start.getUTCFullYear(), month = start.getUTCMonth() + rule.value;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    due = Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay));
  } else due += (rule.value * (rule.unit === 'week' ? 7 : 1) - (rule.countFrom === 'trigger_day' ? 1 : 0)) * DAY;
  steps.push({ kind: 'offset', from: triggerDate, to: key(due), ruleKey: rule.key, ruleVersion: rule.version });
  function covered(timestamp) { return calendar.completeYears.includes(new Date(timestamp).getUTCFullYear()); }
  if (!covered(toDay(triggerDate)) || !covered(due)) return unknown('Başlangıç veya sonuç yılı için tam tatil takvimi yok.');
  if (rule.judicialRecess.mode === 'extend_after_recess') {
    const recess = rule.judicialRecess;
    if (!validDay(recess.from) || !validDay(recess.to) || recess.to < recess.from || !Number.isInteger(recess.extensionDays) || recess.extensionDays < 1 || recess.extensionDays > 365) return unknown('Adli tatil aralığı veya uzatma kuralı eksik.');
    if (key(due) >= recess.from && key(due) <= recess.to) {
      const before = key(due); due = toDay(recess.to) + recess.extensionDays * DAY;
      steps.push({ kind: 'judicial_recess', from: before, to: key(due) });
    }
  }
  if (rule.nonBusinessDay === 'next_business_day') {
    const original = key(due); let attempts = 0;
    while (attempts++ < 370) {
      if (!covered(due)) return unknown('Tatil kaydırmasının ulaştığı yıl için tam takvim yok.');
      const holiday = calendar.days.filter(h => h.day === key(due)), weekday = new Date(due).getUTCDay();
      if (holiday.some(h => h.kind === 'half_day') && !['same_day', 'next_business_day'].includes(rule.halfDay)) return unknown('Yarım gün için son saat / kaydırma etkisi belirsiz.');
      if (![0, 6].includes(weekday) && !holiday.some(h => h.kind === 'official' || h.kind === 'half_day' && rule.halfDay === 'next_business_day')) break;
      due += DAY;
    }
    if (attempts >= 370) return unknown('İş günü bulunamadı; tatil takvimini kontrol edin.');
    if (original !== key(due)) steps.push({ kind: 'non_business_day', from: original, to: key(due) });
  }
  if (!covered(due)) return unknown('Sonuç yılı için tam tatil takvimi yok.');
  return { status: 'proposed', proposedDueAt: key(due), unverified: true, ruleKey: rule.key, ruleVersion: rule.version,
    triggerDate, serviceMethod, legalBasis: rule.legalBasis, sourceReference: rule.sourceReference, steps,
    reason: 'Doğrulanmamış çalışma hesabı. Uygulanabilirlik, tebliğ ve son gün avukat tarafından kontrol edilmelidir.' };
}

// Deliberately no pre-approved legal rules or holiday years are shipped.
export const deadlineRules = Object.freeze([]);
