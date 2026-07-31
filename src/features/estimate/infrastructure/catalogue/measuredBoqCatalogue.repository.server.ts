/**
 * Server-only measured-BOQ catalogue snapshot loader and Map resolver factory.
 *
 * - service_role only
 * - exact catalog_revision lookup
 * - paginated entry loads ordered by rate_key
 * - checksum + entry_count validation
 * - process-local bounded LRU cache of immutable entry material only
 * - every load re-reads revision status (fresh lifecycle)
 * - no latest/current fallback
 * - no browser barrel export
 * - no mutable Map exposure on the public surface
 */

import {
  validateCatalogueSnapshot,
  type MeasuredBoqCatalogueSourceEntry,
  type MeasuredBoqCatalogueSourceSnapshot,
  type MeasuredBoqCatalogueValidatedEntry,
  type MeasuredBoqLibraryCatalogEntry,
  type MeasuredBoqLibraryRateResolver,
} from "@repo/services";

export type CatalogueLoadPurpose = "authority" | "reproduction";

export type LoadedCatalogueSnapshot = {
  catalogRevision: string;
  contentChecksum: string;
  status: "published" | "retired";
  entryCount: number;
  resolveLibraryRate: MeasuredBoqLibraryRateResolver;
};

export type CatalogueLoadErrorCode =
  | "CATALOG_REVISION_NOT_FOUND"
  | "CATALOG_REVISION_NOT_PUBLISHED"
  | "CATALOG_REVISION_NOT_READABLE"
  | "CATALOG_CHECKSUM_MISMATCH"
  | "CATALOG_ENTRY_COUNT_MISMATCH"
  | "CATALOG_ENTRY_PAGE_INCOMPLETE"
  | "CATALOG_ENTRY_INVALID"
  | "CATALOG_DUPLICATE_RATE_KEY"
  | "CATALOG_LOAD_FAILED"
  | "CATALOG_LOAD_TIMEOUT";

export class CatalogueLoadError extends Error {
  readonly code: CatalogueLoadErrorCode;
  constructor(code: CatalogueLoadErrorCode, message: string) {
    super(message);
    this.name = "CatalogueLoadError";
    this.code = code;
  }
}

/** Documented max simultaneous cached revisions (immutable entry material only). */
export const MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES = 8;

/** Inclusive page size for PostgREST range queries. */
export const MEASURED_BOQ_CATALOGUE_ENTRY_PAGE_SIZE = 500;

/** Per-query abort timeout for revision and entry page fetches. */
export const MEASURED_BOQ_CATALOGUE_QUERY_TIMEOUT_MS = 15_000;

type ServiceRoleClient = ReturnType<
  typeof import("@/platform/supabase/service.server").createServiceRoleSupabase
>;

type CacheKey = string;

type CachedEntryMaterial = {
  catalogRevision: string;
  contentChecksum: string;
  entryCount: number;
  /** Frozen engine entries keyed by rateKey. */
  entriesByRateKey: ReadonlyMap<string, Readonly<MeasuredBoqLibraryCatalogEntry>>;
};

const entryMaterialCache = new Map<CacheKey, CachedEntryMaterial>();
/** LRU order: index 0 = oldest. */
const entryMaterialLru: CacheKey[] = [];

function cacheKey(catalogRevision: string, contentChecksum: string): CacheKey {
  return `${catalogRevision}::${contentChecksum}`;
}

function touchLru(key: CacheKey): void {
  const idx = entryMaterialLru.indexOf(key);
  if (idx >= 0) entryMaterialLru.splice(idx, 1);
  entryMaterialLru.push(key);
}

function setCache(key: CacheKey, value: CachedEntryMaterial): void {
  if (entryMaterialCache.has(key)) {
    entryMaterialCache.set(key, value);
    touchLru(key);
    return;
  }
  while (
    entryMaterialCache.size >= MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES &&
    entryMaterialLru.length > 0
  ) {
    const oldest = entryMaterialLru.shift()!;
    entryMaterialCache.delete(oldest);
  }
  entryMaterialCache.set(key, value);
  entryMaterialLru.push(key);
}

function getCache(key: CacheKey): CachedEntryMaterial | undefined {
  const hit = entryMaterialCache.get(key);
  if (!hit) return undefined;
  touchLru(key);
  return hit;
}

