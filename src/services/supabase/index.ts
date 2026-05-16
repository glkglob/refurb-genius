// Supabase service boundary.
//
// Components and pages should import the Supabase client from here, not
// directly from `@/integrations/supabase/*`. That keeps a single seam for
// future swaps (mocked tests, alternate backends) and gives us one place
// to surface a setup warning when env vars are missing.
import { supabase } from "@/integrations/supabase/client";
export { supabase };

// Re-export the auth wrapper so the auth surface lives behind the service
// layer too. New code should prefer `@/services/supabase` over `@/lib/auth`.
export { auth } from "@/lib/auth";
export type { AuthUser } from "@/lib/auth";

/** True when Supabase URL + key are present at build time. Accepts both the
 *  standard Supabase name (ANON_KEY) and the Lovable alias (PUBLISHABLE_KEY). */
export function isSupabaseConfigured(): boolean {
  try {
    const url =
      import.meta.env.VITE_SUPABASE_URL ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
    const key =
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_ANON_KEY : undefined) ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);
    return Boolean(url && key);
  } catch {
    return false;
  }
}

/**
 * Human-readable setup warning for the UI. Returns null when configured;
 * returns a short message + action when not. Pages can render this without
 * crashing the app.
 */
export function getSupabaseSetupWarning(): { title: string; description: string } | null {
  if (isSupabaseConfigured()) return null;
  return {
    title: "Backend not connected",
    description:
      "Lovable Cloud isn't connected yet, so sign-in and saving data are disabled. Connect Lovable Cloud in the project settings to enable the backend.",
  };
}
