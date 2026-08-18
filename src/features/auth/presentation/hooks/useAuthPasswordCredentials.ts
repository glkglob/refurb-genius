/**
 * AuthExperience password credential orchestration (AO-1E1.1 + NATIVE-AUTH-PASSWORD-1).
 *
 * Owns password sign-in/signup Auth calls, AUTH_USER_QUERY_KEY seeding on web,
 * serialized native identity publication, password-flow analytics, and
 * session-present onboarding flag.
 * Caller retains validation, lockout, toast, navigation, and submitting state.
 */
import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { fromSupabaseUser } from "@/lib/auth";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import { trackEvent, trackSignupCompleted } from "@/lib/analytics";
import { markNewUserOnboarding } from "../../onboardingStorage";
import { signInWithPasswordEmail } from "../../infrastructure/signInWithPasswordEmail";
import { signUpWithPasswordEmail } from "../../infrastructure/signUpWithPasswordEmail";
import {
  completeAndPublishNativePasswordSignIn,
  completeAndPublishNativePasswordSignUp,
} from "../nativeAuthIdentityLifecycle";

export type SignUpWithPasswordOutcome = "session" | "awaiting_verification";

export interface SignUpWithPasswordCredentialsInput {
  email: string;
  password: string;
  fullName?: string;
  companyName?: string;
}

export interface UseAuthPasswordCredentialsResult {
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    input: SignUpWithPasswordCredentialsInput,
  ) => Promise<SignUpWithPasswordOutcome>;
}

export function useAuthPasswordCredentials(): UseAuthPasswordCredentialsResult {
  const queryClient = useQueryClient();

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (Capacitor.isNativePlatform()) {
        await completeAndPublishNativePasswordSignIn(queryClient, { email, password });
        trackEvent("user_signed_in", { provider: "email" });
        return;
      }

      const { user } = await signInWithPasswordEmail({ email, password });
      // Identity identify is owned by AnalyticsLifecycle (AuthProvider) once the
      // session is reflected in the auth query / auth.onChange bridge.
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(user));
      trackEvent("user_signed_in", { provider: "email" });
    },
    [queryClient],
  );

  const signUpWithPassword = useCallback(
    async (input: SignUpWithPasswordCredentialsInput): Promise<SignUpWithPasswordOutcome> => {
      if (Capacitor.isNativePlatform()) {
        const result = await completeAndPublishNativePasswordSignUp(queryClient, {
          email: input.email,
          password: input.password,
          fullName: input.fullName,
          companyName: input.companyName,
        });

        trackSignupCompleted("email", result.user?.id);

        if (result.kind === "session") {
          markNewUserOnboarding();
          return "session";
        }

        return "awaiting_verification";
      }

      const { user, session } = await signUpWithPasswordEmail({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        companyName: input.companyName,
      });

      // Product signup event only — do not identify without an authenticated session.
      trackSignupCompleted("email", user?.id);

      if (session) {
        markNewUserOnboarding();
        queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(user));
        return "session";
      }

      return "awaiting_verification";
    },
    [queryClient],
  );

  return {
    signInWithPassword,
    signUpWithPassword,
  };
}
