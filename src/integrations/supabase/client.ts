import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { assertSupabaseConfigured } from "@/core/config/env";

function createSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseConfigured();

  console.log("[Supabase] init:", { configured: true });

  // Wrap localStorage in a try/catch adapter so browser privacy settings
  // (e.g. Safari ITP, blocked third-party storage) never crash the app.
  const safeLocalStorage = {
    getItem(key: string): string | null {
      try {
        return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      } catch {
        // Blocked by browser privacy settings — session will not persist.
      }
    },
    removeItem(key: string): void {
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
      } catch {
        // Blocked by browser privacy settings.
      }
    },
  };

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: safeLocalStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
