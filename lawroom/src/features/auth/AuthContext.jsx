import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, configured, dataMode } from "../../lib/supabase.js";
import { liveRepository } from "../../data/supabaseRepository.js";
const Context = createContext(null);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(configured),
    [identity, setIdentity] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) {
        setSession(next);
        setIdentity(null);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError("Oturum açılamadı. Lütfen yeniden giriş yapın.");
        setSession(data?.session || null);
        setLoading(false);
      })
      .catch(() => {
        if (alive) {
          setError("Oturum servisine ulaşılamadı.");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session) {
      setIdentity(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    supabase.auth
      .getUser()
      .then(async ({ data, error }) => {
        if (error || !data.user) throw error || new Error("Oturum geçersiz");
        return liveRepository.getIdentity(data.user.id);
      })
      .then((value) => {
        if (alive) setIdentity(value);
      })
      .catch(() => {
        if (alive)
          setError(
            "Hesap bilgileri yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);
  async function refresh() {
    setIdentity(await liveRepository.getIdentity(session.user.id));
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setIdentity(null);
    setSession(null);
    location.hash = "/giris";
  }
  return (
    <Context.Provider
      value={{
        session,
        identity,
        loading,
        error,
        configured,
        dataMode,
        refresh,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
