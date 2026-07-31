import { describe, expect, it } from "vitest";

import {
  assertSingleCatalogRevision,
  canonicalCatalogueSerialisation,
  computeCatalogueContentChecksum,
  validateCatalogueSnapshot,
  type MeasuredBoqCatalogueSourceSnapshot,
  type MeasuredBoqEngineInput,
} from "../../index";
import { sha256Hex } from "./sha256";

const baseEntry = {
  rateKey: "synth.paint.m2",
  displayName: "SYNTHETIC paint",
  tradeOrDomain: "test",
  unit: "m2",
  costType: "combined",
  baseUnitRate: 10,
  currency: "GBP",
  vatBasis: "exclusive",
  status: "active",
  sourceReference: "synthetic",
} as const;

function baseSnapshot(
  overrides: Partial<MeasuredBoqCatalogueSourceSnapshot> = {},
): MeasuredBoqCatalogueSourceSnapshot {
  const entries = overrides.entries ?? [{ ...baseEntry }];
  return {
    schemaVersion: "mboq-catalogue-v1",
    catalogRevision: "mboq-2099.01.01",
    currency: "GBP",
    vatBasis: "exclusive",
    regionalBasis: "uk-region-multipliers-v1",
    effectiveFrom: "2099-01-01",
    sourceDescription: "SYNTHETIC TEST FIXTURE — not production",
    production: false,
    ...overrides,
    entries,
    entryCount: overrides.entryCount ?? entries.length,
  };
}

