/**
 * Platform boundary — Supabase service-role client (server only).
 *
 * Must never be imported from browser modules or public barrels.
 * Dynamic-import from createServerFn handlers or other *.server.ts modules.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

export type ServiceRoleClient = SupabaseClient<Database>;

/**
 * Create a service-role Supabase client for private server operations.
 * Session persistence and token refresh are disabled.
 *
 * @throws Error when SUPABASE_SERVICE_ROLE_KEY or URL is missing
 */
export function createServiceRoleSupabase(): ServiceRoleClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !url) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL for service-role client.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
