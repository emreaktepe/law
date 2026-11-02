/** Session and identity move together; late responses cannot restore another account. */
export function createAuthSessionStore(client, repository) {
  let state = Object.freeze({ session: null, identity: null, loading: Boolean(client), error: '' });
  let active = false, epoch = 0, subscription;
  const listeners = new Set();
  const publish = patch => { state = Object.freeze({ ...state, ...patch }); for (const listener of listeners) listener(); };
  const current = (ticket, userId) => active && epoch === ticket && state.session?.user?.id === userId;
  async function refresh() {
    const session = state.session, userId = session?.user?.id;
    if (!active || !userId) return false;
    const ticket = ++epoch;
    publish({ identity: null, loading: true, error: '' });
    try {
      const { data, error } = await client.auth.getUser(session.access_token);
      if (!current(ticket, userId)) return false;
      if (error || data?.user?.id !== userId) throw new Error('Oturum doğrulanamadı. Yeniden giriş yapın.');
      const identity = await repository.getIdentity(userId);
      if (!current(ticket, userId)) return false;
      if (identity?.account && identity.account.user_id !== userId) throw new Error('Hesap bilgileri bu oturumla eşleşmiyor.');
      publish({ identity, loading: false, error: '' });
      return true;
    } catch (error) {
      if (!current(ticket, userId)) return false;
      publish({ identity: null, loading: false, error: 'Hesap bilgileri yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.' });
      throw error;
    }
  }
  function acceptSession(next) {
    const ticket = ++epoch;
    publish({ session: next || null, identity: null, loading: Boolean(next), error: '' });
    // Supabase holds its auth lock during callbacks: defer network calls until it returns.
    if (next) setTimeout(() => { if (active && epoch === ticket) void refresh().catch(() => {}); }, 0);
  }
  function stop() { active = false; ++epoch; subscription?.unsubscribe(); subscription = undefined; }
  function start() {
    if (active || !client) return stop;
    active = true;
    const ticket = ++epoch;
    publish({ session: null, identity: null, loading: true, error: '' });
    subscription = client.auth.onAuthStateChange((_event, next) => { if (active) acceptSession(next); }).data.subscription;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active || epoch !== ticket) return;
      if (error) throw error;
      acceptSession(data?.session);
    }).catch(() => {
      if (active && epoch === ticket) publish({ session: null, identity: null, loading: false, error: 'Oturum açılamadı. Lütfen yeniden giriş yapın.' });
    });
    return stop;
  }
  async function signOut() {
    const userId = state.session?.user?.id;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    if (!active || state.session && state.session.user.id !== userId) return false;
    acceptSession(null);
    return true;
  }
  return {
    start, refresh, signOut,
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
