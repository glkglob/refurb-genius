// @repo/supabase — Environment variable resolution.
//
// Resolves Supabase URL and anon key from multiple naming conventions:
//   VITE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, etc.
//
// Works in both Vite client bundles (import.meta.env) and Node/Nitro
// server bundles (process.env).
//
// NOTE: Vite inlines `import.meta.env.VITE_*` at build time. Because
// this package is consumed as raw TS source (no build step), Vite's
// transform applies here too — the references resolve correctly.

/** Resolved Supabase env config. */
export interface SupabaseEnv {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  isConfigured: boolean;
}

// Server-side fallback: process.env may hold the values without a
// VITE_ prefix (e.g. in Vercel / Nitro server bundles).
const _proc: Record<string, string | undefined> =
  typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {};

/**
 * Read Supabase credentials from the environment.
 *
 * Supports Vite (`import.meta.env.VITE_*`), Next.js
 * (`NEXT_PUBLIC_*`), and plain `process.env` server variables so the
 * same package works across frameworks without renaming env vars.
 */
export function resolveSupabaseEnv(): SupabaseEnv {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    _proc.SUPABASE_URL ||
    _proc.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    _proc.SUPABASE_ANON_KEY ||
    _proc.SUPABASE_PUBLISHABLE_KEY ||
    _proc.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    supabaseUrl,
    supabaseAnonKey,
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  };
}

/**
 * Returns narrowed URL + key, or throws with a clear message naming
 * the missing variable(s). Use in code paths where Supabase is
 * mandatory (auth, data reads, mutations).
 */
export function assertSupabaseEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseEnv();
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(
      `Missing Supabase env var(s): ${missing.join(", ")}. ` +
        "Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (or the NEXT_PUBLIC_ equivalents).",
    );
  }
  return { supabaseUrl: supabaseUrl!, supabaseAnonKey: supabaseAnonKey! };
}
