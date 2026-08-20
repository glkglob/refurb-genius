/**
 * Platform-aware account deletion.
 *
 * Web: cookie-authenticated deleteAccountServerFn.
 * Native: Bearer POST /api/mobile/v1/account/delete (never the cookie serverFn).
 *
 * Local sign-out is the caller's responsibility AFTER this function returns
 * the strict success contract.
 */
import { Capacitor } from "@capacitor/core";
import {
  assertAccountDeletionSuccess,
  type AccountDeletionSuccess,
} from "../domain/accountDeletionContract";

export async function deleteAccountForClient(): Promise<AccountDeletionSuccess> {
  if (Capacitor.isNativePlatform()) {
    const { deleteAccountNative } = await import("@/platform/http/mobile-account-delete");
    return assertAccountDeletionSuccess(await deleteAccountNative());
  }

  const { deleteAccountServerFn } = await import("@/serverFns/auth");
  return assertAccountDeletionSuccess(await deleteAccountServerFn({}));
}
