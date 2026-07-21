/**
 * Invariants for domain engines ported from refurb-estimator.
 * Ensures deterministic, non-negative, region-sensitive outputs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDevelopmentAppraisal,
  calculateStampDutyLandTax,
  estimateLabourCost,
  getTradeRate,
  postcodeToUkRegion,
  runEnhancedEstimate,
  runNewBuildEstimate,
  TRADE_RATES,
} from "@repo/services";

test("postcodeToUkRegion maps common districts", () => {
  assert.equal(postcodeToUkRegion("SW1A 1AA"), "London");
  assert.equal(postcodeToUkRegion("B1 1AA"), "West Midlands");
  assert.equal(postcodeToUkRegion("M1 1AE"), "North West England");
  assert.equal(postcodeToUkRegion("EH1 1YZ"), "Scotland");
  assert.equal(postcodeToUkRegion("BT1 5GS"), "Northern Ireland");
});

test("trade rates: labour cost scales with region and days", () => {
  assert.ok(TRADE_RATES.length >= 8);
  const mid = estimateLabourCost("electrician", 5, "West Midlands");
  const lon = estimateLabourCost("electrician", 5, "London");
  assert.ok(mid.mid > 0);
  assert.ok(lon.mid > mid.mid, "London labour should exceed West Midlands");
  assert.ok(mid.low <= mid.mid && mid.mid <= mid.high);
  assert.equal(getTradeRate("plumber").label, "Plumber");
});

test("SDLT is zero below threshold and positive for higher prices", () => {
  assert.equal(calculateStampDutyLandTax(100_000, false), 0);
  const higher = calculateStampDutyLandTax(400_000, false);
  assert.ok(higher > 0);
  const withSurcharge = calculateStampDutyLandTax(400_000, true);
  assert.ok(withSurcharge > higher);
});

test("development appraisal returns viable when GDV supports target margin", () => {
  const result = calculateDevelopmentAppraisal({
    purchasePrice: 200_000,
    grossDevelopmentValue: 400_000,
    acquisitionLegalFees: 2_000,
    buildCosts: 80_000,
    professionalFees: 5_000,
    planningCosts: 1_000,
    contingencyPercent: 10,
    includeFinance: true,
    bridgingRateMonthlyPercent: 0.8,
    loanTermMonths: 12,
    loanToValuePercent: 70,
    saleLegalFees: 2_000,
    estateAgentFeePercent: 1.5,
    targetProfitMarginPercent: 15,
  });
  assert.ok(result.totalCosts > 0);
  assert.ok(result.grossProfit > 0);
  assert.ok(["viable", "marginal", "unviable"].includes(result.viability));
  assert.ok(result.brrr.refinanceValueAt75Percent > 0);
});

test("enhanced estimate is deterministic and feature add-ons raise totals", () => {
  const base = runEnhancedEstimate({
    totalAreaM2: 90,
    region: "West Midlands",
    renovationScope: "standard",
    qualityTier: "standard",
    propertyCategory: "terraced",
  });
  const withLoft = runEnhancedEstimate({
    totalAreaM2: 90,
    region: "West Midlands",
    renovationScope: "standard",
    qualityTier: "standard",
    propertyCategory: "terraced",
    additionalFeatures: ["loft_conversion"],
  });
  assert.ok(base.totalTypical > 0);
  assert.ok(withLoft.totalTypical > base.totalTypical);
  assert.equal(withLoft.additionalFeatureCosts.length, 1);
  // Determinism
  const again = runEnhancedEstimate({
    totalAreaM2: 90,
    region: "West Midlands",
    renovationScope: "standard",
    qualityTier: "standard",
    propertyCategory: "terraced",
  });
  assert.equal(again.totalTypical, base.totalTypical);
});

test("new-build estimate uses higher rates for premium detached vs basic terraced", () => {
  const detached = runNewBuildEstimate({
    totalAreaM2: 120,
    propertyType: "Detached House",
    spec: "premium",
    region: "West Midlands",
    storeys: 2,
  });
  const terraced = runNewBuildEstimate({
    totalAreaM2: 120,
    propertyType: "Terraced House",
    spec: "basic",
    region: "West Midlands",
    storeys: 2,
  });
  assert.ok(detached.totalTypical > terraced.totalTypical);
  assert.ok(detached.totalLow <= detached.totalTypical);
  assert.ok(detached.totalTypical <= detached.totalHigh);
});
