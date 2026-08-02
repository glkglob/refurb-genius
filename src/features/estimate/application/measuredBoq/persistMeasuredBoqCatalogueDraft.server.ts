/**
 * 4C2E-B2D — Server-owned draft catalogue package persistence use case.
 *
 * Flow:
 *  raw artefacts → B1 dry-run → policy → build RPC command → one repository RPC
 *
 * Never accepts trusted ok/entries/checksums from the caller.
 * No browser surface. No lifecycle operations.
 */
import {
  B1_MANIFEST_VERSION,
  B1_NORMALISER_VERSION,
  runCatalogueDryRun,
  type MeasuredBoqCatalogueValidatedEntry,
} from "@repo/services";
import {
  CataloguePersistenceRpcError,
  persistMeasuredBoqCatalogueDraftRpc,
  type PersistDraftEntryPayload,
  type PersistDraftRpcResult,
} from "../../infrastructure/catalogue/measuredBoqCataloguePersistence.repository.server";

export const MAX_MANIFEST_BYTES = 1_048_576;
export const MAX_SNAPSHOT_BYTES = 8_388_608;
export const MAX_VALIDATION_REPORT_BYTES = 2_097_152;
export const MAX_ENTRY_COUNT = 50_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PersistMeasuredBoqCatalogueDraftInput = {
  manifestText: string;
  snapshotText: string;
  requestId: string;
};

export type PersistMeasuredBoqCatalogueDraftErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_FAILED"
  | "PRODUCTION_BLOCKED"
  | "REQUEST_CONFLICT"
  | "REVISION_CONFLICT"
  | "PACKAGE_CONFLICT"
  | "PERSISTENCE_FAILED"
  | "PERSISTENCE_UNAVAILABLE";

export type PersistMeasuredBoqCatalogueDraftResult =
  | {
      ok: true;
      outcome: "created" | "idempotent_replay";
      packageId: string;
      revisionId: string;
      catalogRevision: string;
      inputChecksum: string;
      contentChecksum: string;
      requestId: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      code: PersistMeasuredBoqCatalogueDraftErrorCode;
      message: string;
      requestId?: string;
      issues?: Array<{ code: string; path: string; message: string }>;
    };

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function mapEntry(entry: MeasuredBoqCatalogueValidatedEntry): PersistDraftEntryPayload {
  return {
    rate_key: entry.rateKey,
    display_name: entry.displayName,
    description: entry.description,
    trade_or_domain: entry.tradeOrDomain,
    unit: entry.unit,
    cost_type: entry.costType,
    base_unit_rate: entry.baseUnitRate,
    currency: entry.currency,
    vat_basis: entry.vatBasis,
    source_reference: entry.sourceReference,
    status: entry.status,
    replacement_rate_key: entry.replacementRateKey,
  };
}

function mapRpcOutcome(
  rpc: PersistDraftRpcResult,
  catalogRevision: string,
): PersistMeasuredBoqCatalogueDraftResult {
  if (
    (rpc.outcome === "created" || rpc.outcome === "idempotent_replay") &&
    rpc.packageId &&
    rpc.revisionId &&
    rpc.inputChecksum &&
    rpc.contentChecksum &&
    rpc.requestId
  ) {
    return {
      ok: true,
      outcome: rpc.outcome === "created" ? "created" : "idempotent_replay",
      packageId: rpc.packageId,
      revisionId: rpc.revisionId,
      catalogRevision,
      inputChecksum: rpc.inputChecksum,
      contentChecksum: rpc.contentChecksum,
      requestId: rpc.requestId,
      idempotentReplay: rpc.idempotentReplay || rpc.outcome === "idempotent_replay",
    };
  }

  const requestId = rpc.requestId ?? undefined;
  switch (rpc.outcome) {
    case "payload_too_large":
      return {
        ok: false,
        code: "PAYLOAD_TOO_LARGE",
        message: "Catalogue package exceeds hard size or entry limits.",
        requestId,
      };
    case "production_blocked":
      return {
        ok: false,
        code: "PRODUCTION_BLOCKED",
        message: "Production catalogue packages cannot be persisted by this boundary.",
        requestId,
      };
    case "request_conflict":
      return {
        ok: false,
        code: "REQUEST_CONFLICT",
        message: "Request ID was reused with a different persistence payload.",
        requestId,
      };
    case "revision_conflict":
      return {
        ok: false,
        code: "REVISION_CONFLICT",
        message: "Catalogue revision label already exists for a different package.",
        requestId,
      };
    case "package_conflict":
      return {
        ok: false,
        code: "PACKAGE_CONFLICT",
        message: "Package identity conflicts with an existing catalogue package.",
        requestId,
      };
    case "validation_failed":
    case "invalid_persistence_command":
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Catalogue persistence rejected the command payload.",
        requestId,
      };
    default:
      return {
        ok: false,
        code: "PERSISTENCE_FAILED",
        message: "Catalogue draft persistence failed.",
        requestId,
      };
  }
}

