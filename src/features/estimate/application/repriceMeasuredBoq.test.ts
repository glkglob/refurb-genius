import { describe, expect, it } from "vitest";

import type { MeasuredBoqEngineDependencies, MeasuredBoqLibraryCatalogEntry } from "@repo/services";

import { repriceMeasuredBoq } from "./repriceMeasuredBoq";

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
]);

const deps: MeasuredBoqEngineDependencies = {
  resolveLibraryRate: (ref) =>
    TEST_CATALOGUE.get(catalogKey(ref.rateKey, ref.catalogRevision)) ?? null,
};

describe("repriceMeasuredBoq", () => {
  it("returns engine source for authority-priced library input", () => {
    const result = repriceMeasuredBoq(
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
                quantity: 2,
                unit: "m2",
                rate: {
                  source: "library",
                  rateKey: "paint.m2",
                  catalogRevision: "2026.07",
                },
              },
            ],
          },
        ],
      },
      deps,
    );
    expect(result.status).toBe("authority-priced");
    if (result.status !== "authority-priced") return;
    expect(result.source).toBe("engine");
    expect(result.pricing.midTotal).toBe(343.2);
    expect(result.issues).toEqual([]);
  });

  it("maps AI-assisted draft rates to ai-assisted source", () => {
    const result = repriceMeasuredBoq(
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
                rate: { source: "ai-assisted", candidateUnitRate: 50 },
              },
            ],
          },
        ],
      },
      deps,
    );
    expect(result.status).toBe("draft");
    if (result.status !== "draft") return;
    expect(result.source).toBe("ai-assisted");
    expect(result.pricing).toBeNull();
    expect(result.issues.some((i) => i.code === "INELIGIBLE_AI_RATE")).toBe(true);
  });

  it("maps validation/fallback drafts to fallback source", () => {
    const empty = repriceMeasuredBoq({ region: "London", rooms: [] }, deps);
    expect(empty.status).toBe("draft");
    if (empty.status !== "draft") return;
    expect(empty.source).toBe("fallback");
    expect(empty.pricing).toBeNull();

    const fallbackRate = repriceMeasuredBoq(
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
                rate: { source: "fallback", candidateUnitRate: 50 },
              },
            ],
          },
        ],
      },
      deps,
    );
    expect(fallbackRate.status).toBe("draft");
    if (fallbackRate.status !== "draft") return;
    expect(fallbackRate.source).toBe("fallback");
  });

  it("rejects unknown library references as draft", () => {
    const result = repriceMeasuredBoq(
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
                rate: {
                  source: "library",
                  rateKey: "unknown",
                  catalogRevision: "2026.07",
                },
              },
            ],
          },
        ],
      },
      deps,
    );
    expect(result.status).toBe("draft");
    if (result.status !== "draft") return;
    expect(result.source).toBe("fallback");
    expect(result.pricing).toBeNull();
  });
});
