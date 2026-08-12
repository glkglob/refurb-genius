/**
 * Native local sign-out primitive (IOS-READINESS-2B-4).
 *
 * Presentation-free: clears the Keychain-backed rg-native-auth session via the
 * existing native Supabase singleton. No QueryClient, React, or navigation.
 *
 * Uses scope "local" so offline/network failures cannot leave the session in
 * place after a user-requested sign-out (global revoke is deferred).
 */
export async function signOutNativeSession(): Promise<void> {
  const { getNativeSupabase } = await import("@/platform/supabase/native");
  const { error } = await getNativeSupabase().auth.signOut({ scope: "local" });
  if (error) {
    throw new Error("Unable to sign out. Please try again.");
  }
}
