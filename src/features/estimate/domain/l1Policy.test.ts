import { describe, expect, it } from "vitest";
import { resolveL1Inputs, L1_POLICY_VERSION, type L1UserInput } from "./l1Policy";

describe("resolveL1Inputs", () => {
  it("maps cosmetic intent to painting and flooring", () => {
    const input: L1UserInput = {
      postcode: "CV1 2WT",
      condition: "dated",
      intent: "cosmetic",
    };
    const resolved = resolveL1Inputs(input);
    expect(resolved.engineInputs.selected_categories).toEqual(["Painting", "Flooring"]);
    expect(resolved.engineInputs.property_condition).toBe("Dated");
    expect(resolved.engineInputs.finish_quality).toBe("Standard");
    expect(resolved.engineInputs.property_size_sqm).toBe(90);
    expect(resolved.policyVersion).toBe(L1_POLICY_VERSION);
    expect(resolved.regionMapped).toBe(true);
    expect(resolved.engineInputs.region).toBe("West Midlands");
    expect(resolved.appliedDefaults.length).toBeGreaterThanOrEqual(3);
  });

  it("maps full-gut condition to Full Renovation Needed", () => {
    const resolved = resolveL1Inputs({
      postcode: "E1 6AN",
      condition: "full-gut",
      intent: "full-refurb",
    });
    expect(resolved.engineInputs.property_condition).toBe("Full Renovation Needed");
    expect(resolved.engineInputs.region).toBe("London");
    expect(resolved.regionMapped).toBe(true);
  });

  it("records size, finish and category defaults in appliedDefaults", () => {
    const resolved = resolveL1Inputs({
      postcode: "M1 1AE",
      condition: "good",
      intent: "not-sure",
    });
    expect(resolved.appliedDefaults.some((d) => d.includes("Finish assumed: Standard"))).toBe(true);
    expect(resolved.appliedDefaults.some((d) => d.includes("90 m²"))).toBe(true);
    expect(
      resolved.appliedDefaults.some((d) => d.includes('Categories from intent "not-sure"')),
    ).toBe(true);
    expect(resolved.regionMapped).toBe(true);
  });

  it("refuses unknown postcode instead of defaulting to London", () => {
    expect(() =>
      resolveL1Inputs({
        postcode: "ZZ1 1ZZ",
        condition: "dated",
        intent: "cosmetic",
      }),
    ).toThrow(/postcode area was missing or unrecognised/i);
  });

  it("refuses empty postcode instead of defaulting to London", () => {
    expect(() =>
      resolveL1Inputs({
        postcode: "",
        condition: "dated",
        intent: "cosmetic",
      }),
    ).toThrow(/postcode area was missing or unrecognised/i);
  });

  it("maps BS16 2EG to South West England", () => {
    const resolved = resolveL1Inputs({
      postcode: "BS16 2EG",
      condition: "dated",
      intent: "cosmetic",
    });
    expect(resolved.engineInputs.region).toBe("South West England");
    expect(resolved.regionMapped).toBe(true);
  });

  it("does not describe a known London postcode as an unknown fallback", () => {
    const resolved = resolveL1Inputs({
      postcode: "SW1A 1AA",
      condition: "good",
      intent: "kitchen-bath",
    });
    expect(resolved.engineInputs.region).toBe("London");
    expect(resolved.regionMapped).toBe(true);
    expect(resolved.appliedDefaults.some((d) => d.includes("postcode area was missing"))).toBe(
      false,
    );
  });
});
