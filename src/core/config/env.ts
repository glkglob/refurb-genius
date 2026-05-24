// Canonical Supabase environment configuration.
//
// Delegates to @repo/supabase for the actual env resolution. This module
// re-exports the shared helpers and adds the app-specific `env` shape
// for backward compatibility with existing consumers.

import { resolveSupabaseEnv, assertSupabaseEnv } from "@repo/supabase/env";

const resolved = resolveSupabaseEnv();

export const env = {
  supabaseUrl: resolved.supabaseUrl,
  supabaseAnonKey: resolved.supabaseAnonKey,
  isSupabaseConfigured: resolved.isConfigured,
};

/** Throws a clear error if either required variable is absent. Returns
 *  narrowed non-nullable types so callers need no extra null checks. */
export function assertSupabaseConfigured(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  return assertSupabaseEnv();
}
