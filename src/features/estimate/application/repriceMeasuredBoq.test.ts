import { describe, expect, it } from "vitest";

import { repriceMeasuredBoq } from "./repriceMeasuredBoq";

describe("repriceMeasuredBoq", () => {
  it("returns engine source for authority-priced library input", () => {
    const result = repriceMeasuredBoq({
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
                baseUnitRate: 100,
                currency: "GBP",
                vatBasis: "exclusive",
              },
            },
          ],
        },
      ],
    });
    expect(result.status).toBe("authority-priced");
    if (result.status !== "authority-priced") return;
    expect(result.source).toBe("engine");
    expect(result.pricing.midTotal).toBe(343.2);
    expect(result.issues).toEqual([]);
  });

  it("maps AI-assisted draft rates to ai-assisted source", () => {
    const result = repriceMeasuredBoq({
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
    });
    expect(result).toEqual({
      status: "draft",
      source: "ai-assisted",
      pricing: null,
      issues: expect.arrayContaining([expect.objectContaining({ code: "INELIGIBLE_AI_RATE" })]),
    });
  });

  it("maps validation/fallback drafts to fallback source", () => {
    const empty = repriceMeasuredBoq({ region: "London", rooms: [] });
    expect(empty.status).toBe("draft");
    if (empty.status !== "draft") return;
    expect(empty.source).toBe("fallback");
    expect(empty.pricing).toBeNull();

    const fallbackRate = repriceMeasuredBoq({
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
    });
    expect(fallbackRate.status).toBe("draft");
    if (fallbackRate.status !== "draft") return;
    expect(fallbackRate.source).toBe("fallback");
  });

  it("does not accept or return caller totals on draft", () => {
    const result = repriceMeasuredBoq({
      region: "London",
      rooms: [
        {
          id: "r1",
          name: "Kitchen",
          items: [
            {
              id: "i1",
              name: "Paint",
              quantity: 0,
              unit: "m2",
              rate: {
                source: "library",
                rateKey: "paint.m2",
                catalogRevision: "2026.07",
                baseUnitRate: 100,
                currency: "GBP",
                vatBasis: "exclusive",
              },
            },
          ],
        },
      ],
    });
    expect(result.status).toBe("draft");
    if (result.status !== "draft") return;
    expect(result.pricing).toBeNull();
  });
});
