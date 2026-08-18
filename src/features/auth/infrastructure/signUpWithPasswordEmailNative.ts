/**
 * Native password email signup Auth primitive (NATIVE-AUTH-PASSWORD-1).
 *
 * Exact getNativeSupabase().auth.signUp wrapper with full_name / company_name
 * metadata. No emailRedirectTo. Returned Auth errors are thrown unchanged.
 * Presentation-free (no React, QueryClient, analytics, toast, navigation,
 * cookies, or extra storage).
 */
import { getNativeSupabase } from "@/platform/supabase/native";

export interface SignUpWithPasswordEmailNativeInput {
  email: string;
  password: string;
  fullName?: string;
  companyName?: string;
}

/**
 * Sign up with raw email/password against the native Keychain authority.
 * Caller owns mapping, serialized identity publish, analytics, and navigation.
 */
export async function signUpWithPasswordEmailNative(input: SignUpWithPasswordEmailNativeInput) {
  const supabase = getNativeSupabase();
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

export type SignUpWithPasswordEmailNativeResult = Awaited<
  ReturnType<typeof signUpWithPasswordEmailNative>
>;