/** Test-only cache reset — not exported from browser barrels. */
export function __resetMeasuredBoqCatalogueCacheForTests(): void {
  entryMaterialCache.clear();
  entryMaterialLru.length = 0;
}

/** Test-only: observe cache size. */
export function __measuredBoqCatalogueCacheSizeForTests(): number {
  return entryMaterialCache.size;
}

/** Test-only: force-fill cache to exercise LRU eviction bounds. */
export function __seedMeasuredBoqCatalogueCacheForTests(keys: string[]): void {
  for (const key of keys) {
    setCache(key, {
      catalogRevision: key,
      contentChecksum: "seed",
      entryCount: 0,
      entriesByRateKey: new Map(),
    });
  }
}

async function getServiceClient(): Promise<ServiceRoleClient> {
  const { createServiceRoleSupabase } = await import("@/platform/supabase/service.server");
  return createServiceRoleSupabase();
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; code?: string };
  return (
    e.name === "AbortError" ||
    e.name === "TimeoutError" ||
    e.code === "ABORT_ERR" ||
    (typeof e.message === "string" && /aborted|timeout/i.test(e.message))
  );
}

function wrapQueryError(err: unknown, fallback: string): CatalogueLoadError {
  if (isAbortError(err)) {
    return new CatalogueLoadError("CATALOG_LOAD_TIMEOUT", "Catalogue query timed out");
  }
  if (err instanceof CatalogueLoadError) return err;
  const message = err instanceof Error ? err.message : fallback;
  return new CatalogueLoadError("CATALOG_LOAD_FAILED", message);
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
  entry: MeasuredBoqCatalogueValidatedEntry,
): Readonly<MeasuredBoqLibraryCatalogEntry> {
  return Object.freeze({
    rateKey: entry.rateKey,
    catalogRevision,
    baseUnitRate: entry.baseUnitRate,
    currency: "GBP" as const,
    vatBasis: "exclusive" as const,
    unit: entry.unit,
    costType: entry.costType,
  });
}

/**
 * Build a synchronous resolver over an already-validated frozen entry map.
 * Returns frozen defensive copies so callers cannot mutate cache contents.
 */
export function createMeasuredBoqLibraryResolverFromMap(
  catalogRevision: string,
  entriesByRateKey: ReadonlyMap<string, Readonly<MeasuredBoqLibraryCatalogEntry>>,
): MeasuredBoqLibraryRateResolver {
  return (reference) => {
    if (reference.catalogRevision !== catalogRevision) return null;
    const hit = entriesByRateKey.get(reference.rateKey);
    if (!hit) return null;
    return Object.freeze({ ...hit });
  };
}

type EntryRow = {
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

async function loadAllEntryRows(
  supabase: ServiceRoleClient,
  revisionId: string,
  expectedCount: number,
  signal: AbortSignal,
): Promise<EntryRow[]> {
  const pageSize = MEASURED_BOQ_CATALOGUE_ENTRY_PAGE_SIZE;
  const rows: EntryRow[] = [];
  let offset = 0;
  let previousFirstKey: string | null = null;

  while (rows.length < expectedCount) {
    const from = offset;
    const to = offset + pageSize - 1;

    let page: EntryRow[] | null = null;
    let error: { message: string } | null = null;
    try {
      const result = await supabase
        .from("measured_boq_catalog_entries")
        .select(
          "rate_key,display_name,description,trade_or_domain,unit,cost_type,base_unit_rate,currency,vat_basis,source_reference,status,replacement_rate_key",
        )
        .eq("catalog_revision", revisionId)
        .order("rate_key", { ascending: true })
        .range(from, to)
        .abortSignal(signal);
      page = (result.data as EntryRow[] | null) ?? null;
      error = result.error;
    } catch (err) {
      throw wrapQueryError(err, "entry page query failed");
    }

    if (error) {
      throw new CatalogueLoadError("CATALOG_LOAD_FAILED", error.message);
    }

    const batch = page ?? [];
    if (batch.length === 0) {
      throw new CatalogueLoadError(
        "CATALOG_ENTRY_PAGE_INCOMPLETE",
        `Premature end of entry pages at offset ${offset}; loaded ${rows.length} of ${expectedCount}`,
      );
    }

    const firstKey = batch[0]!.rate_key;
    if (previousFirstKey != null && firstKey === previousFirstKey && offset > 0) {
      throw new CatalogueLoadError(
        "CATALOG_ENTRY_PAGE_INCOMPLETE",
        `Entry page made no progress at offset ${offset}`,
      );
    }
    previousFirstKey = firstKey;

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }
    offset += pageSize;

    if (offset > expectedCount + pageSize) {
      throw new CatalogueLoadError(
        "CATALOG_ENTRY_PAGE_INCOMPLETE",
        "Entry pagination exceeded expected bounds without completing",
      );
    }
  }

  if (rows.length !== expectedCount) {
    throw new CatalogueLoadError(
      "CATALOG_ENTRY_COUNT_MISMATCH",
      `entry_count ${expectedCount} does not match loaded rows ${rows.length}`,
    );
  }

  return rows;
}

