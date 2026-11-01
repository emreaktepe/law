import { getMatterTemplate } from './stages.js';
import { validateMatterDraft } from './matter-create.js';
import { normalizeMatterNumber, normalizeSearchText } from '../lib/normalize.js';
export const importFields = Object.freeze({ title: 'Başlık', type: 'Dosya türü', subtype: 'Alt tür', number: 'Birincil numara', court: 'Mahkeme / makam', partyName: 'Müvekkil tarafının adı', stageKey: 'Başlangıç aşaması', nextAction: 'İlk iş', targetDate: 'Çalışma hedefi', notes: 'İç not' });
const aliases = { title: ['baslik', 'dosya', 'dosya basligi'], type: ['tur', 'dosya turu'], subtype: ['alt tur'], number: ['numara', 'birincil no', 'esas no'], court: ['makam', 'mahkeme', 'mahkeme daire'], partyName: ['muvekkil adi', 'taraf adi', 'muvekkil'], stageKey: ['asama', 'baslangic asamasi'], nextAction: ['ilk is', 'siradaki is'], targetDate: ['calisma hedefi', 'hedef tarih'], notes: ['ic not', 'not'] };
export function guessImportMapping(headers) {
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex(header => names.includes(normalizeSearchText(String(header))))]));
}
export function parseMatterCsv(text) {
  if (typeof text !== 'string' || text.length > 3_000_000) throw new Error('CSV en fazla 3 milyon karakter olabilir.');
  const source = text.replace(/^\uFEFF/u, ''), firstLine = source.split(/\r?\n/u)[0];
  let quotes = false, comma = 0, semicolon = 0;
  for (const character of firstLine) { if (character === '"') quotes = !quotes; else if (!quotes && character === ',') comma++; else if (!quotes && character === ';') semicolon++; }
  const delimiter = semicolon > comma ? ';' : ',', rows = []; let row = [], cell = '', quoted = false, closed = false;
  const addCell = () => { if (cell.length > 8000) throw new Error('Bir hücre 8000 karakteri aşıyor.'); row.push(cell); if (row.length > 30) throw new Error('En fazla 30 kolon desteklenir.'); cell = ''; closed = false; };
  const addRow = () => { addCell(); if (row.some(value => value.trim())) rows.push(row); if (rows.length > 501) throw new Error('Tek aktarımda en fazla 500 dosya desteklenir.'); row = []; };
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (quoted) { if (character === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += character; }
    else if (character === delimiter) addCell();
    else if (character === '\n' || character === '\r') { if (character === '\r' && source[i + 1] === '\n') i++; addRow(); }
    else if (character === '"') { if (cell || closed) throw new Error('CSV tırnak yapısı geçersiz.'); quoted = true; }
    else { if (closed && !/\s/u.test(character)) throw new Error('CSV tırnak sonrası ayırıcı bekleniyor.'); if (!closed) cell += character; }
  }
  if (quoted) throw new Error('CSV içinde kapanmamış tırnak var.'); if (cell || row.length || closed) addRow();
  return normalizeImportTable(rows);
}
export function normalizeImportTable(rows) {
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 501) throw new Error('Başlık satırı ve 1–500 veri satırı gerekir.');
  const table = rows.map(row => { if (!Array.isArray(row) || row.length > 30) throw new Error('En fazla 30 kolon desteklenir.'); return row.map(value => { const cell = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? ''); if (cell.length > 8000) throw new Error('Bir hücre 8000 karakteri aşıyor.'); return cell; }); });
  if (!table[0].length) throw new Error('Kolon başlıkları gerekir.'); return table;
}
const numberKey = (number, court) => { const normalized = normalizeMatterNumber(number); return normalized ? normalized + '|' + normalizeSearchText(court || '') : null; };
export function previewMatterImport(table, mapping, existing = []) {
  table = normalizeImportTable(table);
  const indices = Object.values(mapping).filter(index => index !== -1 && index !== '' && index !== undefined).map(Number);
  if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= table[0].length) || new Set(indices).size !== indices.length) throw new Error('Bir kolon yalnız bir alana eşlenebilir.');
  if (!(Number(mapping.title) >= 0) || !(Number(mapping.type) >= 0) || mapping.title === '' || mapping.type === '') throw new Error('Başlık ve dosya türü kolonlarını eşleyin.');
  const taken = new Set(existing.flatMap(matter => [matter.number, matter.reference, ...(matter.numbers || []).map(number => number.value)].map(number => numberKey(number, matter.court)).filter(Boolean)));
  const valid = [], errors = [];
  for (let index = 1; index < table.length; index++) {
    const row = table[index]; if (!row.some(cell => String(cell).trim())) continue;
    const value = field => Number(mapping[field]) >= 0 && mapping[field] !== '' ? String(row[Number(mapping[field])] ?? '').trim() : '';
    const template = getMatterTemplate(value('type'));
    const subtype = template?.subtypes.find(item => normalizeSearchText(item) === normalizeSearchText(value('subtype'))) || value('subtype') || template?.subtypes[0] || '';
    const stage = template?.stages.find(item => [item.key, item.label].some(label => normalizeSearchText(label) === normalizeSearchText(value('stageKey'))));
    const draft = { type: template?.key || value('type'), subtype, title: value('title'), number: value('number'), numberKind: 'esas', court: value('court'), clientMode: value('partyName') ? 'party' : 'none', partyName: value('partyName'), stageKey: stage?.key || value('stageKey') || template?.stages[0]?.key || '', nextAction: value('nextAction'), targetDate: value('targetDate') };
    const fields = validateMatterDraft(draft), key = numberKey(draft.number, draft.court);
    if (key && taken.has(key)) fields.number = 'Aynı makam ve normalize numara mevcut dosyada veya aktarımda var.';
    if (Object.keys(fields).length) for (const [field, message] of Object.entries(fields)) errors.push({ row: index + 1, field, message });
    else { if (key) taken.add(key); valid.push({ row: index + 1, draft, notes: value('notes') }); }
  }
  return { valid, errors, total: table.length - 1 };
}
export function importErrorCsv(errors) {
  const quote = value => '"' + String(value ?? '').replace(/^[=+@-]/u, "'$&").replaceAll('"', '""') + '"';
  return '\uFEFF' + [['Satır', 'Alan', 'Hata'], ...errors.map(error => [error.row, importFields[error.field] || error.field, error.message])].map(row => row.map(quote).join(';')).join('\r\n');
}
export const matterImportTemplate = '\uFEFFBaşlık;Dosya türü;Alt tür;Birincil no;Makam;Müvekkil adı;Aşama;İlk iş;Çalışma hedefi;İç not\r\nÖrnek takip;İcra;İlamsız takip;2026/184 E.;Örnek İcra Dairesi;;Hazırlık;Evrakı incele;2026-11-03;Yalnız örnek veri\r\n';
