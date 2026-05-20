import assert from "node:assert/strict";
import test from "node:test";

import { getMissingDealFields, scoreDealOpportunity } from "@repo/services";
import type { DealScoreInput } from "@repo/services";
import type { ParsedDealFormData } from "@repo/types";

import {
  fullRenovationInput,
  incompleteDealInput,
  largeProjectInput,
  negativeProfitInput,
  smallProjectInput,
} from "../../src/test/fixtures/deal-copilot/edge-cases";
import { standardFlipInput } from "../../src/test/fixtures/deal-copilot/standard-flip";

/** Convert ParsedDealFormData → DealScoreInput (scoreDealOpportunity uses refurbBudget directly). */
function asDealScoreInput(f: ParsedDealFormData): DealScoreInput {
  return {
    title: f.title,
    purchasePrice: f.purchasePrice,
    refurbBudget: f.refurbBudget,
    estimatedGdv: f.estimatedGdv,
    expectedMonthlyRent: f.rentalIncome,
    holdingCosts: f.holdingCosts,
    region: f.region,
    propertyCondition: f.propertyCondition,
  };
}

test("incomplete input returns ready=false, recommendation=Incomplete, roiResult=null", () => {
  // incompleteDealInput is Partial — missing refurbBudget
  const input: DealScoreInput = {
    title: incompleteDealInput.title!,
    purchasePrice: incompleteDealInput.purchasePrice,
    // refurbBudget intentionally omitted
    estimatedGdv: incompleteDealInput.estimatedGdv,
    region: incompleteDealInput.region!,
    propertyCondition: incompleteDealInput.propertyCondition!,
  };

  const result = scoreDealOpportunity(input);

  assert.equal(result.ready, false, "ready must be false for incomplete input");
  assert.equal(result.recommendation, "Incomplete");
  assert.equal(result.roiResult, null);
  assert.equal(result.score, null);
  assert.deepEqual(result.reasons, []);
  assert.ok(result.missingFields.length > 0, "missingFields must be non-empty");
});

test("missingFields lists exactly the absent field names", () => {
  const input: DealScoreInput = {
    title: "Test property",
    purchasePrice: 300000,
    // refurbBudget missing
    estimatedGdv: 400000,
    region: "London",
    propertyCondition: "Average",
  };

  const fields = getMissingDealFields(input);

  assert.ok(
    fields.includes("Refurb budget"),
    `Expected "Refurb budget" in missingFields, got [${fields.join(", ")}]`,
  );
  assert.ok(!fields.includes("Title"), "Title should not be listed as missing");
  assert.ok(!fields.includes("Purchase price"), "Purchase price should not be listed as missing");
});

test("identical inputs return identical score (determinism)", () => {
  const input = asDealScoreInput(standardFlipInput);

  const a = scoreDealOpportunity(input);
  const b = scoreDealOpportunity({ ...input });

  assert.deepEqual(a, b, "scoreDealOpportunity must be deterministic for identical inputs");
});

test("complete valid input returns ready=true with a numeric score between 1 and 10", () => {
  const input = asDealScoreInput(standardFlipInput);
  const result = scoreDealOpportunity(input);

  assert.equal(result.ready, true);
  assert.ok(result.roiResult !== null, "roiResult must not be null for a complete input");
  assert.equal(
    Number.isFinite(result.roiResult.investment_score),
    true,
    "investment_score must be finite",
  );
  assert.ok(
    result.roiResult.investment_score >= 1 && result.roiResult.investment_score <= 10,
    `investment_score ${result.roiResult.investment_score} must be clamped 1–10`,
  );

  // score convenience field mirrors roiResult.investment_score
  assert.equal(result.score, result.roiResult.investment_score);

  // reasons is non-empty for a scored result
  assert.ok(result.reasons.length > 0, "reasons must be populated for a scored result");
  assert.equal(typeof result.reasons[0], "string");
});

test("extreme but valid inputs do not crash and return ready=true", () => {
  const extremeFixtures: ParsedDealFormData[] = [
    largeProjectInput,
    smallProjectInput,
    fullRenovationInput,
    negativeProfitInput, // valid numbers, but deal makes a loss — must still score safely
  ];

  for (const fixture of extremeFixtures) {
    const input = asDealScoreInput(fixture);
    let result: ReturnType<typeof scoreDealOpportunity> | undefined;

    assert.doesNotThrow(() => {
      result = scoreDealOpportunity(input);
    }, `scoreDealOpportunity should not throw for: ${fixture.title}`);

    assert.equal(result!.ready, true, `${fixture.title} — all fields present, ready must be true`);
    assert.ok(result!.roiResult !== null, `${fixture.title} — roiResult must not be null`);
  }
});

test("zero or negative financial inputs are caught as invalid and do not silently score", () => {
  const base = asDealScoreInput(standardFlipInput);

  // Zero purchase price
  const zeroPurchase: DealScoreInput = { ...base, purchasePrice: 0 };
  const zeroFields = getMissingDealFields(zeroPurchase);
  assert.ok(
    zeroFields.includes("Purchase price"),
    "Zero purchase price must appear in missingFields",
  );
  const zeroResult = scoreDealOpportunity(zeroPurchase);
  assert.equal(zeroResult.ready, false, "Zero purchase price must produce ready=false");

  // Negative estimated GDV
  const negGdv: DealScoreInput = { ...base, estimatedGdv: -1 };
  const negGdvFields = getMissingDealFields(negGdv);
  assert.ok(negGdvFields.includes("Estimated GDV"), "Negative GDV must appear in missingFields");
  const negGdvResult = scoreDealOpportunity(negGdv);
  assert.equal(negGdvResult.ready, false, "Negative GDV must produce ready=false");

  // Negative refurb budget
  const negRefurb: DealScoreInput = { ...base, refurbBudget: -500 };
  const negRefurbFields = getMissingDealFields(negRefurb);
  assert.ok(
    negRefurbFields.includes("Refurb budget"),
    "Negative refurb budget must appear in missingFields",
  );
  const negRefurbResult = scoreDealOpportunity(negRefurb);
  assert.equal(negRefurbResult.ready, false, "Negative refurb budget must produce ready=false");
});
