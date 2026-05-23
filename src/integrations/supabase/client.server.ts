import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { assertSupabaseConfigured } from "@/core/config/env";

const STORAGE_KEY = "pip-auth";
const COOKIE_DOMAIN = import.meta.env.DEV ? undefined : ".refurbgenius.space";

function createSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseConfigured();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: STORAGE_KEY,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      path: "/",
      sameSite: "lax",
      secure: !import.meta.env.DEV,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
