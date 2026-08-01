import { describe, expect, it } from "vitest";

import {
  assessMeasuredBoqAuthority,
  isValidIsoDateOnly,
  isValidIsoDateTime,
  MEASURED_BOQ_POLICY_VERSION,
  resolveMeasuredBoqRate,
  roundMeasuredBoqMoney,
  runMeasuredBoqEngine,
  type MeasuredBoqEngineDependencies,
  type MeasuredBoqEngineInput,
  type MeasuredBoqLibraryCatalogEntry,
  type MeasuredBoqLibraryRate,
  type MeasuredBoqUserQuoteRate,
} from "./measuredBoqEngine";

/** Composite key for test catalogue lookups. */
function catalogKey(rateKey: string, catalogRevision: string): string {
  return `${catalogRevision}::${rateKey}`;
}

const TEST_CATALOGUE = new Map<string, MeasuredBoqLibraryCatalogEntry>([
  [
    catalogKey("paint.m2", "2026.07"),
    {
      rateKey: "paint.m2",
      catalogRevision: "2026.07",
      baseUnitRate: 100,
      currency: "GBP",
      vatBasis: "exclusive",
      unit: "m2",
      costType: "combined",
    },
  ],
  [
    catalogKey("tile.m2", "2026.07"),
    {
      rateKey: "tile.m2",
      catalogRevision: "2026.07",
      baseUnitRate: 40,
      currency: "GBP",
      vatBasis: "exclusive",
      unit: "m2",
      costType: "materials",
    },
  ],
  [
    catalogKey("pence.item", "2026.07"),
    {
      rateKey: "pence.item",
      catalogRevision: "2026.07",
      baseUnitRate: 33.333,
      currency: "GBP",
      vatBasis: "exclusive",
      unit: "item",
      costType: "combined",
    },
  ],
]);

const trustedDeps: MeasuredBoqEngineDependencies = {
  resolveLibraryRate: (ref) =>
    TEST_CATALOGUE.get(catalogKey(ref.rateKey, ref.catalogRevision)) ?? null,
};

const libraryRef = (rateKey: string, catalogRevision = "2026.07"): MeasuredBoqLibraryRate => ({
  source: "library",
  rateKey,
  catalogRevision,
});

// Compile-time: library line input has no money fields.
const _compileTimeLibraryRate: MeasuredBoqLibraryRate = {
  source: "library",
  rateKey: "paint.m2",
  catalogRevision: "2026.07",
};
void _compileTimeLibraryRate;

const acceptedQuote = (
  netUnitRate: number,
  overrides: Partial<MeasuredBoqUserQuoteRate> = {},
): MeasuredBoqUserQuoteRate => ({
  source: "user-quote",
  netUnitRate,
  currency: "GBP",
  vatBasis: "exclusive",
  quote: {
    supplierName: "Acme Supplies",
    quoteReference: "Q-100",
    issuedAt: "2026-07-01",
    evidenceRef: "ev-1",
    acceptedByUserId: "user-1",
    acceptedAt: "2026-07-15T10:00:00.000Z",
  },
  ...overrides,
});

function singleLineInput(
  region: MeasuredBoqEngineInput["region"],
  rate: MeasuredBoqEngineInput["rooms"][0]["items"][0]["rate"],
  quantity = 1,
): MeasuredBoqEngineInput {
  return {
    region,
    rooms: [
      {
        id: "r1",
        name: "Kitchen",
        items: [
          {
            id: "i1",
            name: "Paint walls",
            quantity,
            unit: "m2",
            rate,
          },
        ],
      },
    ],
  };
}

describe("roundMeasuredBoqMoney", () => {
  it("rounds to two decimal places deterministically", () => {
    expect(roundMeasuredBoqMoney(1.005)).toBe(1.01);
    expect(roundMeasuredBoqMoney(12.994)).toBe(12.99);
  });
});

