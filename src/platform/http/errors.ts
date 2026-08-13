/**
 * Safe error types for native authenticated HTTP transport (IOS-READINESS-2C-1).
 *
 * Messages must never include access tokens, refresh tokens, or Authorization values.
 */

export type NativeHttpErrorCode =
  | "signed_out"
  | "indeterminate"
  | "refresh_failed"
  | "origin_missing"
  | "origin_invalid"
  | "origin_not_https"
  | "network"
  | "unauthorized"
  | "http_error"
  | "invalid_response";

export class NativeHttpError extends Error {
  readonly code: NativeHttpErrorCode;
  readonly status?: number;

  constructor(
    message: string,
    opts: { code: NativeHttpErrorCode; status?: number; cause?: unknown },
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "NativeHttpError";
    this.code = opts.code;
    this.status = opts.status;
  }
}
