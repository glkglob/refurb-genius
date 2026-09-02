import { z } from "zod";

/**
 * Strict account-deletion success contract.
 * Only `{ success: true }` counts as deletion completion.
 */
export const accountDeletionSuccessSchema = z
  .object({
    success: z.literal(true),
  })
  .strict();

export type AccountDeletionSuccess = z.infer<typeof accountDeletionSuccessSchema>;

export const ACCOUNT_DELETION_SUCCESS = { success: true as const } satisfies AccountDeletionSuccess;

export class AccountDeletionError extends Error {
  readonly code: "storage_cleanup_failed" | "auth_delete_failed" | "not_configured";

  constructor(
    code: "storage_cleanup_failed" | "auth_delete_failed" | "not_configured",
    message: string,
  ) {
    super(message);
    this.name = "AccountDeletionError";
    this.code = code;
  }
}

export class AccountDeletionContractError extends Error {
  readonly code = "invalid_deletion_success" as const;

  constructor(message = "Account deletion did not complete.") {
    super(message);
    this.name = "AccountDeletionContractError";
  }
}

export function assertAccountDeletionSuccess(value: unknown): AccountDeletionSuccess {
  if (typeof Response !== "undefined" && value instanceof Response) {
    throw new AccountDeletionContractError();
  }
  const parsed = accountDeletionSuccessSchema.safeParse(value);
  if (!parsed.success) {
    throw new AccountDeletionContractError();
  }
  return parsed.data;
}
