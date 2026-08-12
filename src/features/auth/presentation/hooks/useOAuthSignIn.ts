/**
 * AuthExperience OAuth initiation orchestration (AO-1E1.2 + IOS-READINESS-2B-2).
 *
 * Owns platform split:
 * - web: existing startOAuthSignIn + browser cookie client + origin callback
 * - native: startNativeOAuthSignIn + ASWebAuthenticationSession + custom scheme
 *
 * Loading, logger, error copy, and button state remain in AuthExperience.
 * Native code exchange remains 2B-3. No callback URL logging or analytics secrets.
 */
import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { trackEvent } from "@/lib/analytics";
import { classifyAuthReturnUrl } from "@/platform/auth/native/auth-return";
import { openNativeAuthSession } from "@/platform/auth/native/web-auth-session";
import { startNativeOAuthSignIn } from "../../infrastructure/startNativeOAuthSignIn";
import { startOAuthSignIn, type AuthOAuthProvider } from "../../infrastructure/startOAuthSignIn";

/** Outcome of OAuth initiation for presentation loading semantics. */
export type OAuthInitiationOutcome =
  | { kind: "web-redirecting" }
  | { kind: "native-cancelled" }
  | { kind: "native-callback"; url: string };

export interface UseOAuthSignInResult {
  startGoogleOAuth: (redirect?: string) => Promise<OAuthInitiationOutcome>;
  startAppleOAuth: (redirect?: string) => Promise<OAuthInitiationOutcome>;
  startGitHubOAuth: (redirect?: string) => Promise<OAuthInitiationOutcome>;
}

function buildOAuthInitiationOptions(redirect?: string) {
  const redirectTo = `${window.location.origin}/auth/callback`;
  const queryParams = redirect ? { redirect_to: redirect } : undefined;
  return { redirectTo, queryParams };
}

async function initiateNativeOAuth(provider: AuthOAuthProvider): Promise<OAuthInitiationOutcome> {
  const { url } = await startNativeOAuthSignIn({ provider });
  const result = await openNativeAuthSession(url);

  if (result.type === "cancel") {
    return { kind: "native-cancelled" };
  }

  const surface = classifyAuthReturnUrl(result.url);
  if (!surface || surface.kind !== "custom-scheme") {
    throw new Error("Invalid authentication return.");
  }

  // 2B-2: return validated callback only. No exchange, queue, or persistence.
  return { kind: "native-callback", url: surface.url };
}

async function initiateWebOAuth(
  provider: AuthOAuthProvider,
  redirect?: string,
): Promise<OAuthInitiationOutcome> {
  const { redirectTo, queryParams } = buildOAuthInitiationOptions(redirect);
  await startOAuthSignIn({
    provider,
    redirectTo,
    queryParams,
  });
  return { kind: "web-redirecting" };
}

async function initiateOAuth(
  provider: AuthOAuthProvider,
  redirect?: string,
): Promise<OAuthInitiationOutcome> {
  if (Capacitor.isNativePlatform()) {
    // Native 2B-2 ignores application post-auth `redirect` destination.
    return initiateNativeOAuth(provider);
  }
  return initiateWebOAuth(provider, redirect);
}

export function useOAuthSignIn(): UseOAuthSignInResult {
  const startGoogleOAuth = useCallback(
    async (redirect?: string): Promise<OAuthInitiationOutcome> => {
      trackEvent("oauth_sign_in_initiated", { provider: "google" });
      return initiateOAuth("google", redirect);
    },
    [],
  );

  const startAppleOAuth = useCallback(
    async (redirect?: string): Promise<OAuthInitiationOutcome> => {
      trackEvent("oauth_sign_in_initiated", { provider: "apple" });
      return initiateOAuth("apple", redirect);
    },
    [],
  );

  const startGitHubOAuth = useCallback(
    async (redirect?: string): Promise<OAuthInitiationOutcome> => {
      trackEvent("oauth_sign_in_initiated", {
        provider: "github",
      });
      return initiateOAuth("github", redirect);
    },
    [],
  );

  return {
    startGoogleOAuth,
    startAppleOAuth,
    startGitHubOAuth,
  };
}