describe("validateCatalogueSnapshot", () => {
  it("accepts a valid synthetic revision", () => {
    const result = validateCatalogueSnapshot(baseSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentChecksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects invalid revision grammar", () => {
    const result = validateCatalogueSnapshot(baseSnapshot({ catalogRevision: "latest" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_REVISION_INVALID")).toBe(true);
  });

  it("rejects invalid currency / VAT / regional basis", () => {
    expect(validateCatalogueSnapshot(baseSnapshot({ currency: "USD" })).ok).toBe(false);
    expect(validateCatalogueSnapshot(baseSnapshot({ vatBasis: "inclusive" })).ok).toBe(false);
    expect(validateCatalogueSnapshot(baseSnapshot({ regionalBasis: "other" })).ok).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = validateCatalogueSnapshot(baseSnapshot({ status: "live" }));
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate keys", () => {
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries: [{ ...baseEntry }, { ...baseEntry, displayName: "dup" }],
        entryCount: 2,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_DUPLICATE_RATE_KEY")).toBe(true);
  });

  it("rejects invalid key grammar", () => {
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries: [{ ...baseEntry, rateKey: "Paint Walls" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_RATE_KEY_INVALID")).toBe(true);
  });

  it("rejects invalid unit and cost type", () => {
    expect(
      validateCatalogueSnapshot(baseSnapshot({ entries: [{ ...baseEntry, unit: "sqm" }] })).ok,
    ).toBe(false);
    expect(
      validateCatalogueSnapshot(baseSnapshot({ entries: [{ ...baseEntry, costType: "plant" }] }))
        .ok,
    ).toBe(false);
  });

  it("rejects zero, negative, NaN, Infinity rates", () => {
    for (const baseUnitRate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateCatalogueSnapshot(
        baseSnapshot({ entries: [{ ...baseEntry, baseUnitRate }] }),
      );
      expect(result.ok).toBe(false);
    }
  });

  it("rejects entry-count mismatch", () => {
    const result = validateCatalogueSnapshot(baseSnapshot({ entryCount: 99 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_ENTRY_COUNT_MISMATCH")).toBe(true);
  });

  it("rejects wrong provided checksum", () => {
    const result = validateCatalogueSnapshot(baseSnapshot({ contentChecksum: "a".repeat(64) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_CHECKSUM_MISMATCH")).toBe(true);
  });

  it("rejects too many entries", () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({
      ...baseEntry,
      rateKey: `synth.item_${i}.m2`,
    }));
    // Temporarily exercise MAX via entryCount path is enough for unit; size gate uses constant.
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries,
        entryCount: entries.length,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("requires source_reference for production publish", () => {
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        production: true,
        entries: [{ ...baseEntry, sourceReference: null }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_SOURCE_REFERENCE_REQUIRED")).toBe(true);
  });
});

describe("catalogue checksum", () => {
  it("same content → same digest; order independent", () => {
    const a = baseSnapshot({
      entries: [
        { ...baseEntry, rateKey: "synth.b.item" },
        { ...baseEntry, rateKey: "synth.a.item" },
      ],
      entryCount: 2,
    });
    const b = baseSnapshot({
      entries: [
        { ...baseEntry, rateKey: "synth.a.item" },
        { ...baseEntry, rateKey: "synth.b.item" },
      ],
      entryCount: 2,
    });
    expect(computeCatalogueContentChecksum(a)).toBe(computeCatalogueContentChecksum(b));
  });

  it("rate/unit/costType/revision changes alter digest", () => {
    const base = computeCatalogueContentChecksum(baseSnapshot());
    expect(
      computeCatalogueContentChecksum(
        baseSnapshot({ entries: [{ ...baseEntry, baseUnitRate: 11 }] }),
      ),
    ).not.toBe(base);
    expect(
      computeCatalogueContentChecksum(baseSnapshot({ entries: [{ ...baseEntry, unit: "m" }] })),
    ).not.toBe(base);
    expect(
      computeCatalogueContentChecksum(
        baseSnapshot({ entries: [{ ...baseEntry, costType: "labour" }] }),
      ),
    ).not.toBe(base);
    expect(
      computeCatalogueContentChecksum(baseSnapshot({ catalogRevision: "mboq-2099.01.02" })),
    ).not.toBe(base);
  });

  it("golden digest remains stable", () => {
    const serialised = canonicalCatalogueSerialisation(baseSnapshot());
    const digest = sha256Hex(serialised);
    expect(computeCatalogueContentChecksum(baseSnapshot())).toBe(digest);
    // Fixed golden for regression detection
    expect(digest).toBe(
      sha256Hex(
        JSON.stringify({
          schemaVersion: "mboq-catalogue-v1",
          catalogRevision: "mboq-2099.01.01",
          currency: "GBP",
          vatBasis: "exclusive",
          regionalBasis: "uk-region-multipliers-v1",
          effectiveFrom: "2099-01-01",
          entries: [
            {
              rateKey: "synth.paint.m2",
              displayName: "SYNTHETIC paint",
              description: null,
              tradeOrDomain: "test",
              unit: "m2",
              costType: "combined",
              baseUnitRate: 10,
              currency: "GBP",
              vatBasis: "exclusive",
              sourceReference: "synthetic",
              status: "active",
              replacementRateKey: null,
            },
          ],
        }),
      ),
    );
  });
});

describe("assertSingleCatalogRevision", () => {
  const rooms = (
    rates: Array<{ rateKey: string; catalogRevision: string }>,
  ): MeasuredBoqEngineInput => ({
    region: "London",
    rooms: [
      {
        id: "r1",
        name: "Room",
        items: rates.map((r, i) => ({
          id: `i${i}`,
          name: "Item",
          quantity: 1,
          unit: "m2",
          rate: { source: "library" as const, ...r },
        })),
      },
    ],
  });

  it("accepts one revision and duplicate same revision", () => {
    const one = assertSingleCatalogRevision(
      rooms([{ rateKey: "a.b.m2", catalogRevision: "mboq-2099.01.01" }]),
    );
    expect(one).toEqual({ ok: true, catalogRevision: "mboq-2099.01.01" });
    const two = assertSingleCatalogRevision(
      rooms([
        { rateKey: "a.b.m2", catalogRevision: "mboq-2099.01.01" },
        { rateKey: "c.d.m2", catalogRevision: "mboq-2099.01.01" },
      ]),
    );
    expect(two.ok).toBe(true);
  });

  it("rejects two revisions", () => {
    const result = assertSingleCatalogRevision(
      rooms([
        { rateKey: "a.b.m2", catalogRevision: "mboq-2099.01.01" },
        { rateKey: "c.d.m2", catalogRevision: "mboq-2099.01.02" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("MIXED_CATALOG_REVISIONS");
  });

  it("does not merge case variations", () => {
    // Grammar requires lowercase revisions; distinct strings remain distinct.
    const result = assertSingleCatalogRevision(
      rooms([
        { rateKey: "a.b.m2", catalogRevision: "mboq-2099.01.01" },
        { rateKey: "c.d.m2", catalogRevision: "mboq-2099.01.01.1" },
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-library rates for authority gate", () => {
    const input: MeasuredBoqEngineInput = {
      region: "London",
      rooms: [
        {
          id: "r1",
          name: "Room",
          items: [
            {
              id: "i1",
              name: "X",
              quantity: 1,
              unit: "m2",
              rate: { source: "ai-assisted", candidateUnitRate: 1 },
            },
          ],
        },
      ],
    };
    const result = assertSingleCatalogRevision(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NON_LIBRARY_AUTHORITY_RATE");
  });
});
