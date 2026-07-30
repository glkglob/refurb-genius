import { describe, expect, it } from "vitest";
import { runPricingEngine } from "../domain";
import { resolveL2Inputs } from "../domain/l2Policy";
import { runL2Estimate } from "./runL2Estimate";

describe("runL2Estimate", () => {
  it("returns engine source and low confidence for L1-equivalent inputs", () => {
    const result = runL2Estimate({
      postcode: "CV1 2WT",
      condition: "dated",
      intent: "kitchen-bath",
    });
    expect(result.source).toBe("engine");
    expect(result.displayConfidence).toBe("low");
    expect(result.policyVersion).toMatch(/^2026-/);
    expect(result.pricing.mid_total).toBeGreaterThan(0);
  });

  it("returns medium confidence when finish, size and eligible postcode provided", () => {
    const result = runL2Estimate({
      postcode: "E1 6AN",
      condition: "dated",
      intent: "full-refurb",
      finish: "Premium",
      property_size_sqm: 120,
    });
    expect(result.displayConfidence).toBe("medium");
    expect(result.userProvided.finish).toBe(true);
    expect(result.userProvided.size).toBe(true);
    expect(result.keyDrivers.find((d) => d.label === "Size")?.value).toBe("120 m²");
    expect(result.keyDrivers.find((d) => d.label === "Finish")?.value).toBe("Premium");
  });

  it("keeps low confidence for bare SW with finish and size", () => {
    const result = runL2Estimate({
      postcode: "SW",
      condition: "dated",
      intent: "full-refurb",
      finish: "Standard",
      property_size_sqm: 100,
    });
    expect(result.displayConfidence).toBe("low");
  });

  it("keeps low confidence for ZZ1 with fallback assumption", () => {
    const result = runL2Estimate({
      postcode: "ZZ1 1ZZ",
      condition: "dated",
      intent: "full-refurb",
      finish: "Standard",
      property_size_sqm: 100,
    });
    expect(result.displayConfidence).toBe("low");
    expect(
      result.assumptions.some((a) =>
        a.includes(
          "Region defaulted to London because the postcode area was missing or unrecognised",
        ),
      ),
    ).toBe(true);
  });

  it("does not claim size was not provided when user enters exactly 90 m²", () => {
    const result = runL2Estimate({
      postcode: "E1 6AN",
      condition: "good",
      intent: "cosmetic",
      finish: "Budget",
      property_size_sqm: 90,
    });
    expect(result.assumptions.some((a) => a.includes("Property size not provided"))).toBe(false);
    expect(result.assumptions.some((a) => a.includes("Property size provided: 90 m²"))).toBe(true);
    expect(result.assumptions.some((a) => a.includes("Property size: 90m²"))).toBe(true);
  });

  it("authoritative totals match runPricingEngine on the same resolved inputs", () => {
    const input = {
      postcode: "M1 1AE" as const,
      condition: "poor" as const,
      intent: "kitchen-bath" as const,
      finish: "Standard" as const,
      property_size_sqm: 95,
    };
    const result = runL2Estimate(input);
    const resolved = resolveL2Inputs(input);
    const expected = runPricingEngine(resolved.engineInputs);
    expect(result.pricing.mid_total).toBe(expected.mid_total);
    expect(result.pricing.low_total).toBe(expected.low_total);
    expect(result.pricing.high_total).toBe(expected.high_total);
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      postcode: "E1 6AN",
      condition: "dated" as const,
      intent: "full-refurb" as const,
      finish: "Premium" as const,
      property_size_sqm: 110,
    };
    const a = runL2Estimate(input);
    const b = runL2Estimate(input);
    expect(a.pricing.mid_total).toBe(b.pricing.mid_total);
    expect(a.displayConfidence).toBe(b.displayConfidence);
  });

  it("never returns high display confidence", () => {
    const result = runL2Estimate({
      postcode: "E1 6AN",
      condition: "full-gut",
      intent: "full-refurb",
      finish: "Premium",
      property_size_sqm: 130,
      categories: ["Kitchen", "Bathroom", "Flooring", "Painting", "Electrical", "Plumbing"],
    });
    expect(result.displayConfidence).not.toBe("high");
    expect(["low", "medium"]).toContain(result.displayConfidence);
  });
});