describe("golden vectors", () => {
  it("Vector A — London library rate from trusted catalogue", () => {
    const outcome = runMeasuredBoqEngine(
      singleLineInput("London", libraryRef("paint.m2"), 2),
      trustedDeps,
    );
    expect(outcome.status).toBe("authority-priced");
    if (outcome.status !== "authority-priced") return;
    const line = outcome.pricing.rooms[0]!.items[0]!;
    expect(line.unitRate).toBe(130);
    expect(line.totalCost).toBe(260);
    expect(outcome.pricing.subtotal).toBe(260);
    expect(outcome.pricing.contingency).toBe(26);
    expect(outcome.pricing.vat).toBe(57.2);
    expect(outcome.pricing.midTotal).toBe(343.2);
    expect(outcome.pricing.lowTotal).toBe(291.72);
    expect(outcome.pricing.highTotal).toBe(394.68);
    expect(outcome.pricing.policyVersion).toBe(MEASURED_BOQ_POLICY_VERSION);
  });

  it("Vector B — mixed library and accepted quote (West Midlands)", () => {
    const input: MeasuredBoqEngineInput = {
      region: "West Midlands",
      rooms: [
        {
          id: "r1",
          name: "Bathroom",
          items: [
            {
              id: "i1",
              name: "Tile",
              quantity: 3,
              unit: "m2",
              costType: "materials",
              rate: libraryRef("tile.m2"),
            },
            {
              id: "i2",
              name: "Special fitting",
              quantity: 2,
              unit: "item",
              costType: "labour",
              rate: acceptedQuote(75.5),
            },
          ],
        },
      ],
    };
    const outcome = runMeasuredBoqEngine(input, trustedDeps);
    expect(outcome.status).toBe("authority-priced");
    if (outcome.status !== "authority-priced") return;
    expect(outcome.pricing.rooms[0]!.items[0]!.totalCost).toBe(120);
    expect(outcome.pricing.rooms[0]!.items[1]!.totalCost).toBe(151);
    expect(outcome.pricing.subtotal).toBe(271);
    expect(outcome.pricing.contingency).toBe(27.1);
    expect(outcome.pricing.vat).toBe(59.62);
    expect(outcome.pricing.midTotal).toBe(357.72);
    expect(outcome.pricing.lowTotal).toBe(304.06);
    expect(outcome.pricing.highTotal).toBe(411.38);
  });

  it("Vector C — pence rounding order", () => {
    const outcome = runMeasuredBoqEngine(
      {
        region: "London",
        rooms: [
          {
            id: "r1",
            name: "Kitchen",
            items: [
              {
                id: "i1",
                name: "Pence item",
                quantity: 3,
                unit: "item",
                rate: libraryRef("pence.item"),
              },
            ],
          },
        ],
      },
      trustedDeps,
    );
    expect(outcome.status).toBe("authority-priced");
    if (outcome.status !== "authority-priced") return;
    const line = outcome.pricing.rooms[0]!.items[0]!;
    expect(line.unitRate).toBe(43.33);
    expect(line.totalCost).toBe(129.99);
    expect(outcome.pricing.contingency).toBe(13);
    expect(outcome.pricing.vat).toBe(28.6);
    expect(outcome.pricing.midTotal).toBe(171.59);
    expect(outcome.pricing.lowTotal).toBe(145.85);
    expect(outcome.pricing.highTotal).toBe(197.33);
  });

  it("Vector D — quote is not region-adjusted", () => {
    const quote = acceptedQuote(80);
    const london = runMeasuredBoqEngine(singleLineInput("London", quote, 1), trustedDeps);
    const midlands = runMeasuredBoqEngine(singleLineInput("West Midlands", quote, 1), trustedDeps);
    expect(london.status).toBe("authority-priced");
    expect(midlands.status).toBe("authority-priced");
    if (london.status !== "authority-priced" || midlands.status !== "authority-priced") return;
    const l = london.pricing.rooms[0]!.items[0]!;
    const m = midlands.pricing.rooms[0]!.items[0]!;
    expect(l.unitRate).toBe(m.unitRate);
    expect(l.unitRate).toBe(80);
    expect(l.regionalMultiplier).toBe(1);
    expect(m.regionalMultiplier).toBe(1);
  });
});

