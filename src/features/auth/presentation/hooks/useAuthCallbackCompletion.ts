/**
 * Auth callback completion presentation orchestration (AO-1F1).
 *
 * Owns QueryClient AUTH_USER_QUERY_KEY seeding and TanStack Router navigation
 * for the Auth callback route. Application orchestration lives in
 * completeAuthCallback. Route retains search validation, loading UI, and
 * error UI.
 *
 * Rejected completeAuthCallback promises (no-code getSession failures)
 * propagate — parity with the pre-extraction no-code branch that had no .catch.
 */
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";
import {
  completeAuthCallback,
  type CompleteAuthCallbackInput,
} from "../../application/completeAuthCallback";

export type CompleteAuthCallbackPresentationInput = CompleteAuthCallbackInput;

export type AuthCallbackCompletionPresentationResult = { ok: true } | { ok: false; error: string };

export interface UseAuthCallbackCompletionResult {
  complete: (
    input: CompleteAuthCallbackPresentationInput,
  ) => Promise<AuthCallbackCompletionPresentationResult>;
}

export function useAuthCallbackCompletion(): UseAuthCallbackCompletionResult {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const complete = useCallback(
    async (
      input: CompleteAuthCallbackPresentationInput,
    ): Promise<AuthCallbackCompletionPresentationResult> => {
      const result = await completeAuthCallback(input);

      if (result.kind === "error") {
        return { ok: false, error: result.message };
      }

      if (result.kind === "recovery") {
        // Recovery: navigate to reset mode without seeding AUTH_USER_QUERY_KEY
        // (preserved pre-extraction quirk).
        await navigate({
          to: "/auth",
          search: { mode: "reset" },
          replace: true,
        });
        return { ok: true };
      }

      // authenticated: seed before navigate (RequireAuth cache parity)
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, result.user);
      // Dynamic post-auth destination (same as pre-extraction callback).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic redirect_to target, parity with prior route
      await navigate({ to: result.destination as any, replace: true });
      return { ok: true };
    },
    [navigate, queryClient],
  );

  return { complete };
}
