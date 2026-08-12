/**
 * Native session observation primitive (IOS-READINESS-2B-4).
 *
 * Presentation-free: Keychain-backed getSession only. No QueryClient, React,
 * navigation, or secret logging.
 *
 * Classification is intentionally conservative: any getSession error is
 * indeterminate (session:null + error is NOT automatically signed-out).
 */
import type { AuthUser } from "@/lib/auth";
import { mapNativeSupabaseUser } from "../application/mapNativeSupabaseUser";

export type NativeAuthSessionOutcome =
  | { kind: "authenticated"; user: AuthUser }
  | { kind: "signed-out" }
  | { kind: "indeterminate" };

/**
 * Read the current native Supabase session and classify without side effects.
 */
export async function readNativeAuthSession(): Promise<NativeAuthSessionOutcome> {
  try {
    const { getNativeSupabase } = await import("@/platform/supabase/native");
    const {
      data: { session },
      error,
    } = await getNativeSupabase().auth.getSession();

    // Any SDK error → indeterminate (retryable refresh may leave storage intact).
    if (error) {
      return { kind: "indeterminate" };
    }

    if (!session) {
      return { kind: "signed-out" };
    }

    const user = mapNativeSupabaseUser(session.user);
    if (!user) {
      // Session present but unmappable — fail closed; not ordinary signed-out.
      return { kind: "indeterminate" };
    }

    return { kind: "authenticated", user };
  } catch {
    return { kind: "indeterminate" };
  }
}
