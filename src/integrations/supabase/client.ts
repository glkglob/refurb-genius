import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { assertSupabaseConfigured } from "@/core/config/env";

const isDev = import.meta.env.DEV;

function createSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseConfigured();

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: "pip-auth",
      ...(isDev ? {} : { domain: ".refurbgenius.space" }),
      path: "/",
      sameSite: "lax",
      secure: !isDev,
    },
    auth: {
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
