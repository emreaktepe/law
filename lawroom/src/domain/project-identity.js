export const EXPECTED_SUPABASE_REF = 'deezwydtiibbdtimxcxf';
export const EXPECTED_SUPABASE_ORIGIN = `https://${EXPECTED_SUPABASE_REF}.supabase.co`;

export function isExpectedSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === EXPECTED_SUPABASE_ORIGIN && url.pathname === '/' &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Local misconfiguration guard; the Supabase server still verifies key authenticity. */
export function isExpectedSupabaseConfiguration(url, key) {
  if (!isExpectedSupabaseUrl(url) || typeof key !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/u.test(key)) return true;
  if (!key.startsWith('eyJ')) return false;
  try {
    const parts = key.split('.');
    if (parts.length !== 3 || !parts[2]) return false;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    payload = payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '=');
    const decoded = JSON.parse(atob(payload));
    return decoded.role === 'anon' && decoded.ref === EXPECTED_SUPABASE_REF;
  } catch {
    return false;
  }
}
