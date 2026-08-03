/**
 * 4C2E-B2E — Server-owned catalogue publish use case.
 *
 * Validates UUIDs and expected status, invokes the lifecycle repository once.
 * No B1, no package ingestion, no browser surface, no active pointer.
 */
import {
  CatalogueLifecycleRpcError,
  publishMeasuredBoqCatalogueRevisionRpc,
  type LifecycleRpcResult,
} from "../../infrastructure/catalogue/measuredBoqCatalogueLifecycle.repository.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublishMeasuredBoqCatalogueRevisionInput = {
  revisionId: string;
  expectedStatus: string;
  requestId: string;
};

export type PublishMeasuredBoqCatalogueRevisionErrorCode =
  | "INVALID_REQUEST"
  | "STALE_STATUS"
  | "RIGHTS_NOT_PUBLISHABLE"
  | "PRODUCTION_POLICY_REJECTED"
  | "REQUEST_CONFLICT"
  | "REVISION_NOT_FOUND"
  | "PROVENANCE_REQUIRED"
  | "LIFECYCLE_FAILED"
  | "LIFECYCLE_UNAVAILABLE";

export type PublishMeasuredBoqCatalogueRevisionResult =
  | {
      ok: true;
      outcome: "published" | "idempotent_replay" | "already_published";
      revisionId: string;
      previousStatus: string | null;
      newStatus: string | null;
      eventId: string | null;
      requestId: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      code: PublishMeasuredBoqCatalogueRevisionErrorCode;
      message: string;
      requestId?: string;
      outcome?: string;
    };

function mapRpc(rpc: LifecycleRpcResult): PublishMeasuredBoqCatalogueRevisionResult {
  if (
    (rpc.outcome === "published" ||
      rpc.outcome === "idempotent_replay" ||
      rpc.outcome === "already_published") &&
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
    case "rights_not_publishable":
      return {
        ok: false,
        code: "RIGHTS_NOT_PUBLISHABLE",
        message: "Catalogue package rights do not allow publication.",
        requestId,
        outcome: rpc.outcome,
      };
    case "production_policy_rejected":
      return {
        ok: false,
        code: "PRODUCTION_POLICY_REJECTED",
        message: "Production catalogue revisions cannot be published by this boundary.",
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
        message: "Catalogue revision lacks package provenance required for publication.",
        requestId,
        outcome: rpc.outcome,
      };
    default:
      return {
        ok: false,
        code: "LIFECYCLE_FAILED",
        message: "Catalogue publication failed.",
        requestId,
        outcome: rpc.outcome,
      };
  }
}

/**
 * Publish a package-backed draft revision through the single lifecycle RPC.
 */
export async function publishMeasuredBoqCatalogueRevision(
  input: PublishMeasuredBoqCatalogueRevisionInput,
): Promise<PublishMeasuredBoqCatalogueRevisionResult> {
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
  if (input.expectedStatus !== "draft") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "expectedStatus for publish must be draft.",
      requestId: input.requestId,
    };
  }

  try {
    const rpc = await publishMeasuredBoqCatalogueRevisionRpc({
      revisionId: input.revisionId,
      expectedStatus: input.expectedStatus,
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
      message: "Catalogue publication failed.",
      requestId: input.requestId,
    };
  }
}
