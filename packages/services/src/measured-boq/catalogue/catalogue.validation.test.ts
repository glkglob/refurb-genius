import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  assertSingleCatalogRevision,
  computeCatalogueContentChecksum,
  MAX_CATALOG_ENTRIES,
  sha256Hex,
  utf8BytesFallback,
  validateCatalogueSnapshot,
  writeSha256BitLength,
  type MeasuredBoqCatalogueSourceSnapshot,
  type MeasuredBoqEngineInput,
} from "../../index";

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

/** Independently computed via Node crypto — not sha256Hex under test. */
const BASE_FIXTURE_GOLDEN_DIGEST =
  "d8b22ebc44e460b0f8c0dd9e0d202569e16809bec921278b6880b14aa5db8928";

const PUBLISHED_SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function baseSnapshot(
  overrides: Partial<MeasuredBoqCatalogueSourceSnapshot> = {},
): MeasuredBoqCatalogueSourceSnapshot {
  const entries = (overrides.entries as (typeof baseEntry)[] | undefined) ?? [{ ...baseEntry }];
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

function nodeSha256Hex(message: string): string {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

describe("validateCatalogueSnapshot", () => {
  it("accepts a valid synthetic revision", () => {
    const result = validateCatalogueSnapshot(baseSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.snapshot.entries[0]!.unit).toBe("m2");
    expect(result.snapshot.entries[0]!.costType).toBe("combined");
    expect(result.snapshot.currency).toBe("GBP");
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

  it("rejects more than MAX_CATALOG_ENTRIES with CATALOG_TOO_LARGE", () => {
    const entries = Array.from({ length: MAX_CATALOG_ENTRIES + 1 }, (_, i) => ({
      ...baseEntry,
      rateKey: `synth.item_${i}.m2`,
    }));
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries,
        entryCount: entries.length,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_TOO_LARGE")).toBe(true);
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

  it("rejects oversized replacementRateKey", () => {
    const longKey = `synth.${"a".repeat(200)}.m2`;
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries: [
          {
            ...baseEntry,
            status: "deprecated",
            replacementRateKey: longKey,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some(
        (i) =>
          i.code === "CATALOG_REPLACEMENT_KEY_INVALID" || i.code === "CATALOG_RATE_KEY_INVALID",
      ),
    ).toBe(true);
  });

  it("rejects replacementRateKey on active entries", () => {
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries: [
          {
            ...baseEntry,
            status: "active",
            replacementRateKey: "synth.other.m2",
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "CATALOG_REPLACEMENT_KEY_INVALID")).toBe(true);
  });

  it("returns structured issues for malformed entry elements", () => {
    for (const bad of [null, undefined, "x", 12, [1], 0]) {
      const result = validateCatalogueSnapshot(
        baseSnapshot({
          entries: [bad as never],
          entryCount: 1,
        }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.some((i) => i.code === "CATALOG_ENTRY_INVALID")).toBe(true);
      expect(result.issues.some((i) => i.path === "entries[0]")).toBe(true);
    }
  });

  it("returns structured issues for object missing required fields", () => {
    const result = validateCatalogueSnapshot(
      baseSnapshot({
        entries: [{ rateKey: "synth.only.m2" } as never],
        entryCount: 1,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
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
    expect(computeCatalogueContentChecksum(a as never)).toBe(
      computeCatalogueContentChecksum(b as never),
    );
  });

  it("rate/unit/costType/revision changes alter digest", () => {
    const base = computeCatalogueContentChecksum(baseSnapshot() as never);
    expect(
      computeCatalogueContentChecksum(
        baseSnapshot({ entries: [{ ...baseEntry, baseUnitRate: 11 }] }) as never,
      ),
    ).not.toBe(base);
    expect(
      computeCatalogueContentChecksum(
        baseSnapshot({ entries: [{ ...baseEntry, unit: "m" }] }) as never,
      ),
    ).not.toBe(base);
    expect(
      computeCatalogueContentChecksum(
        baseSnapshot({ entries: [{ ...baseEntry, costType: "labour" }] }) as never,
      ),
    ).not.toBe(base);
    expect(
      computeCatalogueContentChecksum(
        baseSnapshot({ catalogRevision: "mboq-2099.01.02" }) as never,
      ),
    ).not.toBe(base);
  });

  it("pins independent Node-crypto golden digest for base fixture", () => {
    // Independent oracle (Node crypto), not sha256Hex under test.
    const serialised = JSON.stringify({
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
    });
    expect(nodeSha256Hex(serialised)).toBe(BASE_FIXTURE_GOLDEN_DIGEST);
    expect(computeCatalogueContentChecksum(baseSnapshot() as never)).toBe(
      BASE_FIXTURE_GOLDEN_DIGEST,
    );
  });

  it("matches published SHA-256 vector for abc", () => {
    expect(sha256Hex("abc")).toBe(PUBLISHED_SHA256_ABC);
    expect(nodeSha256Hex("abc")).toBe(PUBLISHED_SHA256_ABC);
  });
});

describe("sha256 length and surrogate encoding", () => {
  it("writes high and low 32-bit length words big-endian", () => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    // 0x1_0000_0000 bits → high=1, low=0
    writeSha256BitLength(view, 0, 0x1_0000_0000);
    expect(view.getUint32(0, false)).toBe(1);
    expect(view.getUint32(4, false)).toBe(0);
  });

  it("fallback encodes unpaired surrogates as U+FFFD", () => {
    const unpairedHigh = utf8BytesFallback("\uD800");
    expect(Array.from(unpairedHigh)).toEqual([0xef, 0xbf, 0xbd]);
    const unpairedLow = utf8BytesFallback("\uDC00");
    expect(Array.from(unpairedLow)).toEqual([0xef, 0xbf, 0xbd]);
    // High + ordinary text must not consume the ordinary text as low surrogate
    const highThenA = utf8BytesFallback("\uD800A");
    expect(Array.from(highThenA)).toEqual([0xef, 0xbf, 0xbd, 0x41]);
    // Valid pair still works (U+1F600)
    const pair = utf8BytesFallback("\uD83D\uDE00");
    expect(pair.length).toBe(4);
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

  it("does not merge case variations of the same revision string", () => {
    const result = assertSingleCatalogRevision(
      rooms([
        { rateKey: "a.b.m2", catalogRevision: "mboq-2099.01.01" },
        { rateKey: "c.d.m2", catalogRevision: "MBOQ-2099.01.01" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("MIXED_CATALOG_REVISIONS");
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
