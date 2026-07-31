import { afterEach, describe, expect, it } from "vitest";

import {
  __measuredBoqCatalogueCacheSizeForTests,
  __resetMeasuredBoqCatalogueCacheForTests,
  __seedMeasuredBoqCatalogueCacheForTests,
  CatalogueLoadError,
  createMeasuredBoqLibraryResolverFromMap,
  loadMeasuredBoqCatalogueSnapshot,
  MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES,
  MEASURED_BOQ_CATALOGUE_ENTRY_PAGE_SIZE,
} from "./measuredBoqCatalogue.repository.server";

const REV = "mboq-2099.01.01";
const CHECKSUM = "d8b22ebc44e460b0f8c0dd9e0d202569e16809bec921278b6880b14aa5db8928";

function revisionRow(
  status: "published" | "retired" | "draft",
  entryCount = 1,
  catalogRevision = REV,
  contentChecksum = CHECKSUM,
) {
  return {
    catalog_revision: catalogRevision,
    status,
    schema_version: "mboq-catalogue-v1",
    currency: "GBP",
    vat_basis: "exclusive",
    regional_basis: "uk-region-multipliers-v1",
    source_description: "SYNTHETIC TEST FIXTURE — not production",
    entry_count: entryCount,
    content_checksum: contentChecksum,
    effective_from: "2099-01-01",
  };
}

function entryRow(rateKey = "synth.paint.m2") {
  return {
    rate_key: rateKey,
    display_name: "SYNTHETIC paint",
    description: null,
    trade_or_domain: "test",
    unit: "m2",
    cost_type: "combined",
    base_unit_rate: 10,
    currency: "GBP",
    vat_basis: "exclusive",
    source_reference: "synthetic",
    status: "active",
    replacement_rate_key: null,
  };
}

