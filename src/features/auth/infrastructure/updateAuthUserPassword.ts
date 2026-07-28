/**
 * Authenticated user password update Auth primitive (AO-1E1.3).
 *
 * Exact supabase.auth.updateUser({ password }) wrapper for recovery reset-mode.
 * Returned Auth errors are thrown unchanged. Presentation-free (no React,
 * window, analytics, logger, toast, navigation, or QueryClient).
 */
import { supabase } from "@/platform/supabase/browser";

export interface UpdateAuthUserPasswordInput {
  password: string;
}

/**
 * Update the current session user's password.
 * Caller owns validation, toast, navigation, and loading.
 */
export async function updateAuthUserPassword(input: UpdateAuthUserPasswordInput): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: input.password,
  });
  if (error) {
    throw error;
  }
}
