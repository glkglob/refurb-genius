/**
 * AuthExperience email-access orchestration (AO-1E1.3).
 *
 * Owns magic-link callback URL construction, recovery redirect construction,
 * and primitive invocation for OTP, password-reset request, and password
 * update. Loading, logger, toast, validation copy, and navigation remain in
 * AuthExperience. Callback exchange remains auth_.callback.tsx.
 */
import { useCallback } from "react";
import { sendMagicLinkEmail } from "../../infrastructure/sendMagicLinkEmail";
import { requestPasswordResetEmail } from "../../infrastructure/requestPasswordResetEmail";
import { updateAuthUserPassword } from "../../infrastructure/updateAuthUserPassword";

export interface UseAuthEmailAccessResult {
  sendMagicLink: (email: string, redirect?: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

function buildMagicLinkEmailRedirectTo(redirect?: string): string {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  if (redirect) {
    callbackUrl.searchParams.set("redirect_to", redirect);
  }
  return callbackUrl.toString();
}

function buildPasswordResetRedirectTo(): string {
  return `${window.location.origin}/auth/callback?type=recovery`;
}

export function useAuthEmailAccess(): UseAuthEmailAccessResult {
  const sendMagicLink = useCallback(async (email: string, redirect?: string): Promise<void> => {
    await sendMagicLinkEmail({
      email,
      emailRedirectTo: buildMagicLinkEmailRedirectTo(redirect),
    });
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    await requestPasswordResetEmail({
      email,
      redirectTo: buildPasswordResetRedirectTo(),
    });
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<void> => {
    await updateAuthUserPassword({ password });
  }, []);

  return {
    sendMagicLink,
    requestPasswordReset,
    updatePassword,
  };
}
