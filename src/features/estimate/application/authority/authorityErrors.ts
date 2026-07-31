/**
 * Structured application errors for the estimate authority command path.
 */

export type AuthorityErrorCode =
  | "INVALID_AUTHORITY_COMMAND"
  | "INVALID_AUTHORITY_FIELD_TYPE"
  | "INVALID_AUTHORITY_FIELD_VALUE"
  | "FORBIDDEN_AUTHORITY_FIELD"
  | "AUTHORITY_REQUEST_TOO_LARGE"
  | "FIELD_TOO_LONG"
  | "IDEMPOTENCY_CONFLICT"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_OWNERSHIP_CHANGED"
  | "AUTHORITY_PERSISTENCE_FAILED";

export class AuthorityError extends Error {
  readonly code: AuthorityErrorCode;
  readonly field?: string;

  constructor(code: AuthorityErrorCode, message: string, field?: string) {
    super(message);
    this.name = "AuthorityError";
    this.code = code;
    this.field = field;
  }
}

export function isAuthorityError(error: unknown): error is AuthorityError {
  return error instanceof AuthorityError;
}
