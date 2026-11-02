export function showWelcome({ route, callback, session, loading, error }) {
  return !route && !callback && !session && !loading && !error;
}

export function authCallbackError({ search = '', hash = '' }) {
  const query = new URLSearchParams(search), fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const error = query.get('error') || fragment.get('error');
  const code = query.get('error_code') || fragment.get('error_code');
  if (!error && !code) return '';
  return code === 'otp_expired'
    ? 'Bu giriş bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış. Yeni bir bağlantı isteyin.'
    : 'Giriş bağlantısı doğrulanamadı. Aynı tarayıcıdan yeni bir giriş bağlantısı isteyin.';
}

export function authRetryUrl(href) {
  const url = new URL(href);
  for (const field of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(field);
  url.hash = '/giris';
  return url.href;
}

export function workspaceDestination(role, trackingReady) {
  if (role === 'admin') return 'admin';
  return ['lawyer', 'client'].includes(role) && trackingReady ? 'tracking' : 'setup';
}