describe("trusted library authority", () => {
  it("rejects unknown non-empty library references", () => {
    const outcome = runMeasuredBoqEngine(
      singleLineInput("London", libraryRef("arbitrary-key", "arbitrary-revision")),
      trustedDeps,
    );
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_LIBRARY_REFERENCE",
          path: "rooms[0].items[0].rate",
        }),
      ]),
    );
  });

  it("rejects known key with wrong revision", () => {
    const outcome = runMeasuredBoqEngine(
      singleLineInput("London", libraryRef("paint.m2", "1999.01")),
      trustedDeps,
    );
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "MISSING_LIBRARY_REFERENCE")).toBe(true);
  });

  it("rejects resolver entry that mismatches requested key", () => {
    const deps: MeasuredBoqEngineDependencies = {
      resolveLibraryRate: () => ({
        rateKey: "other.key",
        catalogRevision: "2026.07",
        baseUnitRate: 100,
        currency: "GBP",
        vatBasis: "exclusive",
        unit: "m2",
        costType: "combined",
      }),
    };
    const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRef("paint.m2")), deps);
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "MISSING_LIBRARY_REFERENCE")).toBe(true);
  });

  it("rejects resolver entry that mismatches requested revision", () => {
    const deps: MeasuredBoqEngineDependencies = {
      resolveLibraryRate: () => ({
        rateKey: "paint.m2",
        catalogRevision: "wrong",
        baseUnitRate: 100,
        currency: "GBP",
        vatBasis: "exclusive",
        unit: "m2",
        costType: "combined",
      }),
    };
    const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRef("paint.m2")), deps);
    expect(outcome.status).toBe("draft");
  });

  it("rejects invalid catalogue entry amounts and currency/VAT", () => {
    for (const entry of [
      {
        rateKey: "paint.m2",
        catalogRevision: "2026.07",
        baseUnitRate: 0,
        currency: "GBP" as const,
        vatBasis: "exclusive" as const,
        unit: "m2",
        costType: "combined" as const,
      },
      {
        rateKey: "paint.m2",
        catalogRevision: "2026.07",
        baseUnitRate: -5,
        currency: "GBP" as const,
        vatBasis: "exclusive" as const,
        unit: "m2",
        costType: "combined" as const,
      },
      {
        rateKey: "paint.m2",
        catalogRevision: "2026.07",
        baseUnitRate: NaN,
        currency: "GBP" as const,
        vatBasis: "exclusive" as const,
        unit: "m2",
        costType: "combined" as const,
      },
      {
        rateKey: "paint.m2",
        catalogRevision: "2026.07",
        baseUnitRate: 100,
        currency: "USD" as "GBP",
        vatBasis: "exclusive" as const,
        unit: "m2",
        costType: "combined" as const,
      },
      {
        rateKey: "paint.m2",
        catalogRevision: "2026.07",
        baseUnitRate: 100,
        currency: "GBP" as const,
        vatBasis: "inclusive" as "exclusive",
        unit: "m2",
        costType: "combined" as const,
      },
    ]) {
      const deps: MeasuredBoqEngineDependencies = {
        resolveLibraryRate: () => entry,
      };
      const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRef("paint.m2")), deps);
      expect(outcome.status).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(outcome.issues.some((i) => i.code === "INVALID_RATE")).toBe(true);
    }
  });

  it("applies regional multiplier only after trusted catalogue resolution", () => {
    const r = resolveMeasuredBoqRate(
      libraryRef("paint.m2"),
      "London",
      "rooms[0].items[0].rate",
      trustedDeps,
    );
    expect(r.eligible).toBe(true);
    if (!r.eligible) return;
    expect(r.baseUnitRate).toBe(100);
    expect(r.regionalMultiplier).toBe(1.3);
    expect(r.resolvedUnitRate).toBe(130);
  });
});

describe("strict quote dates", () => {
  it("accepts strict issuedAt and acceptedAt formats", () => {
    expect(isValidIsoDateOnly("2026-07-01")).toBe(true);
    expect(isValidIsoDateTime("2026-07-15T10:00:00Z")).toBe(true);
    expect(isValidIsoDateTime("2026-07-15T10:00:00.000Z")).toBe(true);
    expect(isValidIsoDateTime("2026-07-15T11:00:00+01:00")).toBe(true);

    for (const acceptedAt of [
      "2026-07-15T10:00:00Z",
      "2026-07-15T10:00:00.000Z",
      "2026-07-15T11:00:00+01:00",
    ]) {
      const outcome = runMeasuredBoqEngine(
        singleLineInput(
          "London",
          acceptedQuote(50, {
            quote: {
              supplierName: "Acme",
              quoteReference: "Q-1",
              issuedAt: "2026-07-01",
              evidenceRef: "ev",
              acceptedByUserId: "u1",
              acceptedAt,
            },
          }),
        ),
        trustedDeps,
      );
      expect(outcome.status).toBe("authority-priced");
    }
  });

  it("rejects invalid issuedAt values", () => {
    for (const issuedAt of [
      "July 1 2026",
      "2026/07/01",
      "2026-02-30",
      "2026-07-01T00:00:00Z",
      "2026-7-1",
    ]) {
      expect(isValidIsoDateOnly(issuedAt), issuedAt).toBe(false);
      const outcome = runMeasuredBoqEngine(
        singleLineInput(
          "London",
          acceptedQuote(50, {
            quote: {
              supplierName: "Acme",
              quoteReference: "Q-1",
              issuedAt,
              evidenceRef: "ev",
              acceptedByUserId: "u1",
              acceptedAt: "2026-07-15T10:00:00Z",
            },
          }),
        ),
        trustedDeps,
      );
      expect(outcome.status, issuedAt).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(
        outcome.issues.some(
          (i) => i.code === "INVALID_QUOTE_DATE" && i.path.endsWith("quote.issuedAt"),
        ),
      ).toBe(true);
    }
  });

  it("rejects invalid acceptedAt values", () => {
    for (const acceptedAt of [
      "2026-07-15",
      "2026-07-15T10:00:00",
      "2026-02-30T10:00:00Z",
      "July 15 2026 10:00",
    ]) {
      expect(isValidIsoDateTime(acceptedAt), acceptedAt).toBe(false);
      const outcome = runMeasuredBoqEngine(
        singleLineInput(
          "London",
          acceptedQuote(50, {
            quote: {
              supplierName: "Acme",
              quoteReference: "Q-1",
              issuedAt: "2026-07-01",
              evidenceRef: "ev",
              acceptedByUserId: "u1",
              acceptedAt,
            },
          }),
        ),
        trustedDeps,
      );
      expect(outcome.status, acceptedAt).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(
        outcome.issues.some(
          (i) => i.code === "INVALID_QUOTE_DATE" && i.path.endsWith("quote.acceptedAt"),
        ),
      ).toBe(true);
    }
  });
});

