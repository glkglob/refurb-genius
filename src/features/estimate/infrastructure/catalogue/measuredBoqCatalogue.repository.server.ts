/**
 * Server-only measured-BOQ catalogue snapshot loader and Map resolver factory.
 *
 * - service_role only
 * - exact catalog_revision lookup
 * - one revision query + one entries query per load
 * - checksum + entry_count validation
 * - process-local cache keyed by catalog_revision + content_checksum
 * - no latest/current fallback
 * - no browser barrel export
 */

import {
  validateCatalogueSnapshot,
  type MeasuredBoqCatalogueSourceEntry,
  type MeasuredBoqCatalogueSourceSnapshot,
  type MeasuredBoqLibraryCatalogEntry,
  type MeasuredBoqLibraryRateResolver,
  type MeasuredBoqCostType,
} from "@repo/services";

export type CatalogueLoadPurpose = "authority" | "reproduction";

export type LoadedCatalogueSnapshot = {
  catalogRevision: string;
  contentChecksum: string;
  status: "published" | "retired";
  entryCount: number;
  entriesByRateKey: Map<string, MeasuredBoqLibraryCatalogEntry>;
  resolveLibraryRate: MeasuredBoqLibraryRateResolver;
};

export type CatalogueLoadErrorCode =
  | "CATALOG_REVISION_NOT_FOUND"
  | "CATALOG_REVISION_NOT_PUBLISHED"
  | "CATALOG_REVISION_NOT_READABLE"
  | "CATALOG_CHECKSUM_MISMATCH"
  | "CATALOG_ENTRY_COUNT_MISMATCH"
  | "CATALOG_ENTRY_INVALID"
  | "CATALOG_DUPLICATE_RATE_KEY"
  | "CATALOG_LOAD_FAILED";

export class CatalogueLoadError extends Error {
  readonly code: CatalogueLoadErrorCode;
  constructor(code: CatalogueLoadErrorCode, message: string) {
    super(message);
    this.name = "CatalogueLoadError";
    this.code = code;
  }
}

type ServiceRoleClient = ReturnType<
  typeof import("@/platform/supabase/service.server").createServiceRoleSupabase
>;

type CacheKey = string;

const snapshotCache = new Map<CacheKey, LoadedCatalogueSnapshot>();

function cacheKey(catalogRevision: string, contentChecksum: string): CacheKey {
  return `${catalogRevision}::${contentChecksum}`;
}

/** Test-only cache reset — not exported from browser barrels. */
export function __resetMeasuredBoqCatalogueCacheForTests(): void {
  snapshotCache.clear();
}

async function getServiceClient(): Promise<ServiceRoleClient> {
  const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
  return createServiceRoleSupabase();
}

function toSourceEntry(row: {
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
}): MeasuredBoqCatalogueSourceEntry {
  return {
    rateKey: row.rate_key,
    displayName: row.display_name,
    description: row.description,
    tradeOrDomain: row.trade_or_domain,
    unit: row.unit,
    costType: row.cost_type,
    baseUnitRate: Number(row.base_unit_rate),
    currency: row.currency,
    vatBasis: row.vat_basis,
    sourceReference: row.source_reference,
    status: row.status,
    replacementRateKey: row.replacement_rate_key,
  };
}

function toEngineEntry(
  catalogRevision: string,
  entry: MeasuredBoqCatalogueSourceEntry,
): MeasuredBoqLibraryCatalogEntry {
  return {
    rateKey: entry.rateKey,
    catalogRevision,
    baseUnitRate: entry.baseUnitRate,
    currency: "GBP",
    vatBasis: "exclusive",
    unit: entry.unit,
    costType: entry.costType as MeasuredBoqCostType,
  };
}

/**
 * Load one immutable catalogue revision and build a synchronous Map resolver.
 *
 * authority: published only
 * reproduction: published or retired
 */
