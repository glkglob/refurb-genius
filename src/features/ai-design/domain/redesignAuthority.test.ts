import { describe, expect, it } from "vitest";
import {
  analysisIdentityFromPhotoIds,
  conceptToPayload,
  parseRedesignPayload,
  payloadToConcept,
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

  it("payload round-trip preserves selection + analysis binding", () => {
    const payload = conceptToPayload(sample, "id-a\u0001id-b", true);
    expect(payload.isSelected).toBe(true);
    expect(payload.analysisIdentity).toBe("id-a\u0001id-b");
    const concept = payloadToConcept("Modern", payload, "row-1");
    expect(concept.id).toBe("row-1");
    expect(concept.isSelected).toBe(true);
    expect(concept.analysisIdentity).toBe("id-a\u0001id-b");
    expect(concept.style).toBe("Modern");
  });

  it("generation default is not selected", () => {
    const payload = conceptToPayload(sample, "x", false);
    expect(payload.isSelected).toBe(false);
  });

  it("parseRedesignPayload rejects incomplete payload", () => {
    expect(parseRedesignPayload({ tagline: "x" })).toBeNull();
    expect(parseRedesignPayload(null)).toBeNull();
  });
});