describe("structured issue codes", () => {
  it("reports exact codes and paths for structural failures", () => {
    const outcome = runMeasuredBoqEngine(
      {
        region: "London",
        rooms: [
          { id: "", name: "", items: [] },
          {
            id: "r-dup",
            name: "B",
            items: [
              {
                id: "",
                name: "",
                quantity: 0,
                unit: "",
                costType: "magic" as "labour",
                rate: libraryRef("paint.m2"),
              },
              {
                id: "line-a",
                name: "ok",
                quantity: 1,
                unit: "m2",
                rate: libraryRef("paint.m2"),
              },
              {
                id: "line-a",
                name: "dup",
                quantity: 1,
                unit: "m2",
                rate: libraryRef("paint.m2"),
              },
            ],
          },
          {
            id: "r-dup",
            name: "C",
            items: [
              {
                id: "other",
                name: "x",
                quantity: 1,
                unit: "m2",
                rate: libraryRef("paint.m2"),
              },
            ],
          },
        ],
      },
      trustedDeps,
    );
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;

    const byCode = (code: string) => outcome.issues.filter((i) => i.code === code);

    expect(byCode("MISSING_ROOM_ID")).toEqual([expect.objectContaining({ path: "rooms[0].id" })]);
    expect(byCode("MISSING_ROOM_NAME")).toEqual([
      expect.objectContaining({ path: "rooms[0].name" }),
    ]);
    expect(byCode("EMPTY_ROOM")).toEqual([expect.objectContaining({ path: "rooms[0].items" })]);
    expect(byCode("MISSING_LINE_ID")).toEqual([
      expect.objectContaining({ path: "rooms[1].items[0].id" }),
    ]);
    expect(byCode("INVALID_ITEM_NAME")).toEqual([
      expect.objectContaining({ path: "rooms[1].items[0].name" }),
    ]);
    expect(byCode("INVALID_ITEM_UNIT")).toEqual([
      expect.objectContaining({ path: "rooms[1].items[0].unit" }),
    ]);
    expect(byCode("INVALID_QUANTITY")).toEqual([
      expect.objectContaining({ path: "rooms[1].items[0].quantity" }),
    ]);
    expect(byCode("INVALID_COST_TYPE")).toEqual([
      expect.objectContaining({ path: "rooms[1].items[0].costType" }),
    ]);
    expect(byCode("DUPLICATE_LINE_ID")).toEqual([
      expect.objectContaining({ path: "rooms[1].items[2].id" }),
    ]);
    expect(byCode("DUPLICATE_ROOM_ID")).toEqual([expect.objectContaining({ path: "rooms[2].id" })]);
  });

  it("defaults undefined costType to combined on authority-priced results", () => {
    const outcome = runMeasuredBoqEngine(
      singleLineInput("London", libraryRef("paint.m2"), 1),
      trustedDeps,
    );
    expect(outcome.status).toBe("authority-priced");
    if (outcome.status !== "authority-priced") return;
    expect(outcome.pricing.rooms[0]!.items[0]!.costType).toBe("combined");
  });
});

