import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeadline as calculate, deadlineRules } from '../src/domain/deadlines.js';
const rule = { key: 'test-only', version: 'qa-1', legalBasis: 'Sentetik test kuralı; mevzuat değildir', sourceReference: 'QA fixture', value: 2, unit: 'day', countFrom: 'following_day', nonBusinessDay: 'next_business_day', judicialRecess: { mode: 'does_not_apply' } };
const calendar = { completeYears: [2026, 2027], days: [] };
const input = { triggerDate: '2026-11-05', serviceMethod: 'QA', rule, calendar };
test('tarih aritmetiği yalnız öneri üretir; hafta sonu kaydırması gerekçesi görünür', () => {
  const result = calculate(input); assert.equal(result.proposedDueAt, '2026-11-09'); assert.equal(result.status, 'proposed'); assert.equal(result.unverified, true); assert.equal(result.steps[1].kind, 'non_business_day');
  assert.deepEqual(deadlineRules, []);
  assert.equal(calculate({ ...input, rule: { ...rule, unit:'week',value:2,countFrom:'trigger_day',nonBusinessDay:'keep' } }).proposedDueAt, '2026-11-18');
});
test('kaynaklı tatil ve yıl geçişi; kapsam dışı yıl tahmin edilmez', () => {
  const result = calculate({ ...input, triggerDate: '2026-12-30', calendar: { ...calendar, days: [{ day: '2027-01-01', kind: 'official', source: 'QA' }] } });
  assert.equal(result.proposedDueAt, '2027-01-04');
  assert.equal(calculate({ ...input, triggerDate: '2026-12-30', calendar: { completeYears: [2026], days: [] } }).status, 'uncalculable');
});
test('ay sonu ve artık yıl davranışı açık kural gerektirir', () => {
  const month = { ...rule, value: 1, unit: 'month', monthOverflow: 'last_day', nonBusinessDay: 'keep' };
  assert.equal(calculate({ ...input, triggerDate: '2026-01-31', rule: month }).proposedDueAt, '2026-02-28');
  assert.equal(calculate({ ...input, triggerDate: '2028-01-31', rule: month, calendar: { completeYears: [2028], days: [] } }).proposedDueAt, '2028-02-29');
  assert.equal(calculate({ ...input, rule: { ...month, monthOverflow: undefined } }).status, 'uncalculable');
});
test('adli tatil yalnız seçilmiş aralık ve açık uzatma ile hesaplanır', () => {
  const result = calculate({ ...input, triggerDate: '2026-08-01', rule: { ...rule, judicialRecess: { mode: 'extend_after_recess', from: '2026-07-20', to: '2026-08-31', extensionDays: 7 } } });
  assert.equal(result.proposedDueAt, '2026-09-07'); assert.equal(result.steps[1].kind, 'judicial_recess');
  assert.equal(calculate({ ...input, rule: { ...rule, judicialRecess: { mode: 'unknown' } } }).status, 'uncalculable');
});
test('yarım gün belirsizliği, eksik tebliğ/kural/kaynak ve bozuk tarihte sonuç yoktur', () => {
  const halfDay = { ...calendar, days: [{ day: '2026-11-09', kind: 'half_day', source: 'QA' }] };
  for (const bad of [ { ...input, triggerDate: '2026-02-30' }, { ...input, serviceMethod: '' }, { ...input, rule: { ...rule, sourceReference: '' } }, { ...input, calendar: halfDay }, { ...input, rule: { ...rule, countFrom: 'unknown' } } ]) {
    const result = calculate(bad); assert.equal(result.status, 'uncalculable'); assert.equal(result.proposedDueAt, null);
  }
  assert.equal(calculate({ ...input, calendar: halfDay, rule: { ...rule, halfDay: 'next_business_day' } }).proposedDueAt, '2026-11-10');
});
