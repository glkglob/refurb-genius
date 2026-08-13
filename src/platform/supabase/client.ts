/**
 * Platform Supabase client selector (IOS-READINESS-2C-1 foundation).
 *
 * - Native (Capacitor): Keychain-backed getNativeSupabase() — never pip-auth cookies
 * - Web: browser cookie singleton (pip-auth)
 *
 * Broad consumer migration (hooks/queries) is 2C-3. This module is the switch point.
 */
import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { supabase as browserSupabase } from "./_client";
import { getNativeSupabase } from "./native";

/**
 * True when the runtime should use native Keychain Supabase authority
 * (not browser pip-auth cookies).
 */
export function isNativeSupabaseAuthority(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Authority-correct Supabase client for the current runtime.
 *
 * Native: Keychain session (RLS data plane).
 * Web: cookie browser client.
 *
 * Prefer this over hard-wiring `@/platform/supabase/browser` in new native-aware paths.
 * Existing web hooks remain on browser client until 2C-3 wire-up.
 */
export function getPlatformSupabase(): SupabaseClient<Database> {
  if (Capacitor.isNativePlatform()) {
    return getNativeSupabase();
  }
  return browserSupabase;
}

/**
 * Async selector (same authority rules). Preferred when callers already async.
 */
export async function getPlatformSupabaseAsync(): Promise<SupabaseClient<Database>> {
  return getPlatformSupabase();
}