function createMockClient(options: {
  status?: "published" | "retired" | "draft" | (() => "published" | "retired" | "draft");
  entryCount?: number;
  entries?: ReturnType<typeof entryRow>[];
  catalogRevision?: string;
  contentChecksum?: string;
  revisionError?: { message: string };
  entriesError?: { message: string };
  abortRevision?: boolean;
  abortEntries?: boolean;
}): {
  from: (table: string) => unknown;
} {
  const entries = options.entries ?? [entryRow()];
  const entryCount = options.entryCount ?? entries.length;
  const catalogRevision = options.catalogRevision ?? REV;
  const contentChecksum = options.contentChecksum ?? CHECKSUM;

  const currentStatus = () =>
    typeof options.status === "function" ? options.status() : (options.status ?? "published");

  return {
    from(table: string) {
      if (table === "measured_boq_catalog_revisions") {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.abortSignal = () => chain;
        chain.maybeSingle = async () => {
          if (options.abortRevision) {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            throw err;
          }
          if (options.revisionError) {
            return { data: null, error: options.revisionError };
          }
          return {
            data: revisionRow(currentStatus(), entryCount, catalogRevision, contentChecksum),
            error: null,
          };
        };
        return chain;
      }

      if (table === "measured_boq_catalog_entries") {
        const chain: Record<string, unknown> = {};
        let rangeFrom = 0;
        let rangeTo = MEASURED_BOQ_CATALOGUE_ENTRY_PAGE_SIZE - 1;
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.order = () => chain;
        chain.range = (from: number, to: number) => {
          rangeFrom = from;
          rangeTo = to;
          return chain;
        };
        chain.abortSignal = () => chain;
        chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          const run = async () => {
            if (options.abortEntries) {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              throw err;
            }
            if (options.entriesError) {
              return { data: null, error: options.entriesError };
            }
            const page = entries.slice(rangeFrom, rangeTo + 1);
            return { data: page, error: null };
          };
          return run().then(resolve, reject);
        };
        return chain;
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
}

afterEach(() => {
  __resetMeasuredBoqCatalogueCacheForTests();
});

describe("loadMeasuredBoqCatalogueSnapshot", () => {
  it("loads published revision and resolves exact key", async () => {
    const client = createMockClient({}) as never;
    const loaded = await loadMeasuredBoqCatalogueSnapshot({
      catalogRevision: REV,
      purpose: "authority",
      client,
    });
    expect(loaded.status).toBe("published");
    expect(loaded.entryCount).toBe(1);
    expect(loaded.resolveLibraryRate({ rateKey: "synth.paint.m2", catalogRevision: REV })).toEqual(
      expect.objectContaining({ rateKey: "synth.paint.m2", baseUnitRate: 10 }),
    );
    expect(loaded.resolveLibraryRate({ rateKey: "missing.x.m2", catalogRevision: REV })).toBeNull();
  });

  it("does not expose a mutable entries map and freezes resolved entries", async () => {
    const client = createMockClient({}) as never;
    const loaded = await loadMeasuredBoqCatalogueSnapshot({
      catalogRevision: REV,
      purpose: "authority",
      client,
    });
    expect("entriesByRateKey" in loaded).toBe(false);
    const a = loaded.resolveLibraryRate({ rateKey: "synth.paint.m2", catalogRevision: REV })!;
    const b = loaded.resolveLibraryRate({ rateKey: "synth.paint.m2", catalogRevision: REV })!;
    expect(a).not.toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(() => {
      (a as { baseUnitRate: number }).baseUnitRate = 999;
    }).toThrow();
    const again = loaded.resolveLibraryRate({ rateKey: "synth.paint.m2", catalogRevision: REV })!;
    expect(again.baseUnitRate).toBe(10);
  });

  it("returns fresh retired status on cache hit and rejects authority load", async () => {
    let status: "published" | "retired" = "published";
    const client = createMockClient({
      status: () => status,
    }) as never;

    const first = await loadMeasuredBoqCatalogueSnapshot({
      catalogRevision: REV,
      purpose: "authority",
      client,
    });
    expect(first.status).toBe("published");
    expect(__measuredBoqCatalogueCacheSizeForTests()).toBe(1);

    status = "retired";
    const repro = await loadMeasuredBoqCatalogueSnapshot({
      catalogRevision: REV,
      purpose: "reproduction",
      client,
    });
    expect(repro.status).toBe("retired");
    // still one cache entry of immutable material
    expect(__measuredBoqCatalogueCacheSizeForTests()).toBe(1);

    await expect(
      loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: REV,
        purpose: "authority",
        client,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_REVISION_NOT_PUBLISHED" });
  });

  it("bounds cache size with deterministic LRU eviction of oldest keys", () => {
    expect(MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES).toBe(8);
    const keys = Array.from(
      { length: MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES + 3 },
      (_, i) => `seed-rev-${i}`,
    );
    __seedMeasuredBoqCatalogueCacheForTests(keys);
    expect(__measuredBoqCatalogueCacheSizeForTests()).toBe(
      MEASURED_BOQ_CATALOGUE_CACHE_MAX_ENTRIES,
    );
  });

  it("detects empty mid-pagination as CATALOG_ENTRY_PAGE_INCOMPLETE", async () => {
    const fullPage = Array.from({ length: MEASURED_BOQ_CATALOGUE_ENTRY_PAGE_SIZE }, (_, i) =>
      entryRow(`synth.page_${String(i).padStart(4, "0")}.m2`),
    );
    const client = createMockClient({
      entryCount: MEASURED_BOQ_CATALOGUE_ENTRY_PAGE_SIZE + 10,
      entries: fullPage, // second page empty → incomplete
    }) as never;

    await expect(
      loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: REV,
        purpose: "authority",
        client,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_ENTRY_PAGE_INCOMPLETE" });
  });

  it("translates revision abort into CATALOG_LOAD_TIMEOUT", async () => {
    const client = createMockClient({ abortRevision: true }) as never;
    await expect(
      loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: REV,
        purpose: "authority",
        client,
        queryTimeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_LOAD_TIMEOUT" });
  });

  it("translates entry page abort into CATALOG_LOAD_TIMEOUT", async () => {
    const client = createMockClient({ abortEntries: true }) as never;
    await expect(
      loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: REV,
        purpose: "authority",
        client,
        queryTimeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_LOAD_TIMEOUT" });
  });

  it("shared resolver factory is exact-key only", () => {
    const map = new Map([
      [
        "synth.paint.m2",
        Object.freeze({
          rateKey: "synth.paint.m2",
          catalogRevision: REV,
          baseUnitRate: 10,
          currency: "GBP" as const,
          vatBasis: "exclusive" as const,
          unit: "m2",
          costType: "combined" as const,
        }),
      ],
    ]);
    const resolve = createMeasuredBoqLibraryResolverFromMap(REV, map);
    expect(resolve({ rateKey: "synth.paint.m2", catalogRevision: REV })?.baseUnitRate).toBe(10);
    expect(resolve({ rateKey: "SYNTH.PAINT.M2", catalogRevision: REV })).toBeNull();
    expect(resolve({ rateKey: "synth.paint.m2", catalogRevision: "mboq-2099.01.02" })).toBeNull();
  });

  it("rejects unknown errors as CatalogueLoadError", async () => {
    const client = createMockClient({
      revisionError: { message: "boom" },
    }) as never;
    await expect(
      loadMeasuredBoqCatalogueSnapshot({
        catalogRevision: REV,
        purpose: "authority",
        client,
      }),
    ).rejects.toBeInstanceOf(CatalogueLoadError);
  });
});
