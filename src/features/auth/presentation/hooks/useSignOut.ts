/**
 * Presentation-safe browser sign-out (AO-1S1).
 *
 * Owns stable signOut() delegation to signOutSession and error propagation.
 * Does not own routing, product cache ops, pending state, or UI side effects.
 * Shell components retain post-success destination handling.
 */
import { useCallback } from "react";
import { signOutSession } from "../../infrastructure/signOutSession";

export interface UseSignOutResult {
  signOut: () => Promise<void>;
}

/** End the current browser session via auth feature infrastructure. */
export function useSignOut(): UseSignOutResult {
  const signOut = useCallback(async (): Promise<void> => {
    await signOutSession();
  }, []);

  return { signOut };
}
