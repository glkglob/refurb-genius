/**
 * AuthExperience OAuth initiation orchestration (AO-1E1.2 + IOS-READINESS-2B-3).
 *
 * Owns platform split:
 * - web: existing startOAuthSignIn + browser cookie client + origin callback
 * - native: startNativeOAuthSignIn + ASWebAuthenticationSession + code exchange
 *   + AUTH_USER_QUERY_KEY seed
 *
 * Loading, logger, error copy, toast, and navigation remain in AuthExperience.
 * No callback URL, code, session, or token is returned to presentation.
 */
import { useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import { classifyAuthReturnUrl } from "@/platform/auth/native/auth-return";
import { openNativeAuthSession } from "@/platform/auth/native/web-auth-session";
import { completeNativeOAuthSignIn } from "../../application/completeNativeOAuthSignIn";
import { startNativeOAuthSignIn } from "../../infrastructure/startNativeOAuthSignIn";
import { startOAuthSignIn, type AuthOAuthProvider } from "../../infrastructure/startOAuthSignIn";

/** Outcome of OAuth initiation for presentation loading / navigation semantics. */
export type OAuthInitiationOutcome =
  | { kind: "web-redirecting" }
  | { kind: "native-cancelled" }
  | { kind: "native-authenticated"; destination: string };

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

export function useOAuthSignIn(): UseOAuthSignInResult {
  const queryClient = useQueryClient();
  const nativeInFlightRef = useRef(false);

  const initiateNativeOAuth = useCallback(
    async (provider: AuthOAuthProvider, redirect?: string): Promise<OAuthInitiationOutcome> => {
      if (nativeInFlightRef.current) {
        throw new Error("Sign-in is already in progress.");
      }
      nativeInFlightRef.current = true;
      try {
        const { url } = await startNativeOAuthSignIn({ provider });
        const result = await openNativeAuthSession(url);

        if (result.type === "cancel") {
          return { kind: "native-cancelled" };
        }

        const surface = classifyAuthReturnUrl(result.url);
        if (!surface || surface.kind !== "custom-scheme") {
          throw new Error("Invalid authentication return.");
        }

        const completion = await completeNativeOAuthSignIn({
          callbackUrl: surface.url,
          redirectTo: redirect,
        });

        if (completion.kind === "error") {
          throw new Error(completion.message);
        }

        queryClient.setQueryData(AUTH_USER_QUERY_KEY, completion.user);
        return {
          kind: "native-authenticated",
          destination: completion.destination,
        };
      } finally {
        nativeInFlightRef.current = false;
      }
    },
    [queryClient],
  );

  const initiateOAuth = useCallback(
    async (provider: AuthOAuthProvider, redirect?: string): Promise<OAuthInitiationOutcome> => {
      if (Capacitor.isNativePlatform()) {
        return initiateNativeOAuth(provider, redirect);
      }
      return initiateWebOAuth(provider, redirect);
    },
    [initiateNativeOAuth],
  );

  const startGoogleOAuth = useCallback(
    async (redirect?: string): Promise<OAuthInitiationOutcome> => {
      trackEvent("oauth_sign_in_initiated", { provider: "google" });
      return initiateOAuth("google", redirect);
    },
    [initiateOAuth],
  );

  const startAppleOAuth = useCallback(
    async (redirect?: string): Promise<OAuthInitiationOutcome> => {
      trackEvent("oauth_sign_in_initiated", { provider: "apple" });
      return initiateOAuth("apple", redirect);
    },
    [initiateOAuth],
  );

  const startGitHubOAuth = useCallback(
    async (redirect?: string): Promise<OAuthInitiationOutcome> => {
      trackEvent("oauth_sign_in_initiated", {
        provider: "github",
      });
      return initiateOAuth("github", redirect);
    },
    [initiateOAuth],
  );

  return {
    startGoogleOAuth,
    startAppleOAuth,
    startGitHubOAuth,
  };
}
