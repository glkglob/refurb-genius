// Supabase service boundary (centralized client).
//
// All app code (hooks, components, stores) should import the Supabase client
// from here: `import { supabase } from "@/services/supabase";`
//
// The actual singleton is created in ./_client.ts, which has no app-level
// imports, so it can be safely consumed by @/lib/auth without circularity.
import { env } from "@/core/config/env";

export { supabase } from "./_client";

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
