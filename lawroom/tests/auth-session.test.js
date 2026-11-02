import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthSessionStore } from '../src/data/authSessionStore.js';
import { showWelcome, authCallbackError, authRetryUrl, workspaceDestination } from '../src/domain/auth-entry.js';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setTimeout(r, 5));
const session = id => ({ user: { id }, access_token: 'synthetic-' + id });
const identity = id => ({ account: { user_id: id, display_name: id, role: 'lawyer', status: 'active' }, memberships: [] });
function fixture({ initial = Promise.resolve({ data: { session: null } }), getUser, getIdentity } = {}) {
  let callback, subscriptions = 0;
  const client = { auth: {
    onAuthStateChange(fn) { callback = fn; subscriptions++; return { data: { subscription: { unsubscribe() { subscriptions--; } } } }; },
    getSession: () => initial,
    getUser: getUser || (async token => ({ data: { user: { id: token.replace('synthetic-', '') } } })),
    async signOut() { callback('SIGNED_OUT', null); return {}; },
  } };
  const store = createAuthSessionStore(client, { getIdentity: getIdentity || (async id => identity(id)) });
  return { store, event: (next, event = 'SIGNED_IN') => callback(event, next), subscriptions: () => subscriptions };
}
test('late initial session cannot restore an account after a signed-out event', async () => {
  const initial = deferred(), f = fixture({ initial: initial.promise }), stop = f.store.start();
  f.event(null, 'SIGNED_OUT'); initial.resolve({ data: { session: session('old-lawyer') } }); await tick();
  assert.deepEqual(f.store.getSnapshot(), { session: null, identity: null, loading: false, error: '' }); stop();
});
test('sign-out while identity is loading clears the spinner and ignores the late private response', async () => {
  const pending = deferred(), f = fixture({ getIdentity: () => pending.promise }), stop = f.store.start();
  f.event(session('lawyer')); await tick(); assert.equal(f.store.getSnapshot().loading, true);
  assert.equal(await f.store.signOut(), true);
  pending.resolve(identity('lawyer')); await tick();
  assert.equal(f.store.getSnapshot().loading, false); assert.equal(f.store.getSnapshot().identity, null); assert.equal(f.store.getSnapshot().session, null); stop();
});
test('account switch discards the previous account identity in flight', async () => {
  const old = deferred(), f = fixture({ getIdentity: id => id === 'old' ? old.promise : identity(id) }), stop = f.store.start();
  f.event(session('old')); await tick(); f.event(session('new')); await tick();
  old.resolve(identity('old')); await tick();
  assert.equal(f.store.getSnapshot().identity.account.user_id, 'new'); stop();
});
test('manual refresh cannot refill identity after sign-out', async () => {
  let pending; const f = fixture({ getIdentity: id => pending ? pending.promise : identity(id) }), stop = f.store.start();
  f.event(session('lawyer')); await tick(); pending = deferred(); const refresh = f.store.refresh(); await tick();
  f.event(null, 'SIGNED_OUT'); pending.resolve(identity('lawyer')); assert.equal(await refresh, false);
  assert.equal(f.store.getSnapshot().identity, null); assert.equal(f.store.getSnapshot().loading, false); stop();
});
test('server-verified user must match the session before identity is requested', async () => {
  let reads = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'someone-else' } } }), getIdentity: async id => { reads++; return identity(id); } }), stop = f.store.start();
  f.event(session('lawyer')); await tick();
  assert.equal(reads, 0); assert.equal(f.store.getSnapshot().identity, null); assert.ok(f.store.getSnapshot().error); stop();
});
test('identity from a different account is rejected and sensitive state stays empty', async () => {
  const f = fixture({ getIdentity: async () => identity('other') }), stop = f.store.start(); f.event(session('lawyer')); await tick();
  assert.equal(f.store.getSnapshot().identity, null); assert.equal(f.store.getSnapshot().loading, false); assert.ok(f.store.getSnapshot().error); stop();
});
test('StrictMode stop/start keeps one subscription and ignores responses from the first lifecycle', async () => {
  const initial = deferred(), f = fixture({ initial: initial.promise }); let stop = f.store.start(); stop(); stop = f.store.start();
  f.event(session('current')); initial.resolve({ data: { session: session('stale') } }); await tick();
  assert.equal(f.subscriptions(), 1); assert.equal(f.store.getSnapshot().session.user.id, 'current'); stop(); assert.equal(f.subscriptions(), 0);
});
test('root waits for auth and opens the workspace after the PKCE code disappears', () => {
  assert.equal(showWelcome({ route: '', callback: false, session: null, loading: false, error: '' }), true);
  for (const change of [{ loading: true }, { session: session('lawyer') }, { callback: true }, { error: 'callback failed' }, { route: 'oturum' }]) {
    assert.equal(showWelcome({ route: '', callback: false, session: null, loading: false, error: '', ...change }), false);
  }
});
test('expired callbacks show an actionable fixed message and retry removes stale error/code parameters', () => {
  assert.match(authCallbackError({ hash: '#error=access_denied&error_code=otp_expired' }), /süresi dolmuş/);
  assert.equal(authCallbackError({ hash: '#/giris' }), '');
  assert.ok(!authCallbackError({ search: '?error=anything&error_description=PRIVATE_TOKEN' }).includes('PRIVATE_TOKEN'));
  assert.equal(authRetryUrl('https://emreaktepe.github.io/law/?code=private&error=access_denied&error_description=secret#error=access_denied'), 'https://emreaktepe.github.io/law/#/giris');
});
test('disabled tracking UI never sends an active lawyer/client to revoked legacy table APIs', () => {
  for (const role of ['lawyer', 'client']) {
    assert.equal(workspaceDestination(role, false), 'setup');
    assert.equal(workspaceDestination(role, true), 'tracking');
  }
  assert.equal(workspaceDestination('admin', false), 'admin');
  assert.equal(workspaceDestination('admin', true), 'admin');
  assert.equal(workspaceDestination('unknown', true), 'setup');
});
