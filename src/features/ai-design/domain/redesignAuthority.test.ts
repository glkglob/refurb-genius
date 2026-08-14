import { describe, expect, it } from "vitest";
import {
  analysisIdentityFromPhotoIds,
  assertRedesignConceptList,
  conceptToPayload,
  parseRedesignPayload,
  payloadToConcept,
  rowToDurableRedesignConcept,
  selectedRedesignIdFromList,
} from "./redesignAuthority";
import type { RedesignConcept } from "./types";

const sample: RedesignConcept = {
  style: "Modern",
  tagline: "Clean",
  palette: [{ name: "White", hex: "#FFFFFF" }],
  flooring: "Oak",
  lighting: "Warm",
  furniture: "Sofa",
  afterGradient: "linear-gradient(1deg, #fff, #eee)",
};

describe("IA-4 redesignAuthority", () => {
  it("analysisIdentity is order-independent durable photo ids", () => {
    expect(analysisIdentityFromPhotoIds(["b", "a"])).toBe(analysisIdentityFromPhotoIds(["a", "b"]));
    expect(analysisIdentityFromPhotoIds(["a"])).not.toBe(analysisIdentityFromPhotoIds(["a", "b"]));
  });

  it("payload round-trip preserves analysis binding fields", () => {
    const payload = conceptToPayload(sample, "id-a\u0001id-b", true);
    expect(payload.analysisIdentity).toBe("id-a\u0001id-b");
    const concept = payloadToConcept("Modern", payload, "row-1");
    expect(concept.id).toBe("row-1");
    expect(concept.analysisIdentity).toBe("id-a\u0001id-b");
    expect(concept.style).toBe("Modern");
  });

  it("IA-4-R1: presentation payload defaults isSelected false when used as concept body", () => {
    // Generation writes JSON with isSelected false; column is canonical.
    const payload = conceptToPayload(sample, "x", false);
    expect(payload.isSelected).toBe(false);
  });

  it("parseRedesignPayload rejects incomplete payload (fail closed)", () => {
    expect(parseRedesignPayload({ tagline: "x" })).toBeNull();
    expect(parseRedesignPayload(null)).toBeNull();
    expect(
      parseRedesignPayload({
        tagline: "t",
        flooring: "f",
        lighting: "l",
        furniture: "u",
        afterGradient: "g",
        // missing analysisIdentity
        isSelected: true,
      }),
    ).toBeNull();
  });

  it("column is_selected wins over JSON isSelected when mapping a row", () => {
    const concept = rowToDurableRedesignConcept({
      id: "c1",
      style: "Modern",
      title: "t",
      description: JSON.stringify({
        tagline: "t",
        palette: [],
        flooring: "f",
        lighting: "l",
        furniture: "u",
        afterGradient: "g",
        analysisIdentity: "p1",
        isSelected: true,
      }),
      image_url: null,
      analysis_identity: "p1",
      is_selected: false,
    });
    expect(concept?.isSelected).toBe(false);
    expect(concept?.analysisIdentity).toBe("p1");
  });

  it("assertRedesignConceptList rejects #151 non-array payloads", () => {
    expect(() => assertRedesignConceptList({ data: [] })).toThrow(/not an array/);
    expect(selectedRedesignIdFromList(assertRedesignConceptList([]))).toBeNull();
  });

  it("valid payload with isSelected true still parseable for presentation", () => {
    const p = parseRedesignPayload({
      tagline: "t",
      flooring: "f",
      lighting: "l",
      furniture: "u",
      afterGradient: "g",
      analysisIdentity: "p1",
      isSelected: true,
    });
    expect(p?.isSelected).toBe(true);
    // Authority for currentness must still use DB column in repository (tested separately).
  });
});