export async function loadMeasuredBoqCatalogueSnapshot(input: {
  catalogRevision: string;
  purpose: CatalogueLoadPurpose;
  /** Optional client injection for tests. */
  client?: ServiceRoleClient;
}): Promise<LoadedCatalogueSnapshot> {
  const revisionId = input.catalogRevision;
  if (typeof revisionId !== "string" || revisionId.trim() === "") {
    throw new CatalogueLoadError("CATALOG_REVISION_NOT_FOUND", "catalogRevision is required");
  }

  // Never accept mutable aliases
  if (revisionId === "latest" || revisionId === "current") {
    throw new CatalogueLoadError(
      "CATALOG_REVISION_NOT_FOUND",
      "latest/current catalogue aliases are forbidden",
    );
  }

  const supabase = input.client ?? (await getServiceClient());

  const { data: revision, error: revError } = await supabase
    .from("measured_boq_catalog_revisions")
    .select(
      "catalog_revision,status,schema_version,currency,vat_basis,regional_basis,source_description,entry_count,content_checksum,effective_from",
    )
    .eq("catalog_revision", revisionId)
    .maybeSingle();

  if (revError) {
    throw new CatalogueLoadError("CATALOG_LOAD_FAILED", revError.message);
  }
  if (!revision) {
    throw new CatalogueLoadError(
      "CATALOG_REVISION_NOT_FOUND",
      `Catalogue revision not found: ${revisionId}`,
    );
  }

  if (input.purpose === "authority") {
    if (revision.status !== "published") {
      throw new CatalogueLoadError(
        "CATALOG_REVISION_NOT_PUBLISHED",
        `Authority loads require published status (got ${revision.status})`,
      );
    }
  } else {
    if (revision.status !== "published" && revision.status !== "retired") {
      throw new CatalogueLoadError(
        "CATALOG_REVISION_NOT_READABLE",
        `Reproduction loads require published or retired status (got ${revision.status})`,
      );
    }
  }

  const existing = snapshotCache.get(
    cacheKey(revision.catalog_revision, revision.content_checksum),
  );
  if (existing) {
    return existing;
  }

  const { data: entryRows, error: entriesError } = await supabase
    .from("measured_boq_catalog_entries")
    .select(
      "rate_key,display_name,description,trade_or_domain,unit,cost_type,base_unit_rate,currency,vat_basis,source_reference,status,replacement_rate_key",
    )
    .eq("catalog_revision", revisionId);

  if (entriesError) {
    throw new CatalogueLoadError("CATALOG_LOAD_FAILED", entriesError.message);
  }

  const rows = entryRows ?? [];
  if (rows.length !== revision.entry_count) {
    throw new CatalogueLoadError(
      "CATALOG_ENTRY_COUNT_MISMATCH",
      `entry_count ${revision.entry_count} does not match loaded rows ${rows.length}`,
    );
  }

  const sourceEntries = rows.map(toSourceEntry);
  const snapshot: MeasuredBoqCatalogueSourceSnapshot = {
    schemaVersion: revision.schema_version,
    catalogRevision: revision.catalog_revision,
    currency: revision.currency,
    vatBasis: revision.vat_basis,
    regionalBasis: revision.regional_basis,
    effectiveFrom: revision.effective_from,
    sourceDescription: revision.source_description,
    entryCount: revision.entry_count,
    contentChecksum: revision.content_checksum,
    status: revision.status,
    entries: sourceEntries,
  };

  const validated = validateCatalogueSnapshot(snapshot);
  if (!validated.ok) {
    const first = validated.issues[0]!;
    if (first.code === "CATALOG_CHECKSUM_MISMATCH") {
      throw new CatalogueLoadError("CATALOG_CHECKSUM_MISMATCH", first.message);
    }
    if (first.code === "CATALOG_DUPLICATE_RATE_KEY") {
      throw new CatalogueLoadError("CATALOG_DUPLICATE_RATE_KEY", first.message);
    }
    throw new CatalogueLoadError("CATALOG_ENTRY_INVALID", first.message);
  }

  if (validated.contentChecksum !== revision.content_checksum) {
    throw new CatalogueLoadError(
      "CATALOG_CHECKSUM_MISMATCH",
      "Stored content_checksum does not match recomputed digest",
    );
  }

  const entriesByRateKey = new Map<string, MeasuredBoqLibraryCatalogEntry>();
  for (const entry of sourceEntries) {
    if (entriesByRateKey.has(entry.rateKey)) {
      throw new CatalogueLoadError(
        "CATALOG_DUPLICATE_RATE_KEY",
        `duplicate rate_key ${entry.rateKey}`,
      );
    }
    entriesByRateKey.set(entry.rateKey, toEngineEntry(revision.catalog_revision, entry));
  }

  const resolveLibraryRate: MeasuredBoqLibraryRateResolver = (reference) => {
    if (reference.catalogRevision !== revision.catalog_revision) {
      return null;
    }
    return entriesByRateKey.get(reference.rateKey) ?? null;
  };

  const loaded: LoadedCatalogueSnapshot = {
    catalogRevision: revision.catalog_revision,
    contentChecksum: revision.content_checksum,
    status: revision.status as "published" | "retired",
    entryCount: revision.entry_count,
    entriesByRateKey,
    resolveLibraryRate,
  };

  snapshotCache.set(cacheKey(revision.catalog_revision, revision.content_checksum), loaded);
  return loaded;
}

/**
 * Build a synchronous resolver over an already-validated in-memory entry map.
 * Used by unit tests and the loader.
 */
export function createMeasuredBoqLibraryResolverFromMap(
  catalogRevision: string,
  entriesByRateKey: Map<string, MeasuredBoqLibraryCatalogEntry>,
): MeasuredBoqLibraryRateResolver {
  return (reference) => {
    if (reference.catalogRevision !== catalogRevision) return null;
    return entriesByRateKey.get(reference.rateKey) ?? null;
  };
}
