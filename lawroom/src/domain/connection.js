export function isPublicApiKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return true;
  try {
    const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role === 'anon';
  } catch { return false; }
}
export function isSupportedApiUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return false;
    return (url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')) ||
      (url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  } catch { return false; }
}
