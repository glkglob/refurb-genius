import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  runPricingEngine,
  runRoiEngine,
  type PricingEngineInputs,
  type RoiEngineInputs,
} from "@repo/services";
import type { ParsedDealFormData } from "@repo/types";

import { analyzeDeal } from "../../src/lib/deal-copilot/dealAnalysis";
import { heavyRefurbInput } from "../../src/test/fixtures/deal-copilot/edge-cases";
import { standardFlipInput } from "../../src/test/fixtures/deal-copilot/standard-flip";

function buildPricingInput(formData: ParsedDealFormData): PricingEngineInputs {
  return {
    region: formData.region,
    property_condition: formData.propertyCondition,
    finish_quality: formData.finishLevel ?? "Standard",
    selected_categories: formData.selectedCategories ?? [],
    property_size_sqm: formData.propertySize ?? 100,
  };
}

function buildAuthoritativeRoiInput(
  formData: ParsedDealFormData,
  refurbBudget: number,
): RoiEngineInputs {
  return {
    purchase_price: formData.purchasePrice,
    refurb_budget: refurbBudget,
    estimated_gdv: formData.estimatedGdv,
    rental_income: formData.rentalIncome * 12,
    holding_costs: formData.holdingCosts,
    region: formData.region,
    property_condition: formData.propertyCondition,
  };
}

function assertPricingAuthorityInvariant(formData: ParsedDealFormData): void {
  const analysis = analyzeDeal(formData);
  assert.equal(analysis.ready, true, "Expected analyzeDeal() to produce a ready analysis.");
  assert.ok(analysis.pricing, "Expected analyzeDeal() to include pricing output.");
  assert.ok(analysis.roi, "Expected analyzeDeal() to include ROI output.");
  assert.equal(
    analysis.roi.inputs.refurb_budget,
    analysis.pricing.mid_total,
    `Invariant regression: ROI refurb cost must come from pricing.mid_total (${analysis.pricing.mid_total}), received ${analysis.roi.inputs.refurb_budget}.`,
  );
  assert.notEqual(
    analysis.roi.inputs.refurb_budget,
    formData.refurbBudget,
    "Invariant regression: ROI must not consume the user-entered refurb budget.",
  );
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("ROI consumes only pricing.mid_total in analyzeDeal()", () => {
  assertPricingAuthorityInvariant(standardFlipInput);
  assertPricingAuthorityInvariant(heavyRefurbInput);
});

test("pricing.mid_total remains defined, numeric, and positive", () => {
  // Provide real categories so the engine produces a non-zero cost.
  const pricing = runPricingEngine({
    ...buildPricingInput(standardFlipInput),
    selected_categories: ["Kitchen", "Bathroom", "Flooring"],
  });

  assert.notEqual(pricing.mid_total, undefined, "pricing.mid_total must be defined.");
  assert.equal(Number.isFinite(pricing.mid_total), true, "pricing.mid_total must be numeric.");
  assert.ok(pricing.mid_total > 0, "pricing.mid_total must be greater than zero.");
});

test("identical inputs execute deterministically", () => {
  const runA = analyzeDeal(standardFlipInput);
  const runB = analyzeDeal({ ...standardFlipInput });

  assert.deepEqual(runA, runB, "analyzeDeal() must be deterministic for identical inputs.");
});

test("regression protection blocks non-authoritative ROI inputs clearly", () => {
  const pricing = runPricingEngine(buildPricingInput(standardFlipInput));

  assert.throws(() => {
    const badRoi = runRoiEngine(
      buildAuthoritativeRoiInput(standardFlipInput, standardFlipInput.refurbBudget),
    );
    assert.equal(
      badRoi.inputs.refurb_budget,
      pricing.mid_total,
      `Invariant regression: ROI refurb cost must come from pricing.mid_total (${pricing.mid_total}), received ${badRoi.inputs.refurb_budget}.`,
    );
  }, /Invariant regression: ROI refurb cost must come from pricing\.mid_total/);
});

test("source mapping forbids fallback logic around pricing.mid_total", () => {
  const source = readFileSync(
    new URL("../../src/lib/deal-copilot/dealAnalysis.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /refurb_budget:\s*pricing\.mid_total\b/,
    "dealAnalysis.ts must map refurb_budget directly from pricing.mid_total.",
  );

  for (const forbidden of [
    "pricing.mid_total ?? formData.refurbBudget",
    "pricing.mid_total || formData.refurbBudget",
    "formData.refurbBudget ?? pricing.mid_total",
    "formData.refurbBudget || pricing.mid_total",
    "pricing?.mid_total ?? formData.refurbBudget",
    "pricing?.mid_total || formData.refurbBudget",
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(escapeForRegExp(forbidden)),
      `Forbidden fallback detected in dealAnalysis.ts: ${forbidden}`,
    );
  }
});