/**
 * Persist a validated synthetic/rights_unverified catalogue package as an immutable draft.
 */
export async function persistMeasuredBoqCatalogueDraft(
  input: PersistMeasuredBoqCatalogueDraftInput,
): Promise<PersistMeasuredBoqCatalogueDraftResult> {
  if (!input || typeof input.manifestText !== "string" || typeof input.snapshotText !== "string") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "manifestText and snapshotText are required.",
    };
  }
  if (typeof input.requestId !== "string" || !UUID_RE.test(input.requestId)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "requestId must be a UUID.",
    };
  }

  const manifestBytes = utf8ByteLength(input.manifestText);
  const snapshotBytes = utf8ByteLength(input.snapshotText);
  if (manifestBytes > MAX_MANIFEST_BYTES || snapshotBytes > MAX_SNAPSHOT_BYTES) {
    return {
      ok: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Catalogue package exceeds hard size limits.",
      requestId: input.requestId,
    };
  }

  const dryRun = runCatalogueDryRun({
    manifestText: input.manifestText,
    snapshotText: input.snapshotText,
  });

  const productionBlocked =
    dryRun.report.production === true ||
    dryRun.report.issues.some((i) => i.code === "PRODUCTION_BLOCKED");

  if (!dryRun.report.ok || !dryRun.validatedSnapshot || !dryRun.contentChecksum) {
    if (productionBlocked) {
      return {
        ok: false,
        code: "PRODUCTION_BLOCKED",
        message: "Production catalogue packages cannot be persisted by this boundary.",
        requestId: input.requestId,
        issues: dryRun.report.issues.map((i) => ({
          code: i.code,
          path: i.path,
          message: i.message,
        })),
      };
    }
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Catalogue package failed B1 validation.",
      requestId: input.requestId,
      issues: dryRun.report.issues.map((i) => ({
        code: i.code,
        path: i.path,
        message: i.message,
      })),
    };
  }

  if (productionBlocked) {
    return {
      ok: false,
      code: "PRODUCTION_BLOCKED",
      message: "Production catalogue packages cannot be persisted by this boundary.",
      requestId: input.requestId,
    };
  }

  const licence = dryRun.report.licenceStatus;
  if (licence !== "synthetic" && licence !== "rights_unverified") {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Only synthetic or rights_unverified packages may be persisted as drafts.",
      requestId: input.requestId,
    };
  }

  const snapshot = dryRun.validatedSnapshot;
  if (snapshot.entries.length > MAX_ENTRY_COUNT) {
    return {
      ok: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Catalogue package exceeds hard entry limits.",
      requestId: input.requestId,
    };
  }

  const validationReport = {
    tool: "catalogue-persist",
    ok: true,
    licenceStatus: licence,
    production: false,
    schemaVersion: snapshot.schemaVersion,
    effectiveFrom: snapshot.effectiveFrom,
    sourceDescription: snapshot.sourceDescription,
    createdBy: "persist_measured_boq_catalog_draft",
    warningCount: dryRun.report.warningCount,
    warnings: dryRun.report.warnings,
    inputChecksum: dryRun.report.inputChecksum,
    contentChecksum: dryRun.contentChecksum,
  };

  const reportBytes = utf8ByteLength(JSON.stringify(validationReport));
  if (reportBytes > MAX_VALIDATION_REPORT_BYTES) {
    return {
      ok: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Validation report exceeds hard size limits.",
      requestId: input.requestId,
    };
  }

  const normalizedEntries = snapshot.entries.map(mapEntry);

  try {
    const rpc = await persistMeasuredBoqCatalogueDraftRpc({
      manifestText: input.manifestText,
      snapshotText: input.snapshotText,
      catalogRevision: snapshot.catalogRevision,
      sourceId: dryRun.report.sourceId ?? snapshot.catalogRevision,
      manifestVersion: Number(B1_MANIFEST_VERSION),
      normaliserVersion: B1_NORMALISER_VERSION,
      inputChecksum: dryRun.report.inputChecksum,
      contentChecksum: dryRun.contentChecksum,
      normalizedEntries,
      validationReport,
      requestId: input.requestId,
    });
    return mapRpcOutcome(rpc, snapshot.catalogRevision);
  } catch (err) {
    if (err instanceof CataloguePersistenceRpcError) {
      if (err.code === "CATALOGUE_PERSISTENCE_UNAVAILABLE") {
        return {
          ok: false,
          code: "PERSISTENCE_UNAVAILABLE",
          message: err.message,
          requestId: input.requestId,
        };
      }
      return {
        ok: false,
        code: "PERSISTENCE_FAILED",
        message: err.message,
        requestId: input.requestId,
      };
    }
    return {
      ok: false,
      code: "PERSISTENCE_FAILED",
      message: "Catalogue draft persistence failed.",
      requestId: input.requestId,
    };
  }
}
