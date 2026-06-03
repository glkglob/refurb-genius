// Supabase service boundary (centralized client).
//
// All app code (hooks, components, stores) should import the Supabase client
// from here: `import { supabase } from "@/services/supabase";`
//
// This is now implemented via the supported `@repo/supabase/browser` factory
// (no more direct import from the deprecated `@/integrations/supabase/client`).
// Types are still pulled from the generated file for Database generic.
import type { Database } from "@/integrations/supabase/types";
import { createBrowserSupabase } from "@repo/supabase/browser";
import { env } from "@/core/config/env";

const isDev = import.meta.env.DEV;

export const supabase = createBrowserSupabase<Database>({
  cookieName: "pip-auth",
  cookieDomain: isDev ? undefined : ".refurbgenius.space",
  secure: !isDev,
});

// Re-export the auth wrapper so the auth surface lives behind the service
// layer too. New code should prefer `@/services/supabase` over `@/lib/auth`.
export { auth } from "@/lib/auth";
export type { AuthUser } from "@/lib/auth";

/** True when Supabase URL + key are present at build time. */
export function isSupabaseConfigured(): boolean {
  return env.isSupabaseConfigured;
}

/**
 * Human-readable setup warning for the UI. Returns null when configured;
 * returns a short message + action when not. Pages can render this without
 * crashing the app.
 */
export function getSupabaseSetupWarning(): { title: string; description: string } | null {
  if (env.isSupabaseConfigured) return null;
  return {
    title: "Backend not connected",
    description:
      "Supabase is not configured. Please set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables to enable the backend.",
  };
}
