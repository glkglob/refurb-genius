import { describe, expect, it } from "vitest";
import {
  L2_MAX_SIZE_SQM,
  L2_MIN_SIZE_SQM,
  L2_POLICY_VERSION,
  L2PolicyError,
  resolveL2DisplayConfidence,
  resolveL2Inputs,
  type L2UserInput,
} from "./l2Policy";

const base: L2UserInput = {
  postcode: "E1 6AN",
  condition: "dated",
  intent: "full-refurb",
};

describe("resolveL2Inputs", () => {
  it("defaults finish, size and categories like L1 when optionals omitted", () => {
    const resolved = resolveL2Inputs(base);
    expect(resolved.engineInputs.finish_quality).toBe("Standard");
    expect(resolved.engineInputs.property_size_sqm).toBe(90);
    expect(resolved.engineInputs.selected_categories).toEqual([
      "Kitchen",
      "Bathroom",
      "Flooring",
      "Painting",
      "Electrical",
      "Plumbing",
    ]);
    expect(resolved.userProvided.finish).toBe(false);
    expect(resolved.userProvided.size).toBe(false);
    expect(resolved.userProvided.categories).toBe(false);
    expect(resolved.policyVersion).toBe(L2_POLICY_VERSION);
    expect(resolved.appliedDefaults.some((d) => d.includes("Finish assumed: Standard"))).toBe(true);
    expect(resolved.appliedDefaults.some((d) => d.includes("Property size assumed: 90 m²"))).toBe(
      true,
    );
  });

  it("accepts explicit finish and size including exactly 90 m² as provided", () => {
    const resolved = resolveL2Inputs({
      ...base,
      finish: "Premium",
      property_size_sqm: 90,
    });
    expect(resolved.engineInputs.finish_quality).toBe("Premium");
    expect(resolved.engineInputs.property_size_sqm).toBe(90);
    expect(resolved.userProvided.finish).toBe(true);
    expect(resolved.userProvided.size).toBe(true);
    expect(resolved.appliedDefaults.some((d) => d.includes("Property size provided: 90 m²"))).toBe(
      true,
    );
    expect(resolved.appliedDefaults.some((d) => d.includes("Property size assumed"))).toBe(false);
  });

  it("uses explicit category override in canonical order and clones intent defaults", () => {
    const resolved = resolveL2Inputs({
      ...base,
      categories: ["Painting", "Kitchen", "Painting"],
    });
    expect(resolved.engineInputs.selected_categories).toEqual(["Kitchen", "Painting"]);
    expect(resolved.userProvided.categories).toBe(true);
    // Mutating result must not affect a later intent-derived resolve
    resolved.engineInputs.selected_categories.push("Garden");
    const again = resolveL2Inputs(base);
    expect(again.engineInputs.selected_categories).not.toContain("Garden");
  });

  it("rejects empty category override", () => {
    expect(() => resolveL2Inputs({ ...base, categories: [] })).toThrow(L2PolicyError);
  });

  it("rejects size outside 20–500 and non-finite values", () => {
    expect(() => resolveL2Inputs({ ...base, property_size_sqm: 19 })).toThrow(L2PolicyError);
    expect(() => resolveL2Inputs({ ...base, property_size_sqm: 501 })).toThrow(L2PolicyError);
    expect(() => resolveL2Inputs({ ...base, property_size_sqm: 0 })).toThrow(L2PolicyError);
    expect(() => resolveL2Inputs({ ...base, property_size_sqm: Number.NaN })).toThrow(
      L2PolicyError,
    );
    expect(
      resolveL2Inputs({ ...base, property_size_sqm: L2_MIN_SIZE_SQM }).engineInputs
        .property_size_sqm,
    ).toBe(20);
    expect(
      resolveL2Inputs({ ...base, property_size_sqm: L2_MAX_SIZE_SQM }).engineInputs
        .property_size_sqm,
    ).toBe(500);
  });

  it("marks bare SW as mapped region but not confidence-eligible", () => {
    const resolved = resolveL2Inputs({ ...base, postcode: "SW" });
    expect(resolved.regionMapped).toBe(true);
    expect(resolved.engineInputs.region).toBe("London");
    expect(resolved.postcodeConfidenceEligible).toBe(false);
  });

  it("marks ZZ1 as unmapped and not confidence-eligible with fallback assumption", () => {
    const resolved = resolveL2Inputs({ ...base, postcode: "ZZ1 1ZZ" });
    expect(resolved.regionMapped).toBe(false);
    expect(resolved.postcodeConfidenceEligible).toBe(false);
    expect(
      resolved.appliedDefaults.some((d) =>
        d.includes(
          "Region defaulted to London because the postcode area was missing or unrecognised",
        ),
      ),
    ).toBe(true);
  });

  it("flags extreme sizes that hit engine size mult caps", () => {
    // 20 m² → sizeMult ~0.7 (floor); 500 m² → sizeMult capped at 1.8
    const small = resolveL2Inputs({ ...base, property_size_sqm: 20 });
    const large = resolveL2Inputs({ ...base, property_size_sqm: 500 });
    expect(small.sizeExtremeWarning).toBe(true);
    expect(large.sizeExtremeWarning).toBe(true);
    const mid = resolveL2Inputs({ ...base, property_size_sqm: 120 });
    expect(mid.sizeExtremeWarning).toBe(false);
  });
});

describe("resolveL2DisplayConfidence", () => {
  it("is low when finish or size defaulted", () => {
    const onlyFinish = resolveL2Inputs({ ...base, finish: "Budget" });
    expect(resolveL2DisplayConfidence(onlyFinish)).toBe("low");
    const onlySize = resolveL2Inputs({ ...base, property_size_sqm: 100 });
    expect(resolveL2DisplayConfidence(onlySize)).toBe("low");
  });

  it("is medium when finish + size provided and postcode confidence-eligible", () => {
    const resolved = resolveL2Inputs({
      ...base,
      finish: "Standard",
      property_size_sqm: 100,
    });
    expect(resolved.postcodeConfidenceEligible).toBe(true);
    expect(resolveL2DisplayConfidence(resolved)).toBe("medium");
  });

  it("stays low for bare SW even with finish and size", () => {
    const resolved = resolveL2Inputs({
      ...base,
      postcode: "SW",
      finish: "Premium",
      property_size_sqm: 100,
    });
    expect(resolveL2DisplayConfidence(resolved)).toBe("low");
  });

  it("stays low for ZZ1 even with finish and size", () => {
    const resolved = resolveL2Inputs({
      ...base,
      postcode: "ZZ1 1ZZ",
      finish: "Premium",
      property_size_sqm: 100,
    });
    expect(resolveL2DisplayConfidence(resolved)).toBe("low");
  });

  it("stays low when size triggers extreme/capped warning", () => {
    const resolved = resolveL2Inputs({
      ...base,
      finish: "Premium",
      property_size_sqm: 20,
    });
    expect(resolved.sizeExtremeWarning).toBe(true);
    expect(resolveL2DisplayConfidence(resolved)).toBe("low");
  });

  it("does not require category override for medium", () => {
    const resolved = resolveL2Inputs({
      ...base,
      finish: "Budget",
      property_size_sqm: 110,
      // categories still intent-derived
    });
    expect(resolved.userProvided.categories).toBe(false);
    expect(resolveL2DisplayConfidence(resolved)).toBe("medium");
  });
});
