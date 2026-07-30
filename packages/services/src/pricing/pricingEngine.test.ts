import { describe, expect, it } from "vitest";
import { REFERENCE_SIZE_SQM, runPricingEngine, type PricingEngineInputs } from "./pricingEngine";

const base: PricingEngineInputs = {
  region: "London",
  property_condition: "Dated",
  finish_quality: "Standard",
  selected_categories: ["Kitchen", "Bathroom"],
  property_size_sqm: REFERENCE_SIZE_SQM,
};

describe("runPricingEngine assumptions — size provenance", () => {
  it("uses value-neutral size wording at reference size (90 m²)", () => {
    const result = runPricingEngine(base);
    expect(result.assumptions.some((a) => a.includes("Property size not provided"))).toBe(false);
    expect(
      result.assumptions.some(
        (a) => a === `Property size: ${REFERENCE_SIZE_SQM} m² (reference ${REFERENCE_SIZE_SQM} m²)`,
      ),
    ).toBe(true);
  });

  it("uses the same value-neutral wording for non-reference sizes", () => {
    const result = runPricingEngine({ ...base, property_size_sqm: 120 });
    expect(result.assumptions.some((a) => a.includes("Property size not provided"))).toBe(false);
    expect(
      result.assumptions.some(
        (a) => a === `Property size: 120 m² (reference ${REFERENCE_SIZE_SQM} m²)`,
      ),
    ).toBe(true);
  });

  it("does not change totals when only assumption wording is evaluated", () => {
    const a = runPricingEngine(base);
    const b = runPricingEngine({ ...base });
    expect(a.mid_total).toBe(b.mid_total);
    expect(a.low_total).toBe(b.low_total);
    expect(a.high_total).toBe(b.high_total);
  });
});
