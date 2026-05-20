/**
 * Scoring engine invariant tests.
 * Focused on result shape, regression against known values, and boundary conditions.
 * Detailed field-level coverage lives in dealScore.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { scoreDealOpportunity, getMissingDealFields } from "@repo/services";
import type { DealScoreInput } from "@repo/services";

import {
  standardFlipInput,
  standardFlipExpected,
  TOLERANCE,
} from "../../src/test/fixtures/deal-copilot/standard-flip";

function toScoreInput(f: typeof standardFlipInput): DealScoreInput {
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

const COMPLETE_INPUT = toScoreInput(standardFlipInput);

test("DealScoreResult shape — all required fields are present", () => {
  const result = scoreDealOpportunity(COMPLETE_INPUT);

  assert.ok("ready" in result, "result must have ready field");
  assert.ok("recommendation" in result, "result must have recommendation field");
  assert.ok("missingFields" in result, "result must have missingFields field");
  assert.ok("roiResult" in result, "result must have roiResult field");
  assert.ok("score" in result, "result must have score field");
  assert.ok("reasons" in result, "result must have reasons field");

  assert.equal(typeof result.ready, "boolean", "ready must be boolean");
  assert.equal(typeof result.recommendation, "string", "recommendation must be string");
  assert.ok(Array.isArray(result.missingFields), "missingFields must be an array");
  assert.ok(Array.isArray(result.reasons), "reasons must be an array");
});

test("incomplete input returns ready=false and populates missingFields", () => {
  const incomplete: DealScoreInput = {
    title: "Missing fields test",
    purchasePrice: 300000,
    // refurbBudget intentionally absent
    estimatedGdv: 400000,
    region: "London",
    propertyCondition: "Average",
  };

  const result = scoreDealOpportunity(incomplete);

  assert.equal(result.ready, false, "ready must be false for incomplete input");
  assert.ok(
    result.missingFields.length > 0,
    "missingFields must be non-empty for incomplete input",
  );
  assert.equal(result.score, null, "score must be null when not ready");
  assert.equal(result.roiResult, null, "roiResult must be null when not ready");
  assert.deepEqual(result.reasons, [], "reasons must be empty when not ready");
});

test("incomplete input — getMissingDealFields lists exact missing fields", () => {
  const missingRefurb: DealScoreInput = {
    title: "No refurb budget",
    purchasePrice: 300000,
    estimatedGdv: 400000,
    region: "London",
    propertyCondition: "Average",
  };

  const fields = getMissingDealFields(missingRefurb);
  assert.ok(
    fields.includes("Refurb budget"),
    `Expected "Refurb budget" in missingFields, got: [${fields.join(", ")}]`,
  );
});

test("identical inputs return identical score (determinism)", () => {
  const a = scoreDealOpportunity(COMPLETE_INPUT);
  const b = scoreDealOpportunity({ ...COMPLETE_INPUT });

  assert.deepEqual(a, b, "scoreDealOpportunity must be deterministic");
});

test("valid input returns score in expected range [1–10]", () => {
  const result = scoreDealOpportunity(COMPLETE_INPUT);

  assert.equal(result.ready, true, "standardFlip must be ready");
  assert.ok(result.roiResult !== null, "roiResult must not be null for valid input");

  const score = result.roiResult.investment_score;
  assert.equal(Number.isFinite(score), true, "investment_score must be finite");
  assert.ok(score >= 1 && score <= 10, `investment_score ${score} must be clamped to [1, 10]`);

  // score convenience field mirrors roiResult.investment_score
  assert.equal(result.score, score, "score must mirror roiResult.investment_score");
});

test("regression — standardFlip investment_score matches known expected value", () => {
  const result = scoreDealOpportunity(COMPLETE_INPUT);

  assert.ok(result.roiResult !== null, "roiResult must exist for regression check");

  const score = result.roiResult.investment_score;
  const expected = standardFlipExpected.score.investment_score;

  assert.ok(
    Math.abs(score - expected) <= TOLERANCE,
    `Regression: investment_score drifted from ${expected} to ${score} (tolerance ±${TOLERANCE})`,
  );
});

test("regression — standardFlip recommendation matches known expected value", () => {
  const result = scoreDealOpportunity(COMPLETE_INPUT);

  assert.equal(
    result.recommendation,
    standardFlipExpected.score.recommendation,
    `Regression: recommendation changed from "${standardFlipExpected.score.recommendation}" to "${result.recommendation}"`,
  );
});

test("invalid input (zero/negative numbers) does not silently score", () => {
  const zeroPurchase: DealScoreInput = { ...COMPLETE_INPUT, purchasePrice: 0 };
  const negGdv: DealScoreInput = { ...COMPLETE_INPUT, estimatedGdv: -1 };
  const negRefurb: DealScoreInput = { ...COMPLETE_INPUT, refurbBudget: -500 };

  for (const [label, input] of [
    ["zero purchasePrice", zeroPurchase],
    ["negative estimatedGdv", negGdv],
    ["negative refurbBudget", negRefurb],
  ] as [string, DealScoreInput][]) {
    const result = scoreDealOpportunity(input);
    assert.equal(result.ready, false, `${label} must produce ready=false`);
    assert.equal(result.score, null, `${label} must produce score=null`);
    assert.ok(result.missingFields.length > 0, `${label} must produce non-empty missingFields`);
  }
});

test("reasons array is non-empty and all strings for a scored result", () => {
  const result = scoreDealOpportunity(COMPLETE_INPUT);

  assert.ok(result.reasons.length > 0, "reasons must be non-empty for a complete result");
  for (const r of result.reasons) {
    assert.equal(typeof r, "string", "every reason must be a string");
    assert.ok(r.length > 0, "no reason should be an empty string");
  }
});
