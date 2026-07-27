/**
 * AuthExperience password credential orchestration (AO-1E1.1).
 *
 * Owns password sign-in/signup Auth calls, AUTH_USER_QUERY_KEY seeding,
 * password-flow analytics, and session-present onboarding flag.
 * Caller retains validation, lockout, toast, navigation, and submitting state.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fromSupabaseUser } from "@/lib/auth";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import { identifyAnalyticsUser, trackEvent, trackSignupCompleted } from "@/lib/analytics";
import { markNewUserOnboarding } from "../../onboardingStorage";
import { signInWithPasswordEmail } from "../../infrastructure/signInWithPasswordEmail";
import { signUpWithPasswordEmail } from "../../infrastructure/signUpWithPasswordEmail";

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
      const { user } = await signInWithPasswordEmail({ email, password });
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, fromSupabaseUser(user));
      identifyAnalyticsUser(user?.id);
      trackEvent("user_signed_in", { provider: "email" });
    },
    [queryClient],
  );

  const signUpWithPassword = useCallback(
    async (input: SignUpWithPasswordCredentialsInput): Promise<SignUpWithPasswordOutcome> => {
      const { user, session } = await signUpWithPasswordEmail({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        companyName: input.companyName,
      });

      identifyAnalyticsUser(user?.id);
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
