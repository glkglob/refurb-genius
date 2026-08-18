/**
 * Native password email sign-in Auth primitive (NATIVE-AUTH-PASSWORD-1).
 *
 * Exact getNativeSupabase().auth.signInWithPassword wrapper. Persists through
 * the existing rg-native-auth Keychain client (persistSession: true).
 * Returned Auth errors are thrown unchanged. Presentation-free (no React,
 * QueryClient, analytics, toast, navigation, cookies, or extra storage).
 */
import { getNativeSupabase } from "@/platform/supabase/native";

export interface SignInWithPasswordEmailNativeInput {
  email: string;
  password: string;
}

/**
 * Sign in with raw email/password against the native Keychain authority.
 * Caller owns mapping, serialized identity publish, analytics, and navigation.
 */
export async function signInWithPasswordEmailNative(input: SignInWithPasswordEmailNativeInput) {
  const supabase = getNativeSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) {
    throw error;
  }
  return { user: data.user, session: data.session };
}

export type SignInWithPasswordEmailNativeResult = Awaited<
  ReturnType<typeof signInWithPasswordEmailNative>
>;
