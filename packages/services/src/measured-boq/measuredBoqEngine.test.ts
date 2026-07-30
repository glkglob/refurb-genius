import { describe, expect, it } from "vitest";

import {
  assessMeasuredBoqAuthority,
  MEASURED_BOQ_POLICY_VERSION,
  resolveMeasuredBoqRate,
  roundMeasuredBoqMoney,
  runMeasuredBoqEngine,
  type MeasuredBoqEngineInput,
  type MeasuredBoqLibraryRate,
  type MeasuredBoqUserQuoteRate,
} from "./measuredBoqEngine";

const libraryRate = (
  baseUnitRate: number,
  overrides: Partial<MeasuredBoqLibraryRate> = {},
): MeasuredBoqLibraryRate => ({
  source: "library",
  rateKey: "paint.m2",
  catalogRevision: "2026.07",
  baseUnitRate,
  currency: "GBP",
  vatBasis: "exclusive",
  ...overrides,
});

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
  it("Vector A — London library rate", () => {
    const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRate(100), 2));
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
              rate: libraryRate(40),
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
    const outcome = runMeasuredBoqEngine(input);
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
    expect(outcome.pricing.assumptions.some((a) => /User quotes/.test(a))).toBe(true);
    expect(outcome.pricing.warnings.some((w) => /Mixed library/.test(w))).toBe(true);
  });

  it("Vector C — pence rounding order", () => {
    const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRate(33.333), 3));
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
    const london = runMeasuredBoqEngine(singleLineInput("London", quote, 1));
    const midlands = runMeasuredBoqEngine(singleLineInput("West Midlands", quote, 1));
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

describe("resolveMeasuredBoqRate", () => {
  it("applies regional multiplier to library rates", () => {
    const r = resolveMeasuredBoqRate(libraryRate(100), "London", "rooms[0].items[0].rate");
    expect(r.eligible).toBe(true);
    if (!r.eligible) return;
    expect(r.regionalMultiplier).toBe(1.3);
    expect(r.resolvedUnitRate).toBe(130);
    expect(r.reference).toBe("paint.m2@2026.07");
  });

  it("rejects incomplete library references", () => {
    const r = resolveMeasuredBoqRate(
      libraryRate(100, { rateKey: "", catalogRevision: "" }),
      "London",
      "rooms[0].items[0].rate",
    );
    expect(r.eligible).toBe(false);
    if (r.eligible) return;
    expect(r.issues.some((i) => i.code === "MISSING_LIBRARY_REFERENCE")).toBe(true);
  });

  it("rejects non-GBP and VAT-inclusive library rates", () => {
    const currency = resolveMeasuredBoqRate(
      { ...libraryRate(100), currency: "USD" as "GBP" },
      "London",
      "path",
    );
    expect(currency.eligible).toBe(false);
    const vat = resolveMeasuredBoqRate(
      { ...libraryRate(100), vatBasis: "inclusive" as "exclusive" },
      "London",
      "path",
    );
    expect(vat.eligible).toBe(false);
  });

  it("rejects draft AI / fallback / unclassified rates", () => {
    expect(
      resolveMeasuredBoqRate({ source: "ai-assisted", candidateUnitRate: 50 }, "London", "path")
        .eligible,
    ).toBe(false);
    expect(
      resolveMeasuredBoqRate({ source: "fallback", candidateUnitRate: 50 }, "London", "path")
        .eligible,
    ).toBe(false);
    expect(
      resolveMeasuredBoqRate({ source: "unclassified", candidateUnitRate: 50 }, "London", "path")
        .eligible,
    ).toBe(false);
  });
});

