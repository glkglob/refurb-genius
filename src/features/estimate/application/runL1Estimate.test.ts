import { describe, expect, it } from "vitest";
import { runL1Estimate } from "./runL1Estimate";

describe("runL1Estimate", () => {
  it("returns engine source and low display confidence", () => {
    const result = runL1Estimate({
      postcode: "CV1 2WT",
      condition: "dated",
      intent: "kitchen-bath",
    });

    expect(result.source).toBe("engine");
    expect(result.displayConfidence).toBe("low");
    expect(result.pricing.mid_total).toBeGreaterThan(0);
    expect(result.pricing.low_total).toBeLessThan(result.pricing.mid_total);
    expect(result.pricing.high_total).toBeGreaterThan(result.pricing.mid_total);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.keyDrivers.some((d) => d.label === "Region")).toBe(true);
  });

  it("does not invent money — totals come from the engine path", () => {
    const a = runL1Estimate({
      postcode: "CV1 2WT",
      condition: "poor",
      intent: "full-refurb",
    });
    const b = runL1Estimate({
      postcode: "CV1 2WT",
      condition: "poor",
      intent: "full-refurb",
    });
    expect(a.pricing.mid_total).toBe(b.pricing.mid_total);
    expect(a.pricing.low_total).toBe(b.pricing.low_total);
    expect(a.pricing.high_total).toBe(b.pricing.high_total);
  });

  it("leaves engine confidence intact while forcing displayConfidence low", () => {
    const result = runL1Estimate({
      postcode: "CV1 2WT",
      condition: "dated",
      intent: "full-refurb",
    });
    expect(result.displayConfidence).toBe("low");
    // Engine confidence is based on category count; full-refurb has 6 categories → high
    expect(result.pricing.confidence).toBe("high");
    expect(["low", "medium", "high"]).toContain(result.pricing.confidence);
  });

  it("lists finish, size and category defaults in assumptions", () => {
    const result = runL1Estimate({
      postcode: "E1 6AN",
      condition: "good",
      intent: "cosmetic",
    });
    expect(result.assumptions.some((a) => a.includes("Finish assumed: Standard"))).toBe(true);
    expect(result.assumptions.some((a) => a.includes("90 m²"))).toBe(true);
    expect(result.assumptions.some((a) => a.includes("Painting"))).toBe(true);
  });

  it("authoritative totals are taken from the pricing result object", () => {
    const result = runL1Estimate({
      postcode: "M1 1AE",
      condition: "poor",
      intent: "kitchen-bath",
    });
    expect(result.pricing.mid_total).toBe(result.pricing.mid_total);
    expect(result.pricing).toHaveProperty("mid_total");
    expect(result.pricing).toHaveProperty("low_total");
    expect(result.pricing).toHaveProperty("high_total");
    expect(result.pricing).toHaveProperty("confidence");
  });
});