describe("draft outcomes", () => {
  it("reports NO_ROOMS", () => {
    const r = assessMeasuredBoqAuthority({ region: "London", rooms: [] }, trustedDeps);
    expect(r.eligible).toBe(false);
    expect(r.issues[0]).toEqual(expect.objectContaining({ code: "NO_ROOMS", path: "rooms" }));
  });

  it("keeps AI, fallback and unclassified rates as draft without money", () => {
    for (const source of ["ai-assisted", "fallback", "unclassified"] as const) {
      const outcome = runMeasuredBoqEngine(
        singleLineInput("London", { source, candidateUnitRate: 99 }),
        trustedDeps,
      );
      expect(outcome.status).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(outcome.pricing).toBeNull();
    }
  });

  it("does not mutate the input object", () => {
    const input = singleLineInput("London", libraryRef("paint.m2"), 2);
    const freeze = JSON.stringify(input);
    runMeasuredBoqEngine(input, trustedDeps);
    expect(JSON.stringify(input)).toBe(freeze);
  });

  it("is deterministic for the same input", () => {
    const input = singleLineInput("London", libraryRef("paint.m2"), 2);
    expect(runMeasuredBoqEngine(input, trustedDeps)).toEqual(
      runMeasuredBoqEngine(input, trustedDeps),
    );
  });
});

describe("catalogue unit and cost-type compatibility", () => {
  it("exact unit accepted", () => {
    const outcome = runMeasuredBoqEngine(
      singleLineInput("London", libraryRef("paint.m2")),
      trustedDeps,
    );
    expect(outcome.status).toBe("authority-priced");
  });

  it("unit alias rejected at runtime (sqm vs m2)", () => {
    const outcome = runMeasuredBoqEngine(
      {
        region: "London",
        rooms: [
          {
            id: "r1",
            name: "Kitchen",
            items: [
              {
                id: "i1",
                name: "Paint",
                quantity: 1,
                unit: "sqm",
                rate: libraryRef("paint.m2"),
              },
            ],
          },
        ],
      },
      trustedDeps,
    );
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "CATALOG_UNIT_MISMATCH")).toBe(true);
  });

  it("unit mismatch rejected", () => {
    const outcome = runMeasuredBoqEngine(
      {
        region: "London",
        rooms: [
          {
            id: "r1",
            name: "Kitchen",
            items: [
              {
                id: "i1",
                name: "Paint",
                quantity: 1,
                unit: "item",
                rate: libraryRef("paint.m2"),
              },
            ],
          },
        ],
      },
      trustedDeps,
    );
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "CATALOG_UNIT_MISMATCH")).toBe(true);
  });

  it("cost-type mismatch rejected", () => {
    const outcome = runMeasuredBoqEngine(
      {
        region: "London",
        rooms: [
          {
            id: "r1",
            name: "Kitchen",
            items: [
              {
                id: "i1",
                name: "Paint",
                quantity: 1,
                unit: "m2",
                costType: "labour",
                rate: libraryRef("paint.m2"),
              },
            ],
          },
        ],
      },
      trustedDeps,
    );
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "CATALOG_COST_TYPE_MISMATCH")).toBe(true);
  });

  it("reports both unit and costType catalogue entry issues independently", () => {
    const deps = {
      resolveLibraryRate: () => ({
        rateKey: "paint.m2",
        catalogRevision: "2026.07",
        baseUnitRate: 10,
        currency: "GBP" as const,
        vatBasis: "exclusive" as const,
        unit: "",
        costType: "plant" as never,
      }),
    };
    const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRef("paint.m2")), deps);
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    const unitIssue = outcome.issues.find((i) => i.message.includes("unit is required"));
    const costIssue = outcome.issues.find((i) => i.message.includes("costType must be"));
    expect(unitIssue?.code).toBe("INVALID_RATE");
    expect(costIssue?.code).toBe("INVALID_RATE");
  });

  it("omitted library cost type derives trusted entry cost type", () => {
    const outcome = runMeasuredBoqEngine(
      singleLineInput("London", libraryRef("tile.m2")),
      trustedDeps,
    );
    expect(outcome.status).toBe("authority-priced");
    if (outcome.status !== "authority-priced") return;
    expect(outcome.pricing.rooms[0]!.items[0]!.costType).toBe("materials");
    expect(outcome.pricing.rooms[0]!.items[0]!.libraryProvenance?.costType).toBe("materials");
  });

  it("non-library omitted cost type remains combined", () => {
    const outcome = runMeasuredBoqEngine(singleLineInput("London", acceptedQuote(50)), trustedDeps);
    expect(outcome.status).toBe("authority-priced");
    if (outcome.status !== "authority-priced") return;
    expect(outcome.pricing.rooms[0]!.items[0]!.costType).toBe("combined");
    expect(outcome.pricing.rooms[0]!.items[0]!.libraryProvenance).toBeUndefined();
  });
});
