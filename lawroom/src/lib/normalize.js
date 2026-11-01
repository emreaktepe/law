/** Search-only normalization; never changes a party's displayed name. */
export function normalizeSearchText(value) {
  return String(value ?? '').toLocaleLowerCase('tr-TR').normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/ı/g, 'i').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Parse only an unambiguous year/serial pair. Legal validity is not inferred.
 * @param {unknown} value
 * @returns {{year: string, serial: string, suffix: string, normalized: string} | null}
 */
export function parseMatterNumber(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = text.match(/^(\d{4})\s*(?:[\/\-–—]\s*|\s+)(\d{1,12})\s*(?:(E|K|esas|karar)\.?)?$/iu);
  if (!match) return null;
  const suffix = /^(e|esas)$/iu.test(match[3] ?? '') ? 'esas' : /^(k|karar)$/iu.test(match[3] ?? '') ? 'karar' : '';
  return {year: match[1], serial: match[2], suffix, normalized: `${match[1]}/${BigInt(match[2]).toString()}`};
}

/** @param {unknown} value @returns {string} Empty means ambiguous or unsupported. */
export function normalizeMatterNumber(value) {
  return parseMatterNumber(value)?.normalized ?? '';
}

/** @param {unknown} value @param {unknown} query */
export function matterNumberMatches(value, query) {
  const normalizedQuery = normalizeMatterNumber(query);
  if (normalizedQuery) return normalizeMatterNumber(value) === normalizedQuery;
  const text = normalizeSearchText(query);
  return Boolean(text) && normalizeSearchText(value).includes(text);
}
