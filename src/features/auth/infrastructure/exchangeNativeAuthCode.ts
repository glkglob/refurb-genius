/**
 * Native authorization-code exchange (IOS-READINESS-2B-3).
 *
 * Exact getNativeSupabase().auth.exchangeCodeForSession wrapper.
 * Uses the 2B-2 native PKCE client (rg-native-auth + Keychain storage).
 * Presentation-free (no React UI side effects).
 */
import { getNativeSupabase } from "@/platform/supabase/native";

export interface ExchangeNativeAuthCodeInput {
  code: string;
}

/**
 * Exchange a native PKCE authorization code for a session.
 * Caller owns mapping, cache seed, destination resolution, and routing.
 */
export async function exchangeNativeAuthCode(input: ExchangeNativeAuthCodeInput) {
  const supabase = getNativeSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(input.code);
  if (error) {
    throw error;
  }
  return { user: data.user, session: data.session };
}

export type ExchangeNativeAuthCodeResult = Awaited<ReturnType<typeof exchangeNativeAuthCode>>;
