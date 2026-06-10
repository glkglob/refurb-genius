/**
 * Platform boundary — Supabase (browser context).
 */
import { env } from "@/core/config/env";

export { createBrowserSupabase } from "@repo/supabase/browser";
export { resolveSupabaseEnv } from "@repo/supabase/env";
export { supabase } from "./_client";

/** True when Supabase URL + key are present at build time. */
export function isSupabaseConfigured(): boolean {
  return env.isSupabaseConfigured;
}

/**
 * Human-readable setup warning for the UI. Returns null when configured.
 */
export function getSupabaseSetupWarning(): { title: string; description: string } | null {
  if (env.isSupabaseConfigured) return null;
  return {
    title: "Backend not connected",
    description:
      "Supabase is not configured. Please set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables to enable the backend.",
  };
}
