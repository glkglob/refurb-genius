/**
 * 4C2E-B2E — Server-owned catalogue retire use case.
 */
import {
  CatalogueLifecycleRpcError,
  retireMeasuredBoqCatalogueRevisionRpc,
  type LifecycleRpcResult,
} from "../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_RETIREMENT_REASON_LENGTH = 2000;

export type RetireMeasuredBoqCatalogueRevisionInput = {
  revisionId: string;
  expectedStatus: string;
  reason: string;
  requestId: string;
};

export type RetireMeasuredBoqCatalogueRevisionErrorCode =
  | "INVALID_REQUEST"
  | "STALE_STATUS"
  | "REQUEST_CONFLICT"
  | "REVISION_NOT_FOUND"
  | "PROVENANCE_REQUIRED"
  | "LIFECYCLE_FAILED"
  | "LIFECYCLE_UNAVAILABLE";

export type RetireMeasuredBoqCatalogueRevisionResult =
  | {
      ok: true;
      outcome: "retired" | "idempotent_replay" | "already_retired";
      revisionId: string;
      previousStatus: string | null;
      newStatus: string | null;
      eventId: string | null;
      requestId: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      code: RetireMeasuredBoqCatalogueRevisionErrorCode;
      message: string;
      requestId?: string;
      outcome?: string;
    };

function mapRpc(rpc: LifecycleRpcResult): RetireMeasuredBoqCatalogueRevisionResult {
  if (
    (rpc.outcome === "retired" ||
      rpc.outcome === "idempotent_replay" ||
      rpc.outcome === "already_retired") &&
    rpc.revisionId &&
    rpc.requestId
  ) {
    return {
      ok: true,
      outcome: rpc.outcome,
      revisionId: rpc.revisionId,
      previousStatus: rpc.previousStatus,
      newStatus: rpc.newStatus,
      eventId: rpc.eventId,
      requestId: rpc.requestId,
      idempotentReplay: rpc.idempotentReplay || rpc.outcome === "idempotent_replay",
    };
  }

  const requestId = rpc.requestId ?? undefined;
  switch (rpc.outcome) {
    case "stale_status":
      return {
        ok: false,
        code: "STALE_STATUS",
        message: "Catalogue revision status does not match the expected status.",
        requestId,
        outcome: rpc.outcome,
      };
    case "request_conflict":
      return {
        ok: false,
        code: "REQUEST_CONFLICT",
        message: "Request ID was reused with a different lifecycle command.",
        requestId,
        outcome: rpc.outcome,
      };
    case "revision_not_found":
      return {
        ok: false,
        code: "REVISION_NOT_FOUND",
        message: "Catalogue revision was not found.",
        requestId,
        outcome: rpc.outcome,
      };
    case "provenance_required":
      return {
        ok: false,
        code: "PROVENANCE_REQUIRED",
        message: "Catalogue revision lacks package provenance required for retirement.",
        requestId,
        outcome: rpc.outcome,
      };
    default:
      return {
        ok: false,
        code: "LIFECYCLE_FAILED",
        message: "Catalogue retirement failed.",
        requestId,
        outcome: rpc.outcome,
      };
  }
}

/**
 * Retire a published package-backed revision through the single lifecycle RPC.
 */
export async function retireMeasuredBoqCatalogueRevision(
  input: RetireMeasuredBoqCatalogueRevisionInput,
): Promise<RetireMeasuredBoqCatalogueRevisionResult> {
  if (!input || typeof input.revisionId !== "string" || !UUID_RE.test(input.revisionId)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "revisionId must be a UUID.",
    };
  }
  if (typeof input.requestId !== "string" || !UUID_RE.test(input.requestId)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "requestId must be a UUID.",
    };
  }
  if (input.expectedStatus !== "published") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "expectedStatus for retire must be published.",
      requestId: input.requestId,
    };
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason || reason.length > MAX_RETIREMENT_REASON_LENGTH) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "reason must be a non-empty string within database limits.",
      requestId: input.requestId,
    };
  }

  try {
    const rpc = await retireMeasuredBoqCatalogueRevisionRpc({
      revisionId: input.revisionId,
      expectedStatus: input.expectedStatus,
      reason,
      requestId: input.requestId,
    });
    return mapRpc(rpc);
  } catch (err) {
    if (err instanceof CatalogueLifecycleRpcError) {
      if (err.code === "CATALOGUE_LIFECYCLE_UNAVAILABLE") {
        return {
          ok: false,
          code: "LIFECYCLE_UNAVAILABLE",
          message: err.message,
          requestId: input.requestId,
        };
      }
      return {
        ok: false,
        code: "LIFECYCLE_FAILED",
        message: err.message,
        requestId: input.requestId,
      };
    }
    return {
      ok: false,
      code: "LIFECYCLE_FAILED",
      message: "Catalogue retirement failed.",
      requestId: input.requestId,
    };
  }
}
