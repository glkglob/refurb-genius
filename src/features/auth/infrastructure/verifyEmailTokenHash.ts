/**
 * Email magic-link token-hash Auth primitive (P0-AUTH-1).
 *
 * Exact supabase.auth.verifyOtp wrapper for cross-browser magic-link
 * completion. Does not require a locally stored PKCE verifier.
 * Returned Auth errors are thrown unchanged. Presentation-free.
 */
import { supabase } from "@/platform/supabase/browser";

export interface VerifyEmailTokenHashInput {
  tokenHash: string;
}

/**
 * Verify an email magic-link token hash and establish a browser session.
 * Caller owns mapping, cache seed, redirect resolution, and navigation.
 */
export async function verifyEmailTokenHash(input: VerifyEmailTokenHashInput) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: input.tokenHash,
    type: "email",
  });
  if (error) {
    throw error;
  }
  return { user: data.user };
}

export type VerifyEmailTokenHashResult = Awaited<ReturnType<typeof verifyEmailTokenHash>>;