describe("assessMeasuredBoqAuthority / draft outcomes", () => {
  it("reports NO_ROOMS", () => {
    const r = assessMeasuredBoqAuthority({ region: "London", rooms: [] });
    expect(r.eligible).toBe(false);
    expect(r.issues[0]!.code).toBe("NO_ROOMS");
  });

  it("reports empty room, duplicate room and line ids", () => {
    const r = assessMeasuredBoqAuthority({
      region: "London",
      rooms: [
        { id: "r1", name: "A", items: [] },
        {
          id: "r1",
          name: "B",
          items: [
            { id: "i1", name: "x", quantity: 1, unit: "item", rate: libraryRate(10) },
            { id: "i1", name: "y", quantity: 1, unit: "item", rate: libraryRate(10) },
          ],
        },
      ],
    });
    expect(r.issues.some((i) => i.code === "EMPTY_ROOM")).toBe(true);
    expect(r.issues.some((i) => i.code === "DUPLICATE_ROOM_ID")).toBe(true);
    expect(r.issues.some((i) => i.code === "DUPLICATE_LINE_ID")).toBe(true);
  });

  it("rejects invalid room area and quantities", () => {
    const cases: Array<{ quantity: number; label: string }> = [
      { quantity: 0, label: "zero" },
      { quantity: -1, label: "negative" },
      { quantity: NaN, label: "NaN" },
      { quantity: Infinity, label: "infinite" },
    ];
    for (const c of cases) {
      const outcome = runMeasuredBoqEngine({
        region: "London",
        rooms: [
          {
            id: "r1",
            name: "Kitchen",
            areaSqm: -5,
            items: [
              {
                id: "i1",
                name: "Item",
                quantity: c.quantity,
                unit: "m2",
                rate: libraryRate(10),
              },
            ],
          },
        ],
      });
      expect(outcome.status, c.label).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(outcome.pricing).toBeNull();
      expect(outcome.issues.some((i) => i.code === "INVALID_QUANTITY")).toBe(true);
      expect(outcome.issues.some((i) => i.code === "INVALID_ROOM_AREA")).toBe(true);
    }
  });

  it("rejects invalid rates", () => {
    for (const base of [0, -1, NaN]) {
      const outcome = runMeasuredBoqEngine(singleLineInput("London", libraryRate(base)));
      expect(outcome.status).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(outcome.issues.some((i) => i.code === "INVALID_RATE")).toBe(true);
    }
  });

  it("rejects incomplete quote evidence and dates", () => {
    const incomplete = acceptedQuote(50, {
      quote: {
        supplierName: "",
        quoteReference: "",
        issuedAt: "not-a-date",
        evidenceRef: "",
        acceptedByUserId: "",
        acceptedAt: "bad",
      },
    });
    const outcome = runMeasuredBoqEngine(singleLineInput("London", incomplete));
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "MISSING_QUOTE_EVIDENCE")).toBe(true);
    expect(outcome.issues.some((i) => i.code === "INVALID_QUOTE_DATE")).toBe(true);
  });

  it("keeps AI, fallback and unclassified rates as draft without money fields", () => {
    for (const source of ["ai-assisted", "fallback", "unclassified"] as const) {
      const outcome = runMeasuredBoqEngine(
        singleLineInput("London", { source, candidateUnitRate: 99 }),
      );
      expect(outcome.status).toBe("draft");
      if (outcome.status !== "draft") continue;
      expect(outcome.pricing).toBeNull();
      const moneyKeys = ["subtotal", "contingency", "vat", "lowTotal", "midTotal", "highTotal"];
      for (const k of moneyKeys) {
        expect(outcome).not.toHaveProperty(`pricing.${k}`);
      }
    }
  });

  it("returns multiple issues in traversal order", () => {
    const outcome = runMeasuredBoqEngine({
      region: "London",
      rooms: [
        {
          id: "r1",
          name: "A",
          items: [
            {
              id: "i1",
              name: "one",
              quantity: 0,
              unit: "m2",
              rate: { source: "ai-assisted", candidateUnitRate: 1 },
            },
            {
              id: "i2",
              name: "two",
              quantity: 1,
              unit: "m2",
              rate: libraryRate(0),
            },
          ],
        },
      ],
    });
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    const paths = outcome.issues.map((i) => i.path);
    const qtyIdx = paths.findIndex((p) => p.includes("items[0].quantity"));
    const aiIdx = paths.findIndex((p) => p.includes("items[0].rate"));
    const rateIdx = paths.findIndex((p) => p.includes("items[1].rate"));
    expect(qtyIdx).toBeGreaterThanOrEqual(0);
    expect(aiIdx).toBeGreaterThan(qtyIdx);
    expect(rateIdx).toBeGreaterThan(aiIdx);
  });

  it("does not mutate the input object", () => {
    const input = singleLineInput("London", libraryRate(100), 2);
    const freeze = JSON.stringify(input);
    runMeasuredBoqEngine(input);
    expect(JSON.stringify(input)).toBe(freeze);
  });

  it("is deterministic for the same input", () => {
    const input = singleLineInput("London", libraryRate(100), 2);
    expect(runMeasuredBoqEngine(input)).toEqual(runMeasuredBoqEngine(input));
  });
});
