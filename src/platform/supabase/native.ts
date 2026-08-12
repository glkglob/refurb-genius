/**
 * Native-only Supabase client for PKCE OAuth (IOS-READINESS-2B-2).
 *
 * Separate from the browser cookie Supabase client. Uses Keychain-backed
 * SupportedStorage with persistSession:true so PKCE code-verifier writes hit
 * SecureStorage. Session creation is deferred to 2B-3.
 */
import { Capacitor } from "@capacitor/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { assertSupabaseEnv } from "@repo/supabase/env";
import { createNativeAuthSecureStorage } from "@/platform/auth/native/pkce-storage";

/** Frozen storage key for the native PKCE auth client (verifier + future session). */
export const NATIVE_SUPABASE_STORAGE_KEY = "rg-native-auth" as const;

let nativeClient: SupabaseClient<Database> | undefined;

/**
 * Lazy singleton native Supabase client.
 * Throws if invoked off a Capacitor native platform.
 * Never shares storage or identity with the browser cookie client.
 */
export function getNativeSupabase(): SupabaseClient<Database> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Native Supabase client is only available on native platforms.");
  }

  if (!nativeClient) {
    const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv();
    nativeClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: false,
        storageKey: NATIVE_SUPABASE_STORAGE_KEY,
        storage: createNativeAuthSecureStorage(),
      },
    });
  }

  return nativeClient;
}
