import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveL1Inputs,
  L1_POLICY_VERSION,
  type L1UserInput,
} from "./l1Policy";

describe("resolveL1Inputs", () => {
  it("maps cosmetic intent to painting and flooring", () => {
    const input: L1UserInput = {
      postcode: "CV1 2WT",
      condition: "dated",
      intent: "cosmetic",
    };
    const resolved = resolveL1Inputs(input);
    assert.deepEqual(resolved.engineInputs.selected_categories, [
      "Painting",
      "Flooring",
    ]);
    assert.equal(resolved.engineInputs.property_condition, "Dated");
    assert.equal(resolved.engineInputs.finish_quality, "Standard");
    assert.equal(resolved.engineInputs.property_size_sqm, 90);
    assert.equal(resolved.policyVersion, L1_POLICY_VERSION);
    assert.ok(resolved.appliedDefaults.length >= 3);
  });

  it("maps full-gut condition to Full Renovation Needed", () => {
    const resolved = resolveL1Inputs({
      postcode: "E1 6AN",
      condition: "full-gut",
      intent: "full-refurb",
    });
    assert.equal(resolved.engineInputs.property_condition, "Full Renovation Needed");
    assert.equal(resolved.engineInputs.region, "London");
  });

  it("records size and finish defaults in appliedDefaults", () => {
    const resolved = resolveL1Inputs({
      postcode: "M1 1AE",
      condition: "good",
      intent: "not-sure",
    });
    assert.ok(
      resolved.appliedDefaults.some((d) => d.includes("Finish assumed: Standard")),
    );
    assert.ok(
      resolved.appliedDefaults.some((d) => d.includes("90 m²")),
    );
  });
});