/**
 * Load one immutable catalogue revision and build a synchronous Map resolver.
 *
 * authority: published only
 * reproduction: published or retired
 *
 * Always fetches the revision row first (fresh status). Entry material may be
 * served from the bounded LRU cache when checksum matches.
 */
export async function loadMeasuredBoqCatalogueSnapshot(input: {
  catalogRevision: string;
  purpose: CatalogueLoadPurpose;
  /** Optional client injection for tests. */
  client?: ServiceRoleClient;
  /** Override query timeout (ms). */
  queryTimeoutMs?: number;
}): Promise<LoadedCatalogueSnapshot> {
  const revisionId = input.catalogRevision;
  if (typeof revisionId !== "string" || revisionId.trim() === "") {
    throw new CatalogueLoadError("CATALOG_REVISION_NOT_FOUND", "catalogRevision is required");
  }

  if (revisionId === "latest" || revisionId === "current") {
    throw new CatalogueLoadError(
      "CATALOG_REVISION_NOT_FOUND",
      "latest/current catalogue aliases are forbidden",
    );
  }

  const supabase = input.client ?? (await getServiceClient());
  const timeoutMs = input.queryTimeoutMs ?? MEASURED_BOQ_CATALOGUE_QUERY_TIMEOUT_MS;
  const signal = AbortSignal.timeout(timeoutMs);

  let revision: {
    catalog_revision: string;
    status: string;
    schema_version: string;
    currency: string;
    vat_basis: string;
    regional_basis: string;
    source_description: string;
    entry_count: number;
    content_checksum: string;
    effective_from: string;
  } | null = null;

  try {
    const { data, error: revError } = await supabase
      .from("measured_boq_catalog_revisions")
      .select(
        "catalog_revision,status,schema_version,currency,vat_basis,regional_basis,source_description,entry_count,content_checksum,effective_from",
      )
      .eq("catalog_revision", revisionId)
      .abortSignal(signal)
      .maybeSingle();

    if (revError) {
      throw new CatalogueLoadError("CATALOG_LOAD_FAILED", revError.message);
    }
    revision = data;
  } catch (err) {
    throw wrapQueryError(err, "revision lookup failed");
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

  const key = cacheKey(revision.catalog_revision, revision.content_checksum);
  let material = getCache(key);

  if (!material) {
    const pageSignal = AbortSignal.timeout(timeoutMs);
    const rows = await loadAllEntryRows(supabase, revisionId, revision.entry_count, pageSignal);

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

    const map = new Map<string, Readonly<MeasuredBoqLibraryCatalogEntry>>();
    for (const entry of validated.snapshot.entries) {
      if (map.has(entry.rateKey)) {
        throw new CatalogueLoadError(
          "CATALOG_DUPLICATE_RATE_KEY",
          `duplicate rate_key ${entry.rateKey}`,
        );
      }
      map.set(entry.rateKey, toEngineEntry(revision.catalog_revision, entry));
    }

    material = {
      catalogRevision: revision.catalog_revision,
      contentChecksum: revision.content_checksum,
      entryCount: revision.entry_count,
      entriesByRateKey: map,
    };
    setCache(key, material);
  }

  const resolveLibraryRate = createMeasuredBoqLibraryResolverFromMap(
    material.catalogRevision,
    material.entriesByRateKey,
  );

  // Status always from fresh revision row, never from cache.
  return {
    catalogRevision: revision.catalog_revision,
    contentChecksum: revision.content_checksum,
    status: revision.status as "published" | "retired",
    entryCount: revision.entry_count,
    resolveLibraryRate,
  };
}
