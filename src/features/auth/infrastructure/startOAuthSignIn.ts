/**
 * OAuth initiation Auth primitive (AO-1E1.2).
 *
 * Exact supabase.auth.signInWithOAuth wrapper for Google and Apple.
 * Returned Auth errors are thrown unchanged. Presentation-free (no React,
 * window, analytics, logger, toast, navigation, or QueryClient).
 */
import { supabase } from "@/platform/supabase/browser";

export type AuthOAuthProvider = "google" | "apple";

export interface StartOAuthSignInInput {
  provider: AuthOAuthProvider;
  redirectTo: string;
  queryParams?: Record<string, string>;
}

/**
 * Start browser OAuth for a supported provider.
 * Caller owns redirect URL construction, analytics, loading, and errors.
 */
export async function startOAuthSignIn(input: StartOAuthSignInInput): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: input.redirectTo,
      queryParams: input.queryParams,
    },
  });
  if (error) {
    throw error;
  }
}
