/**
 * Password email sign-in Auth primitive (AO-1E1.1).
 *
 * Exact supabase.auth.signInWithPassword wrapper. Returned Auth errors are
 * thrown so presentation can apply lockout and error copy. Presentation-free
 * (no React, QueryClient, analytics, toast, navigation, or storage).
 */
import { supabase } from "@/platform/supabase/browser";

export interface SignInWithPasswordEmailInput {
  email: string;
  password: string;
}

/**
 * Sign in with raw email/password credentials.
 * Caller owns validation, cache seed, analytics, toast, and navigation.
 */
export async function signInWithPasswordEmail(input: SignInWithPasswordEmailInput) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) {
    throw error;
  }
  return { user: data.user };
}

export type SignInWithPasswordEmailResult = Awaited<ReturnType<typeof signInWithPasswordEmail>>;
