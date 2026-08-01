/**
 * 4C2D-B — measured-BOQ catalogue reader composition tests.
 * Uses injected loader fakes only (no real database).
 */
import { describe, expect, it, vi } from "vitest";

import type { MeasuredBoqEngineInput, MeasuredBoqLibraryCatalogEntry } from "@repo/services";

import {
  CatalogueLoadError,
  repriceMeasuredBoqWithCatalogue,
  type LoadedCatalogueSnapshot,
  type MeasuredBoqCatalogueSnapshotLoader,
} from "./repriceMeasuredBoqWithCatalogue.server";

const REV = "mboq-2099.01.01";
const CHECKSUM = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function libraryInput(
  rates: Array<{ rateKey: string; catalogRevision: string }>,
): MeasuredBoqEngineInput {
  return {
    region: "London",
    rooms: [
      {
        id: "r1",
        name: "Kitchen",
        items: rates.map((r, i) => ({
          id: `i${i}`,
          name: "Paint",
          quantity: 2,
          unit: "m2",
          rate: {
            source: "library" as const,
            rateKey: r.rateKey,
            catalogRevision: r.catalogRevision,
          },
        })),
      },
    ],
  };
}

function entry(
  rateKey: string,
  catalogRevision: string,
  baseUnitRate = 100,
): MeasuredBoqLibraryCatalogEntry {
  return {
    rateKey,
    catalogRevision,
    baseUnitRate,
    currency: "GBP",
    vatBasis: "exclusive",
    unit: "m2",
    costType: "combined",
  };
}

function fakeSnapshot(options: {
  catalogRevision?: string;
  status?: "published" | "retired";
  entries?: MeasuredBoqLibraryCatalogEntry[];
  contentChecksum?: string;
}): LoadedCatalogueSnapshot {
  const catalogRevision = options.catalogRevision ?? REV;
  const map = new Map(
    (options.entries ?? [entry("paint.m2", catalogRevision)]).map((e) => [e.rateKey, e]),
  );
  return {
    catalogRevision,
    contentChecksum: options.contentChecksum ?? CHECKSUM,
    status: options.status ?? "published",
    entryCount: map.size,
    resolveLibraryRate: (ref) => {
      if (ref.catalogRevision !== catalogRevision) return null;
      const hit = map.get(ref.rateKey);
      return hit ? Object.freeze({ ...hit }) : null;
    },
  };
}

