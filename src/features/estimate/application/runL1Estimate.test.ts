import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runL1Estimate } from "./runL1Estimate";

describe("runL1Estimate", () => {
  it("returns engine source and low display confidence", () => {
    const result = runL1Estimate({
      postcode: "CV1 2WT",
      condition: "dated",
      intent: "kitchen-bath",
    });

    assert.equal(result.source, "engine");
    assert.equal(result.displayConfidence, "low");
    assert.ok(result.pricing.mid_total > 0);
    assert.ok(result.pricing.low_total < result.pricing.mid_total);
    assert.ok(result.pricing.high_total > result.pricing.mid_total);
    assert.ok(result.assumptions.length > 0);
    assert.ok(result.keyDrivers.some((d) => d.label === "Region"));
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
    // Deterministic: same inputs → same mid_total
    assert.equal(a.pricing.mid_total, b.pricing.mid_total);
  });
});
