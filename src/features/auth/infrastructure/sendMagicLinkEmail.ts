/**
 * Magic-link OTP Auth primitive (AO-1E1.3).
 *
 * Exact supabase.auth.signInWithOtp wrapper. Returned Auth errors are thrown
 * unchanged. Presentation-free (no React, window, analytics, logger, toast,
 * navigation, or QueryClient).
 */
import { supabase } from "@/platform/supabase/browser";

export interface SendMagicLinkEmailInput {
  email: string;
  emailRedirectTo: string;
}

/**
 * Send a passwordless magic-link email.
 * Caller owns emailRedirectTo construction, validation, toast, and loading.
 */
export async function sendMagicLinkEmail(input: SendMagicLinkEmailInput): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      emailRedirectTo: input.emailRedirectTo,
    },
  });
  if (error) {
    throw error;
  }
}
