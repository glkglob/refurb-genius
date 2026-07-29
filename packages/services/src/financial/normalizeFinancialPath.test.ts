/**
 * P0-1 — Financial path normalizer unit tests.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFinancialPath,
  FINANCIALS_PATH_DEFAULT_POLICY,
  normalizeFinancialPath,
  type FinancialPathInput,
} from "./normalizeFinancialPath.ts";
import { runRoiEngine } from "../roi";

const BASE_COMPLETE: FinancialPathInput = {
  purchase_price: 200_000,
  estimated_gdv: 280_000,
  mid_total: 40_000,
  region: "West Midlands",
  property_condition: "Dated",
  holding_costs: 1_000,
  rental_income: 6_000,
};

test("alias equivalence — camelCase and snake_case yield identical roiInputs", () => {
  const snake = normalizeFinancialPath({
    purchase_price: 100_000,
    estimated_gdv: 150_000,
    refurb_budget: 20_000,
    region: "London",
    property_condition: "Average",
    holding_costs: 500,
    rental_income: 0,
  });
  const camel = normalizeFinancialPath({
    purchasePrice: 100_000,
    estimatedGdv: 150_000,
    refurbBudget: 20_000,
    region: "London",
    propertyCondition: "Average",
    holdingCosts: 500,
    rentalIncomeAnnual: 0,
  });
  assert.deepEqual(snake.roiInputs, camel.roiInputs);
});

test("alias precedence — snake_case purchase_price beats conflicting purchasePrice", () => {
  const { roiInputs, meta } = normalizeFinancialPath({
    purchase_price: 100_000,
    purchasePrice: 999_999,
    estimated_gdv: 150_000,
    mid_total: 10_000,
  });
  assert.equal(roiInputs.purchase_price, 100_000);
  assert.ok(meta.warnings.some((w) => w.includes("purchase_price")));
});

test("rental conversion — expectedMonthlyRent 1000 → projected annual 12000", () => {
  const { roiInputs } = normalizeFinancialPath({
    ...BASE_COMPLETE,
    expectedMonthlyRent: 1000,
    projected_rental_income: undefined,
  });
  assert.equal(roiInputs.projected_rental_income, 12_000);
});

test("rental conversion — explicit projected_rental_income beats monthly", () => {
  const { roiInputs, meta } = normalizeFinancialPath({
    ...BASE_COMPLETE,
    projected_rental_income: 18_000,
    expectedMonthlyRent: 1000,
  });
  assert.equal(roiInputs.projected_rental_income, 18_000);
  assert.ok(meta.warnings.some((w) => w.includes("projected_rental_income")));
});

test("default policy — missing values apply Average/London/0 holding/0 rental", () => {
  const { roiInputs, meta, timelineWeeks } = normalizeFinancialPath({
    purchasePrice: 50_000,
    estimatedGdv: 80_000,
  });
  assert.equal(roiInputs.region, "London");
  assert.equal(roiInputs.property_condition, "Average");
  assert.equal(roiInputs.holding_costs, 0);
  assert.equal(roiInputs.rental_income, 0);
  assert.equal(roiInputs.refurb_budget, 0);
  assert.equal(timelineWeeks, 8);
  assert.ok(meta.usedDefaults.includes("region"));
  assert.ok(meta.usedDefaults.includes("property_condition"));
  assert.ok(meta.usedDefaults.includes("holding_costs"));
  assert.ok(meta.usedDefaults.includes("rental_income"));
  assert.ok(meta.usedDefaults.includes("timelineWeeks"));
});

test("numeric safety — null/undefined/NaN/Infinity do not reach engine as unsafe values", () => {
  const { roiInputs } = normalizeFinancialPath({
    purchase_price: null,
    estimated_gdv: undefined,
    mid_total: Number.NaN,
    holding_costs: Number.POSITIVE_INFINITY,
    rental_income: Number.NEGATIVE_INFINITY,
    region: null,
    property_condition: undefined,
  });
  assert.equal(roiInputs.purchase_price, 0);
  assert.equal(roiInputs.estimated_gdv, 0);
  assert.equal(roiInputs.refurb_budget, 0);
  assert.equal(roiInputs.holding_costs, FINANCIALS_PATH_DEFAULT_POLICY.defaultHoldingCosts);
  assert.equal(roiInputs.rental_income, FINANCIALS_PATH_DEFAULT_POLICY.defaultRentalIncome);
  assert.equal(roiInputs.region, "London");
  assert.equal(roiInputs.property_condition, "Average");
  // runRoiEngine must accept without throw
  assert.doesNotThrow(() => runRoiEngine(roiInputs));
});

test("refurb authority — mid_total wins over refurbBudget", () => {
  const { roiInputs, meta } = normalizeFinancialPath({
    purchase_price: 100_000,
    estimated_gdv: 200_000,
    mid_total: 33_000,
    refurbBudget: 99_000,
  });
  assert.equal(roiInputs.refurb_budget, 33_000);
  assert.ok(meta.warnings.some((w) => w.includes("mid_total")));
});

test("calculation delegation — runRoiEngine once; financials match engine", () => {
  const input: FinancialPathInput = {
    purchase_price: 200_000,
    estimated_gdv: 300_000,
    mid_total: 50_000,
    region: "London",
    property_condition: "Average",
    holding_costs: 0,
    rental_income: 0,
  };
  const result = calculateFinancialPath(input);
  const direct = runRoiEngine(result.roiInputs);

  assert.deepEqual(result.roiResult, direct);
  assert.equal(result.financials.totalProjectCost, direct.total_project_cost);
  assert.equal(result.financials.estimatedProfit, direct.estimated_profit);
  assert.equal(result.financials.roiPercent, direct.roi);
  assert.equal(result.financials.grossYield, direct.gross_yield);
  assert.equal(result.financials.investmentScore, direct.investment_score);
  assert.equal(result.financials.riskLevel, direct.risk_level.toLowerCase());
  assert.equal(result.financials.refurbBudget, 50_000);
  assert.equal(result.financials.purchasePrice, 200_000);
  assert.equal(result.financials.estimatedGdv, 300_000);
});

test("ROI precision — one-decimal engine result preserved (no Math.round)", () => {
  // Construct inputs that produce a non-integer ROI (engine uses toFixed(1)).
  const result = calculateFinancialPath({
    purchase_price: 250_000,
    estimated_gdv: 310_000,
    mid_total: 45_000,
    region: "London",
    property_condition: "Average",
    holding_costs: 0,
    rental_income: 0,
  });
  const engineRoi = result.roiResult.roi;
  assert.equal(result.financials.roiPercent, engineRoi);
  // Engine stores one-decimal number; must not be integer-rounded away.
  assert.equal(result.financials.roiPercent, Number(engineRoi.toFixed(1)));
  // If engine produced a fractional display value, Financials must not collapse to Math.round.
  if (engineRoi % 1 !== 0) {
    assert.notEqual(result.financials.roiPercent, Math.round(engineRoi));
  }
});

test("timeline — default fallback remains 8 weeks", () => {
  const a = calculateFinancialPath({
    purchase_price: 100_000,
    estimated_gdv: 120_000,
    mid_total: 10_000,
  });
  assert.equal(a.financials.timelineWeeks, 8);

  const b = calculateFinancialPath({
    purchase_price: 100_000,
    estimated_gdv: 120_000,
    mid_total: 10_000,
    timelineWeeks: 12,
  });
  assert.equal(b.financials.timelineWeeks, 12);
});

test("caller policy overrides default Financials policy", () => {
  const { roiInputs, meta } = normalizeFinancialPath(
    { purchase_price: 1, estimated_gdv: 2 },
    {
      defaultRegion: "Scotland",
      defaultPropertyCondition: "Poor",
      defaultHoldingCosts: 250,
      defaultRentalIncome: 100,
      defaultTimelineWeeks: 10,
    },
  );
  assert.equal(roiInputs.region, "Scotland");
  assert.equal(roiInputs.property_condition, "Poor");
  assert.equal(roiInputs.holding_costs, 250);
  assert.equal(roiInputs.rental_income, 100);
  assert.ok(meta.usedDefaults.includes("region"));
});
