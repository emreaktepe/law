/** Demo-only IDs, never cached matter titles or contents. */
export function createRecentMatterRepository({ storage, ownerId, now = () => new Date().toISOString() }) {
  if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 180) throw new Error('Son dosyalar için hesap kimliği gerekir.');
  const key = 'lawroom-recent-matters-v1:' + encodeURIComponent(ownerId);
  function list() {
    try { const parsed = JSON.parse(storage.getItem(key)); if (parsed?.ownerId !== ownerId || parsed.version !== 1 || !Array.isArray(parsed.items)) return [];
      return [...new Map(parsed.items.filter(item => item && typeof item.id === 'string' && item.id.length <= 180 && typeof item.visitedAt === 'string').map(item => [item.id, { id: item.id, visitedAt: item.visitedAt }])).values()].slice(0, 5);
    } catch { return []; }
  }
  function visit(id) {
    if (typeof id !== 'string' || !id || id.length > 180) throw new Error('Geçerli dosya kimliği gerekir.');
    const items = [{ id, visitedAt: now() }, ...list().filter(item => item.id !== id)].slice(0, 5);
    storage.setItem(key, JSON.stringify({ version: 1, ownerId, items })); return items;
  }
  return { list, visit };
}
export function browserRecentMatterRepository(ownerId) {
  return createRecentMatterRepository({ ownerId, storage: { getItem: key => globalThis.localStorage.getItem(key), setItem: (key, value) => globalThis.localStorage.setItem(key, value) } });
}
