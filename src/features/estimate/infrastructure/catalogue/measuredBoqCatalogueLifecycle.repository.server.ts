/**
 * Server-only write adapter for B2E catalogue lifecycle RPCs.
 *
 * Exactly one RPC call per method. No table DML. No active pointer.
 * service_role client only.
 */
type ServiceClient = Awaited<
  ReturnType<typeof import("@/platform/supabase/service.server").createServiceRoleSupabase>
>;

export type LifecycleRpcOutcome =
  | "published"
  | "retired"
  | "rollback_recorded"
  | "idempotent_replay"
  | "already_published"
  | "already_retired"
  | "stale_status"
  | "rights_not_publishable"
  | "production_policy_rejected"
  | "request_conflict"
  | "revision_not_found"
  | "provenance_required"
  | "unauthorised"
  | "database_failure"
  | "unexpected_internal_failure";

export type LifecycleRpcResult = {
  outcome: LifecycleRpcOutcome;
  revisionId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  eventId: string | null;
  requestId: string | null;
  idempotentReplay: boolean;
};

export type PublishLifecycleRpcCommand = {
  revisionId: string;
  expectedStatus: string;
  requestId: string;
};

export type RetireLifecycleRpcCommand = {
  revisionId: string;
  expectedStatus: string;
  reason: string;
  requestId: string;
};

export type RollbackLifecycleRpcCommand = {
  revisionId: string;
  priorRevisionId: string;
  expectedStatus: string;
  reason: string;
  requestId: string;
};

export class CatalogueLifecycleRpcError extends Error {
  readonly code: "CATALOGUE_LIFECYCLE_RPC_FAILED" | "CATALOGUE_LIFECYCLE_UNAVAILABLE";
  constructor(
    code: "CATALOGUE_LIFECYCLE_RPC_FAILED" | "CATALOGUE_LIFECYCLE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "CatalogueLifecycleRpcError";
    this.code = code;
  }
}

const ALLOWED_OUTCOMES: LifecycleRpcOutcome[] = [
  "published",
  "retired",
  "rollback_recorded",
  "idempotent_replay",
  "already_published",
  "already_retired",
  "stale_status",
  "rights_not_publishable",
  "production_policy_rejected",
  "request_conflict",
  "revision_not_found",
  "provenance_required",
  "unauthorised",
  "database_failure",
  "unexpected_internal_failure",
];

async function getServiceClient(): Promise<ServiceClient> {
  const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
  try {
    return createServiceRoleSupabase();
  } catch {
    throw new CatalogueLifecycleRpcError(
      "CATALOGUE_LIFECYCLE_UNAVAILABLE",
      "Catalogue lifecycle is not configured on the server.",
    );
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseRpcPayload(data: unknown): LifecycleRpcResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CatalogueLifecycleRpcError(
      "CATALOGUE_LIFECYCLE_RPC_FAILED",
      "Catalogue lifecycle RPC returned an invalid payload.",
    );
  }
  const row = data as Record<string, unknown>;
  const outcomeRaw = asString(row.outcome) ?? "database_failure";
  const outcome = (
    ALLOWED_OUTCOMES.includes(outcomeRaw as LifecycleRpcOutcome) ? outcomeRaw : "database_failure"
  ) as LifecycleRpcOutcome;

  return {
    outcome,
    revisionId: asString(row.revision_id),
    previousStatus: asString(row.previous_status),
    newStatus: asString(row.new_status),
    eventId: asString(row.event_id),
    requestId: asString(row.request_id),
    idempotentReplay: asBoolean(row.idempotent_replay),
  };
}

function mapRpcError(error: { message?: string }): never {
  const message = error.message ?? "rpc failed";
  if (/fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|503|502|504/i.test(message)) {
    throw new CatalogueLifecycleRpcError(
      "CATALOGUE_LIFECYCLE_UNAVAILABLE",
      "Catalogue lifecycle is temporarily unavailable.",
    );
  }
  throw new CatalogueLifecycleRpcError(
    "CATALOGUE_LIFECYCLE_RPC_FAILED",
    "Catalogue lifecycle RPC failed.",
  );
}

/**
 * Publish a draft package-backed revision (draft → published).
 * Optional client injection is for tests only.
 */
export async function publishMeasuredBoqCatalogueRevisionRpc(
  command: PublishLifecycleRpcCommand,
  options?: { client?: ServiceClient },
): Promise<LifecycleRpcResult> {
  const supabase = options?.client ?? (await getServiceClient());
  const { data, error } = await supabase.rpc("publish_measured_boq_catalog_revision", {
    p_revision_id: command.revisionId,
    p_expected_status: command.expectedStatus,
    p_request_id: command.requestId,
  });
  if (error) mapRpcError(error);
  return parseRpcPayload(data);
}

/**
 * Retire a published revision (published → retired).
 */
export async function retireMeasuredBoqCatalogueRevisionRpc(
  command: RetireLifecycleRpcCommand,
  options?: { client?: ServiceClient },
): Promise<LifecycleRpcResult> {
  const supabase = options?.client ?? (await getServiceClient());
  const { data, error } = await supabase.rpc("retire_measured_boq_catalog_revision", {
    p_revision_id: command.revisionId,
    p_expected_status: command.expectedStatus,
    p_reason: command.reason,
    p_request_id: command.requestId,
  });
  if (error) mapRpcError(error);
  return parseRpcPayload(data);
}

/**
 * Rollback-retire target only; prior remains published (no active pointer).
 */
export async function rollbackMeasuredBoqCataloguePublicationRpc(
  command: RollbackLifecycleRpcCommand,
  options?: { client?: ServiceClient },
): Promise<LifecycleRpcResult> {
  const supabase = options?.client ?? (await getServiceClient());
  const { data, error } = await supabase.rpc("rollback_measured_boq_catalog_publication", {
    p_revision_id: command.revisionId,
    p_prior_revision_id: command.priorRevisionId,
    p_expected_status: command.expectedStatus,
    p_reason: command.reason,
    p_request_id: command.requestId,
  });
  if (error) mapRpcError(error);
  return parseRpcPayload(data);
}
