import { describe, expect, it } from "vitest";
import {
  categoriesFromIntent,
  conditionFromChip,
  hasUsableOutwardPostcode,
  isPostcodeConfidenceEligible,
  normalizeCategories,
} from "./progressiveChips";

describe("conditionFromChip", () => {
  it("maps chips to engine condition levels", () => {
    expect(conditionFromChip("good")).toBe("Modern");
    expect(conditionFromChip("dated")).toBe("Dated");
    expect(conditionFromChip("poor")).toBe("Poor");
    expect(conditionFromChip("full-gut")).toBe("Full Renovation Needed");
  });
});

describe("categoriesFromIntent", () => {
  it("returns a fresh array each call", () => {
    const a = categoriesFromIntent("cosmetic");
    const b = categoriesFromIntent("cosmetic");
    expect(a).toEqual(["Painting", "Flooring"]);
    expect(a).not.toBe(b);
    a.push("Kitchen");
    expect(categoriesFromIntent("cosmetic")).toEqual(["Painting", "Flooring"]);
  });

  it("maps full-refurb to six categories", () => {
    expect(categoriesFromIntent("full-refurb")).toEqual([
      "Kitchen",
      "Bathroom",
      "Flooring",
      "Painting",
      "Electrical",
      "Plumbing",
    ]);
  });
});

describe("normalizeCategories", () => {
  it("deduplicates and orders by canonical ESTIMATE_CATEGORIES", () => {
    expect(normalizeCategories(["Painting", "Kitchen", "Kitchen", "Bathroom"])).toEqual([
      "Kitchen",
      "Bathroom",
      "Painting",
    ]);
  });
});

describe("hasUsableOutwardPostcode / isPostcodeConfidenceEligible", () => {
  it.each([
    ["E1", true],
    ["E1 6AN", true],
    ["CV1", true],
    ["CV1 2WT", true],
    ["SW1A 1AA", true],
    ["SW", false],
    ["", false],
    ["12345", false],
  ])("structure of %s → %s", (value, expected) => {
    expect(hasUsableOutwardPostcode(value)).toBe(expected);
  });

  it("requires regionMapped for confidence eligibility", () => {
    expect(isPostcodeConfidenceEligible("E1 6AN", true)).toBe(true);
    expect(isPostcodeConfidenceEligible("E1 6AN", false)).toBe(false);
    expect(isPostcodeConfidenceEligible("SW", true)).toBe(false);
    expect(isPostcodeConfidenceEligible("ZZ1 1ZZ", false)).toBe(false);
  });
});
