/**
 * Keychain-backed Supabase SupportedStorage adapter (IOS-READINESS-2B-2).
 *
 * Maps Supabase auth storage to @aparajita/capacitor-secure-storage string API.
 * Used by the native PKCE client for code-verifier persistence only in 2B-2
 * (no session exchange). Do not log storage keys or values.
 */
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Create a Supabase SupportedStorage adapter backed by SecureStorage (Keychain).
 * Uses raw getItem/setItem/removeItem only — never JSON get/set helpers.
 */
export function createNativeAuthSecureStorage(): SupportedStorage {
  return {
    getItem: (key: string) => SecureStorage.getItem(key),
    setItem: (key: string, value: string) => SecureStorage.setItem(key, value),
    removeItem: (key: string) => SecureStorage.removeItem(key),
  };
}
