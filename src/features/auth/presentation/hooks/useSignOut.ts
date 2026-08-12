/**
 * Presentation-safe sign-out (AO-1S1 + IOS-READINESS-2B-4).
 *
 * Web: delegates to signOutSession (browser auth); isolation via onChange bridge.
 * Native: delegates to signOutNativeAuthIdentityFromBoundClient (AuthProvider-bound
 * client + local signOut + controller A→null). This hook must not obtain a
 * query client directly — required by shell-auth-signout-ownership invariant.
 *
 * Does not own routing, product cache ops, pending state, or UI side effects.
 * Shell components retain post-success destination handling.
 */
import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { signOutSession } from "../../infrastructure/signOutSession";
import { signOutNativeAuthIdentityFromBoundClient } from "../nativeAuthIdentityLifecycle";

export interface UseSignOutResult {
  signOut: () => Promise<void>;
}

/** End the current session via platform-appropriate auth infrastructure. */
export function useSignOut(): UseSignOutResult {
  const signOut = useCallback(async (): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await signOutNativeAuthIdentityFromBoundClient();
      return;
    }
    await signOutSession();
  }, []);

  return { signOut };
}
