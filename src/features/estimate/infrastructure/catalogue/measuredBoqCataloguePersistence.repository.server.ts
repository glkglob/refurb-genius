/**
 * Server-only write adapter for B2D draft catalogue package persistence.
 *
 * Invokes exactly one RPC: public.persist_measured_boq_catalog_draft.
 * No direct table DML. No lifecycle RPCs. service_role client only.
 */
import type { Json } from "@repo/supabase";

type ServiceClient = Awaited<
  ReturnType<typeof import("@/platform/supabase/service.server").createServiceRoleSupabase>
>;

/** JSON-serialisable entry row built by the application command from B1 output. */
export type PersistDraftEntryPayload = {
  rate_key: string;
  display_name: string;
  description: string | null;
  trade_or_domain: string;
  unit: string;
  cost_type: string;
  base_unit_rate: number;
  currency: string;
  vat_basis: string;
  source_reference: string | null;
  status: string;
  replacement_rate_key: string | null;
};

export type PersistDraftRpcCommand = {
  manifestText: string;
  snapshotText: string;
  catalogRevision: string;
  sourceId: string;
  manifestVersion: number;
  normaliserVersion: string;
  inputChecksum: string;
  contentChecksum: string;
  normalizedEntries: PersistDraftEntryPayload[];
  validationReport: {
    tool: string;
    ok: boolean;
    licenceStatus: string;
    production: boolean;
    schemaVersion: string;
    effectiveFrom: string;
    sourceDescription: string;
    createdBy: string;
    warningCount: number;
    warnings: unknown[];
    inputChecksum: string;
    contentChecksum: string;
  };
  requestId: string;
};

export type PersistDraftRpcOutcome =
  | "created"
  | "idempotent_replay"
  | "revision_conflict"
  | "package_conflict"
  | "request_conflict"
  | "payload_too_large"
  | "invalid_persistence_command"
  | "production_blocked"
  | "unauthorised"
  | "database_failure"
  | "validation_failed";

export type PersistDraftRpcResult = {
  outcome: PersistDraftRpcOutcome;
  packageId: string | null;
  revisionId: string | null;
  inputChecksum: string | null;
  contentChecksum: string | null;
  requestId: string | null;
  idempotentReplay: boolean;
};

export class CataloguePersistenceRpcError extends Error {
  readonly code: "CATALOGUE_PERSISTENCE_RPC_FAILED" | "CATALOGUE_PERSISTENCE_UNAVAILABLE";
  constructor(
    code: "CATALOGUE_PERSISTENCE_RPC_FAILED" | "CATALOGUE_PERSISTENCE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "CataloguePersistenceRpcError";
    this.code = code;
  }
}

async function getServiceClient(): Promise<ServiceClient> {
  const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
  try {
    return createServiceRoleSupabase();
  } catch {
    throw new CataloguePersistenceRpcError(
      "CATALOGUE_PERSISTENCE_UNAVAILABLE",
      "Catalogue persistence is not configured on the server.",
    );
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseRpcPayload(data: unknown): PersistDraftRpcResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CataloguePersistenceRpcError(
      "CATALOGUE_PERSISTENCE_RPC_FAILED",
      "Catalogue persistence RPC returned an invalid payload.",
    );
  }
  const row = data as Record<string, unknown>;
  const outcomeRaw = asString(row.outcome) ?? "database_failure";
  const allowed: PersistDraftRpcOutcome[] = [
    "created",
    "idempotent_replay",
    "revision_conflict",
    "package_conflict",
    "request_conflict",
    "payload_too_large",
    "invalid_persistence_command",
    "production_blocked",
    "unauthorised",
    "database_failure",
    "validation_failed",
  ];
  const outcome = (
    allowed.includes(outcomeRaw as PersistDraftRpcOutcome) ? outcomeRaw : "database_failure"
  ) as PersistDraftRpcOutcome;

  return {
    outcome,
    packageId: asString(row.package_id),
    revisionId: asString(row.revision_id),
    inputChecksum: asString(row.input_checksum),
    contentChecksum: asString(row.content_checksum),
    requestId: asString(row.request_id),
    idempotentReplay: asBoolean(row.idempotent_replay),
  };
}

/**
 * Execute the single atomic draft-persistence RPC.
 * Optional client injection is for tests only.
 */
export async function persistMeasuredBoqCatalogueDraftRpc(
  command: PersistDraftRpcCommand,
  options?: { client?: ServiceClient },
): Promise<PersistDraftRpcResult> {
  const supabase = options?.client ?? (await getServiceClient());

  // Generated RPC Args require Json. Payload is fully server-built from B1; single
  // structural cast only at this boundary (no double-cast, no any).
  const { data, error } = await supabase.rpc("persist_measured_boq_catalog_draft", {
    p_manifest_text: command.manifestText,
    p_snapshot_text: command.snapshotText,
    p_catalog_revision: command.catalogRevision,
    p_source_id: command.sourceId,
    p_manifest_version: command.manifestVersion,
    p_normaliser_version: command.normaliserVersion,
    p_input_checksum: command.inputChecksum,
    p_content_checksum: command.contentChecksum,
    p_normalized_entries: command.normalizedEntries as Json,
    p_validation_report: command.validationReport as Json,
    p_request_id: command.requestId,
  });

  if (error) {
    const message = error.message ?? "rpc failed";
    if (/fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|503|502|504/i.test(message)) {
      throw new CataloguePersistenceRpcError(
        "CATALOGUE_PERSISTENCE_UNAVAILABLE",
        "Catalogue persistence is temporarily unavailable.",
      );
    }
    throw new CataloguePersistenceRpcError(
      "CATALOGUE_PERSISTENCE_RPC_FAILED",
      "Catalogue persistence RPC failed.",
    );
  }

  return parseRpcPayload(data);
}
