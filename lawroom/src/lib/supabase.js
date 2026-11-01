import { createClient } from "@supabase/supabase-js";
import { isPublicApiKey } from "../domain/connection.js";
import { isExpectedSupabaseConfiguration } from "../domain/project-identity.js";
export const dataMode =
  import.meta.env.VITE_DATA_MODE === "live" ? "live" : "demo";
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const configured =
  dataMode === "live" &&
  isPublicApiKey(key) &&
  isExpectedSupabaseConfiguration(url, key);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "lawroom-auth",
      },
    })
  : null;
export const authRedirect = () =>
  new URL(import.meta.env.BASE_URL, window.location.href).href;
