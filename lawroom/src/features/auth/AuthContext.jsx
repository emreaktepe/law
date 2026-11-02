import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase, configured, dataMode } from '../../lib/supabase.js';
import { liveRepository } from '../../data/supabaseRepository.js';
import { createAuthSessionStore } from '../../data/authSessionStore.js';
const Context = createContext(null);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children, client = supabase, repository = liveRepository }) {
  const store = useMemo(() => createAuthSessionStore(client, repository), [client, repository]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => store.start(), [store]);
  async function signOut() {
    if (await store.signOut()) location.hash = '/giris';
  }
  return <Context.Provider value={{ ...state, configured, dataMode, refresh: store.refresh, signOut }}>{children}</Context.Provider>;
}