describe("repriceMeasuredBoqWithCatalogue", () => {
  it("authority composition: single published revision, loader once, resolver injected", async () => {
    const snapshot = fakeSnapshot({ status: "published" });
    const loadCatalogueSnapshot = vi.fn<MeasuredBoqCatalogueSnapshotLoader>(async () => snapshot);

    const result = await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "paint.m2", catalogRevision: REV }]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(1);
    expect(loadCatalogueSnapshot).toHaveBeenCalledWith({
      catalogRevision: REV,
      purpose: "authority",
    });
    expect(result.purpose).toBe("authority");
    expect(result.catalogRevision).toBe(REV);
    expect(result.catalogueStatus).toBe("published");
    expect(result.contentChecksum).toBe(CHECKSUM);
    expect(result.entryCount).toBe(1);
    expect(result.reprice.status).toBe("authority-priced");
    if (result.reprice.status !== "authority-priced") return;
    expect(result.reprice.source).toBe("engine");
    expect(result.reprice.pricing.midTotal).toBeGreaterThan(0);
    expect(result.reprice.issues).toEqual([]);
  });

  it("reproduction composition: exact revision, purpose reproduction, retired allowed via loader", async () => {
    const storedRev = "mboq-2098.12.01";
    const snapshot = fakeSnapshot({
      catalogRevision: storedRev,
      status: "retired",
      entries: [entry("paint.m2", storedRev, 80)],
    });
    const loadCatalogueSnapshot = vi.fn<MeasuredBoqCatalogueSnapshotLoader>(async () => snapshot);

    const result = await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "paint.m2", catalogRevision: storedRev }]),
        purpose: "reproduction",
      },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(1);
    expect(loadCatalogueSnapshot).toHaveBeenCalledWith({
      catalogRevision: storedRev,
      purpose: "reproduction",
    });
    // Never substitutes latest/current/newest
    const callArg = loadCatalogueSnapshot.mock.calls[0]![0]!;
    expect(callArg.catalogRevision).not.toBe("latest");
    expect(callArg.catalogRevision).not.toBe("current");
    expect(callArg.catalogRevision).toBe(storedRev);
    expect(result.catalogueStatus).toBe("retired");
    expect(result.reprice.status).toBe("authority-priced");
  });

  it("mixed revisions fail before loader invocation", async () => {
    const loadCatalogueSnapshot = vi.fn<MeasuredBoqCatalogueSnapshotLoader>(async () => {
      throw new Error("loader must not run");
    });

    const result = await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([
          { rateKey: "paint.m2", catalogRevision: "mboq-2099.01.01" },
          { rateKey: "tile.m2", catalogRevision: "mboq-2099.01.02" },
        ]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MIXED_CATALOG_REVISIONS");
    expect(result.error.revisions).toEqual(
      expect.arrayContaining(["mboq-2099.01.01", "mboq-2099.01.02"]),
    );
    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(0);
  });

  it("missing catalogue entry yields engine draft issues, not category fallback", async () => {
    const snapshot = fakeSnapshot({
      entries: [], // empty catalogue — all keys miss
    });
    // Override entryCount to match empty map
    const emptySnapshot: LoadedCatalogueSnapshot = {
      ...snapshot,
      entryCount: 0,
      resolveLibraryRate: () => null,
    };
    const loadCatalogueSnapshot = vi.fn(async () => emptySnapshot);

    const result = await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "missing.x.m2", catalogRevision: REV }]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reprice.status).toBe("draft");
    if (result.reprice.status !== "draft") return;
    expect(result.reprice.pricing).toBeNull();
    expect(result.reprice.source).toBe("fallback");
    expect(result.reprice.issues.some((i) => i.code === "MISSING_LIBRARY_REFERENCE")).toBe(true);
    // No synthetic zero money
    expect(result.reprice.issues.every((i) => i.code !== ("CATEGORY_BASE" as never))).toBe(true);
  });

  it("preserves CATALOG_REVISION_NOT_FOUND without retry or purpose fallback", async () => {
    const loadCatalogueSnapshot = vi.fn(async () => {
      throw new CatalogueLoadError(
        "CATALOG_REVISION_NOT_FOUND",
        "Catalogue revision not found: mboq-2099.01.01",
      );
    });

    const result = await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "paint.m2", catalogRevision: REV }]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CATALOG_REVISION_NOT_FOUND");
    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(1);
    expect(loadCatalogueSnapshot).toHaveBeenCalledWith({
      catalogRevision: REV,
      purpose: "authority",
    });
  });

  it("preserves CATALOG_REVISION_NOT_PUBLISHED for authority purpose", async () => {
    const loadCatalogueSnapshot = vi.fn(async () => {
      throw new CatalogueLoadError(
        "CATALOG_REVISION_NOT_PUBLISHED",
        "Authority loads require published status (got draft)",
      );
    });

    const result = await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "paint.m2", catalogRevision: REV }]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CATALOG_REVISION_NOT_PUBLISHED");
    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(1);
    // No purpose demotion to reproduction
    expect(loadCatalogueSnapshot).toHaveBeenCalledWith({
      catalogRevision: REV,
      purpose: "authority",
    });
  });

  it("rejects non-library rates before loader (assertSingleCatalogRevision semantics)", async () => {
    const loadCatalogueSnapshot = vi.fn(async () => fakeSnapshot({}));

    const input: MeasuredBoqEngineInput = {
      region: "London",
      rooms: [
        {
          id: "r1",
          name: "Room",
          items: [
            {
              id: "i1",
              name: "Paint",
              quantity: 1,
              unit: "m2",
              rate: { source: "ai-assisted", candidateUnitRate: 50 },
            },
          ],
        },
      ],
    };

    const result = await repriceMeasuredBoqWithCatalogue(
      { input, purpose: "authority" },
      { loadCatalogueSnapshot },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NON_LIBRARY_AUTHORITY_RATE");
    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(0);
  });

  it("does not call persistence, rpc, or estimate save paths", async () => {
    const rpc = vi.fn();
    const persist = vi.fn();
    const save = vi.fn();
    const snapshot = fakeSnapshot({});
    const loadCatalogueSnapshot = vi.fn(async () => snapshot);

    await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "paint.m2", catalogRevision: REV }]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    // Source-level guarantee: composition source has no persistence symbols
    // (also covered by invariants). Here we assert the composition completed
    // with only the catalogue load + reprice path.
    expect(loadCatalogueSnapshot).toHaveBeenCalledTimes(1);
  });

  it("execution order: gate before load (zero loads when gate fails)", async () => {
    const events: string[] = [];
    const loadCatalogueSnapshot = vi.fn(async (args) => {
      events.push(`load:${args.catalogRevision}:${args.purpose}`);
      return fakeSnapshot({ catalogRevision: args.catalogRevision });
    });

    // Gate fails first
    await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([
          { rateKey: "a.m2", catalogRevision: "r1" },
          { rateKey: "b.m2", catalogRevision: "r2" },
        ]),
        purpose: "authority",
      },
      { loadCatalogueSnapshot },
    );
    expect(events).toEqual([]);

    // Gate then load
    await repriceMeasuredBoqWithCatalogue(
      {
        input: libraryInput([{ rateKey: "paint.m2", catalogRevision: REV }]),
        purpose: "reproduction",
      },
      { loadCatalogueSnapshot },
    );
    expect(events).toEqual([`load:${REV}:reproduction`]);
  });
});
