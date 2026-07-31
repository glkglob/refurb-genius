/**
 * Testable composition for category authority save.
 *
 * Extracted from the TanStack serverFn handler so unit tests can inject fakes
 * without pulling server-only modules into browser-safe barrels.
 */
import type { AuthorityCategoryPersistedEstimate } from "./saveAuthorityCategoryEstimate";
import type { SaveAuthorityCategoryEstimateCommand } from "./decodeSaveAuthorityCategoryEstimateCommand";
import {
  AuthorityError,
  isAuthorityError,
  isRetryableAuthorityCode,
  type AuthorityErrorCode,
} from "./authorityErrors";

export type AuthoritySaveSuccessData = {
  estimateId: string;
  replay: boolean;
  midTotal: number;
  lowTotal: number;
  highTotal: number;
  labourTotal: number;
  materialsTotal: number;
  subtotal: number;
  contingency: number;
  vat: number;
  timelineWeeks: number;
  itemCount: number;
};

export type AuthoritySaveResponse =
  | { ok: true; data: AuthoritySaveSuccessData }
  | {
      ok: false;
      error: {
        code: AuthorityErrorCode | "RATE_LIMITED";
        message: string;
        retryable: boolean;
        retryAfterSeconds?: number;
      };
    };

export type ExecuteAuthorityCategorySaveDeps = {
  requireUser: () => Promise<{ id: string }>;
  checkRateLimit: (
    key: string,
    max?: number,
    windowMs?: number,
  ) => { allowed: boolean; retryAfter?: number };
  rateLimitKeyForUser: (userId: string | null | undefined, action: string) => string;
  save: (
    command: SaveAuthorityCategoryEstimateCommand,
    userId: string,
  ) => Promise<AuthorityCategoryPersistedEstimate>;
};

/**
 * Authenticate once → rate-limit → invoke use-case save → map structured errors.
 */
export async function executeAuthorityCategorySave(
  command: SaveAuthorityCategoryEstimateCommand,
  deps: ExecuteAuthorityCategorySaveDeps,
): Promise<AuthoritySaveResponse> {
  const user = await deps.requireUser();
  const rlKey = deps.rateLimitKeyForUser(user.id, "authority-category-save");
  const rl = deps.checkRateLimit(rlKey);
  if (!rl.allowed) {
    return {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Try again in ${rl.retryAfter || 60}s.`,
        retryable: true,
        retryAfterSeconds: rl.retryAfter || 60,
      },
    };
  }

  try {
    const result = await deps.save(command, user.id);
    return {
      ok: true,
      data: {
        estimateId: result.estimateId,
        replay: result.replay,
        midTotal: result.pricing.mid_total,
        lowTotal: result.pricing.low_total,
        highTotal: result.pricing.high_total,
        labourTotal: result.pricing.labour_total,
        materialsTotal: result.pricing.materials_total,
        subtotal: result.pricing.subtotal,
        contingency: result.pricing.contingency,
        vat: result.pricing.vat,
        timelineWeeks: result.pricing.timeline_weeks,
        itemCount: result.items.length,
      },
    };
  } catch (err) {
    if (isAuthorityError(err)) {
      return {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          retryable: isRetryableAuthorityCode(err.code),
        },
      };
    }
    // Unexpected errors propagate — do not silently convert.
    throw err;
  }
}

export { AuthorityError, isAuthorityError, isRetryableAuthorityCode };
