/**
 * Native client helper for Bearer account deletion (NATIVE-ACCOUNT-DELETE-1).
 *
 * POST https://<production>/api/mobile/v1/account/delete
 * Empty JSON body. Identity is the Bearer token only.
 */
import { nativeAuthenticatedJson } from "./native-authenticated-fetch";
import { MOBILE_API_PREFIX } from "./mobile-session-ping";

export const MOBILE_ACCOUNT_DELETE_PATH = `${MOBILE_API_PREFIX}/account/delete` as const;

/** Parsed JSON only. Callers must apply the local account-deletion success contract. */
export async function deleteAccountNative(): Promise<unknown> {
  return nativeAuthenticatedJson<unknown>(MOBILE_ACCOUNT_DELETE_PATH, {
    method: "POST",
    json: {},
  });
}
