/**
 * Singleton browser Supabase client — no app-level imports.
 *
 * Import this subpath directly from auth bootstrap code to avoid circular
 * dependencies with barrels that re-export env helpers.
 */
import type { Database } from "@repo/supabase";
import { createBrowserSupabase } from "@repo/supabase/browser";

const isDev = import.meta.env.DEV;

const hostname = typeof window !== "undefined" ? window.location.hostname : "";
const isProdHostname = hostname === "refurbgenius.info" || hostname.endsWith(".refurbgenius.info");

export const supabase = createBrowserSupabase<Database>({
  cookieName: "pip-auth",
  cookieDomain: !isDev && isProdHostname ? ".refurbgenius.info" : undefined,
  secure: !isDev,
});
