/**
 * Password-reset email Auth primitive (AO-1E1.3).
 *
 * Exact supabase.auth.resetPasswordForEmail wrapper. Returned Auth errors are
 * thrown unchanged. Presentation-free (no React, window, analytics, logger,
 * toast, navigation, or QueryClient).
 */
import { supabase } from "@/platform/supabase/browser";

export interface RequestPasswordResetEmailInput {
  email: string;
  redirectTo: string;
}

/**
 * Request a password-reset email for the given address.
 * Caller owns redirectTo construction, validation, toast, and loading.
 */
export async function requestPasswordResetEmail(
  input: RequestPasswordResetEmailInput,
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  });
  if (error) {
    throw error;
  }
}
