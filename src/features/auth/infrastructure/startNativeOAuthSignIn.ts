/**
 * Native OAuth initiation Auth primitive (IOS-READINESS-2B-2).
 *
 * Builds a PKCE authorize URL via the native Supabase client with
 * skipBrowserRedirect. Does not open ASWebAuthenticationSession, does not
 * exchange codes, and does not accept caller-controlled redirectTo.
 */
import { AUTH_RETURN_CUSTOM_CALLBACK } from "@/platform/auth/native/auth-return";
import { getNativeSupabase } from "@/platform/supabase/native";
import type { AuthOAuthProvider } from "./startOAuthSignIn";

export interface StartNativeOAuthSignInInput {
  provider: AuthOAuthProvider;
}

/**
 * Start native OAuth for a supported provider.
 * Freezes redirectTo to AUTH_RETURN_CUSTOM_CALLBACK.
 * Returns the provider authorize HTTPS URL only.
 */
export async function startNativeOAuthSignIn(
  input: StartNativeOAuthSignInInput,
): Promise<{ url: string }> {
  const supabase = getNativeSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: AUTH_RETURN_CUSTOM_CALLBACK,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("OAuth authorization URL was not returned.");
  }

  return { url: data.url };
}
