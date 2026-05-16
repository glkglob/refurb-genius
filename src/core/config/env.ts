// Canonical Supabase environment configuration.
//
// Single source of truth for env var names. Both the Lovable alias
// (VITE_SUPABASE_PUBLISHABLE_KEY) and the standard Supabase name
// (VITE_SUPABASE_ANON_KEY) are accepted so production Vercel deployments
// work without renaming variables.
//
// SSR note: import.meta.env.VITE_* values are embedded at Vite build time
// in both client and server bundles. process.env fallbacks cover the Nitro
// server path where the VITE_ prefix may be absent.

const _proc = typeof process !== "undefined" ? process.env : {};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || _proc.SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  _proc.SUPABASE_ANON_KEY ||
  _proc.SUPABASE_PUBLISHABLE_KEY;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};

/** Throws a clear error if either required variable is absent. Returns
 *  narrowed non-nullable types so callers need no extra null checks. */
export function assertSupabaseConfigured(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in Vercel.",
    );
  }
  return {
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
  };
}
