/**
 * AuthExperience OAuth initiation orchestration (AO-1E1.2).
 *
 * Owns callback URL construction, redirect_to forwarding, and initiation
 * analytics. Loading, logger, error copy, and button state remain in
 * AuthExperience. Callback exchange remains auth_.callback.tsx.
 */
import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { startOAuthSignIn } from "../../infrastructure/startOAuthSignIn";

export interface UseOAuthSignInResult {
  startGoogleOAuth: (redirect?: string) => Promise<void>;
  startAppleOAuth: (redirect?: string) => Promise<void>;
}

function buildOAuthInitiationOptions(redirect?: string) {
  const redirectTo = `${window.location.origin}/auth/callback`;
  const queryParams = redirect ? { redirect_to: redirect } : undefined;
  return { redirectTo, queryParams };
}

export function useOAuthSignIn(): UseOAuthSignInResult {
  const startGoogleOAuth = useCallback(async (redirect?: string): Promise<void> => {
    const { redirectTo, queryParams } = buildOAuthInitiationOptions(redirect);
    trackEvent("oauth_sign_in_initiated", { provider: "google" });
    await startOAuthSignIn({
      provider: "google",
      redirectTo,
      queryParams,
    });
  }, []);

  const startAppleOAuth = useCallback(async (redirect?: string): Promise<void> => {
    const { redirectTo, queryParams } = buildOAuthInitiationOptions(redirect);
    trackEvent("oauth_sign_in_initiated", { provider: "apple" });
    await startOAuthSignIn({
      provider: "apple",
      redirectTo,
      queryParams,
    });
  }, []);

  return {
    startGoogleOAuth,
    startAppleOAuth,
  };
}
