/**
 * Password email signup Auth primitive (AO-1E1.1).
 *
 * Exact supabase.auth.signUp wrapper with full_name / company_name metadata.
 * No emailRedirectTo. Returned Auth errors are thrown. Presentation-free
 * (no React, QueryClient, analytics, toast, navigation, or storage).
 */
import { supabase } from "@/platform/supabase/browser";

export interface SignUpWithPasswordEmailInput {
  email: string;
  password: string;
  fullName?: string;
  companyName?: string;
}

/**
 * Sign up with raw email/password and optional signup metadata.
 * Caller owns validation, trimming, cache seed, analytics, and navigation.
 */
export async function signUpWithPasswordEmail(input: SignUpWithPasswordEmailInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        company_name: input.companyName,
      },
    },
  });
  if (error) {
    throw error;
  }
  return { user: data.user, session: data.session };
}

export type SignUpWithPasswordEmailResult = Awaited<ReturnType<typeof signUpWithPasswordEmail>>;
