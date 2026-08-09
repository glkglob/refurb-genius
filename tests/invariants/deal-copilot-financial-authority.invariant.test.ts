/**
 * DC-R1 — Deal Copilot financial authority (Model A).
 *
 * Protects:
 * - empty/zero pricing never becomes ROI authority
 * - manual underwriting drives TPC/profit/ROI/score/Save readiness
 * - meaningful pricing still owns ROI refurb when ready
 * - Save persists customer refurb, not engine zero
 */
import assert from "node:assert/strict";
import test from "node:test";

import { scoreDealOpportunity } from "@repo/services";
import { createDealOpportunity, type ParsedDealFormData } from "@repo/types";

import { analyzeDeal, isPricingAuthoritative } from "../../src/lib/deal-copilot/dealAnalysis";
import { emptyPricingScopeInput } from "../../src/test/fixtures/deal-copilot/edge-cases";
import {
  PRICING_AUTHORITY_CATEGORIES,
  standardFlipInput,
} from "../../src/test/fixtures/deal-copilot/standard-flip";

/** Regression A — exact PR-03 / DC-R1 synthetic underwriting inputs */
const REGRESSION_A = {
  title: "DC-R1 Synthetic Leeds",
  purchasePrice: 180_000,
  estimatedGdv: 250_000,
  refurbBudget: 40_000,
  expectedMonthlyRent: 1_200,
  holdingCosts: 6_000,
  region: "Yorkshire and the Humber" as const,
  propertyCondition: "Average" as const,
};

const REGRESSION_A_EXPECTED = {
  effectiveRefurb: 40_000,
  tpc: 226_000,
  profit: 24_000,
  roi: 10.6,
  annualRent: 14_400,
  grossYield: 6.4,
};

function manualScore(overrides: Partial<typeof REGRESSION_A> = {}) {
  const input = { ...REGRESSION_A, ...overrides };
  return scoreDealOpportunity({
    title: input.title,
    purchasePrice: input.purchasePrice,
    estimatedGdv: input.estimatedGdv,
    refurbBudget: input.refurbBudget,
    expectedMonthlyRent: input.expectedMonthlyRent,
    holdingCosts: input.holdingCosts,
    region: input.region,
    propertyCondition: input.propertyCondition,
  });
}

/**
 * Mirrors DealIntakeForm effective-refurb selection (single source).
 */
function resolveEffectiveRefurb(
  customerRefurb: number | undefined,
  analysis: ReturnType<typeof analyzeDeal> | null,
  selectedCategories: readonly string[] | undefined,
): { pricingAuthoritative: boolean; effectiveRefurb: number | undefined } {
  const pricingAuthoritative = Boolean(
    analysis?.ready &&
    analysis.pricing &&
    isPricingAuthoritative(selectedCategories, analysis.pricing),
  );
  return {
    pricingAuthoritative,
    effectiveRefurb: pricingAuthoritative ? Number(analysis!.pricing!.mid_total) : customerRefurb,
  };
}

test("Regression A — manual underwriting numbers with rent", () => {
  const score = manualScore();
  assert.equal(score.ready, true, "Save must be enabled for complete underwriting");
  assert.ok(score.roiResult);
  const r = score.roiResult!;
  assert.equal(r.total_project_cost, REGRESSION_A_EXPECTED.tpc);
  assert.equal(r.estimated_profit, REGRESSION_A_EXPECTED.profit);
  assert.equal(r.roi, REGRESSION_A_EXPECTED.roi);
  assert.equal(r.gross_yield, REGRESSION_A_EXPECTED.grossYield);
  assert.equal(score.recommendation, "Reject");
  // Must not look like the pre-fix zero-refurb path
  assert.notEqual(r.roi, 34.4);
  assert.notEqual(r.estimated_profit, 64_000);
  assert.notEqual(r.total_project_cost, 186_000);
});

test("Regression B — rent omitted: Save still ready, TPC/profit/ROI same economics", () => {
  const withRent = manualScore();
  const withoutRent = scoreDealOpportunity({
    title: REGRESSION_A.title,
    purchasePrice: REGRESSION_A.purchasePrice,
    estimatedGdv: REGRESSION_A.estimatedGdv,
    refurbBudget: REGRESSION_A.refurbBudget,
    // expectedMonthlyRent omitted
    holdingCosts: REGRESSION_A.holdingCosts,
    region: REGRESSION_A.region,
    propertyCondition: REGRESSION_A.propertyCondition,
  });
  assert.equal(withoutRent.ready, true);
  assert.equal(withoutRent.roiResult!.total_project_cost, withRent.roiResult!.total_project_cost);
  assert.equal(withoutRent.roiResult!.estimated_profit, withRent.roiResult!.estimated_profit);
  assert.equal(withoutRent.roiResult!.roi, withRent.roiResult!.roi);
});

test("Regression A path with empty categories — analyzeDeal non-authoritative", () => {
  const formData: ParsedDealFormData = {
    title: REGRESSION_A.title,
    purchasePrice: REGRESSION_A.purchasePrice,
    estimatedGdv: REGRESSION_A.estimatedGdv,
    refurbBudget: REGRESSION_A.refurbBudget,
    rentalIncome: REGRESSION_A.expectedMonthlyRent,
    holdingCosts: REGRESSION_A.holdingCosts,
    region: REGRESSION_A.region,
    propertyCondition: REGRESSION_A.propertyCondition,
    selectedCategories: [],
  };
  const analysis = analyzeDeal(formData);
  assert.equal(analysis.ready, false);
  assert.equal(analysis.roi, null);
  assert.equal(analysis.pricing, null);

  const { pricingAuthoritative, effectiveRefurb } = resolveEffectiveRefurb(
    REGRESSION_A.refurbBudget,
    analysis,
    [],
  );
  assert.equal(pricingAuthoritative, false);
  assert.equal(effectiveRefurb, 40_000);

  // Score with effective (customer) refurb matches manual path and enables Save
  const score = scoreDealOpportunity({
    title: formData.title,
    purchasePrice: formData.purchasePrice,
    estimatedGdv: formData.estimatedGdv,
    refurbBudget: effectiveRefurb,
    expectedMonthlyRent: formData.rentalIncome,
    holdingCosts: formData.holdingCosts,
    region: formData.region,
    propertyCondition: formData.propertyCondition,
  });
  assert.equal(score.ready, true);
  assert.equal(score.roiResult!.total_project_cost, 226_000);
  assert.equal(score.roiResult!.roi, 10.6);
});

test("Regression C — meaningful categories: ROI refurb === mid_total", () => {
  const analysis = analyzeDeal(standardFlipInput);
  assert.equal(analysis.ready, true);
  assert.ok(analysis.pricing);
  assert.ok(analysis.roi);
  assert.ok(analysis.pricing.mid_total > 0);
  assert.equal(analysis.roi.inputs.refurb_budget, analysis.pricing.mid_total);
  assert.notEqual(analysis.roi.inputs.refurb_budget, standardFlipInput.refurbBudget);

  const { pricingAuthoritative, effectiveRefurb } = resolveEffectiveRefurb(
    standardFlipInput.refurbBudget,
    analysis,
    PRICING_AUTHORITY_CATEGORIES,
  );
  assert.equal(pricingAuthoritative, true);
  assert.equal(effectiveRefurb, analysis.pricing.mid_total);
});

test("D/E — empty categories and mid_total 0 are non-authoritative", () => {
  assert.equal(isPricingAuthoritative([], { mid_total: 0 }), false);
  assert.equal(isPricingAuthoritative(undefined, { mid_total: 100 }), false);
  assert.equal(isPricingAuthoritative(PRICING_AUTHORITY_CATEGORIES, { mid_total: 0 }), false);
  assert.equal(isPricingAuthoritative(PRICING_AUTHORITY_CATEGORIES, { mid_total: -1 }), false);
  assert.equal(
    isPricingAuthoritative(PRICING_AUTHORITY_CATEGORIES, { mid_total: Number.NaN }),
    false,
  );
  assert.equal(isPricingAuthoritative(PRICING_AUTHORITY_CATEGORIES, null), false);

  const empty = analyzeDeal(emptyPricingScopeInput);
  assert.equal(empty.ready, false);
  assert.equal(empty.roi, null);
});

test("invalid customer refurb keeps Save disabled", () => {
  for (const refurb of [undefined, 0, -5] as const) {
    const score = scoreDealOpportunity({
      title: REGRESSION_A.title,
      purchasePrice: REGRESSION_A.purchasePrice,
      estimatedGdv: REGRESSION_A.estimatedGdv,
      refurbBudget: refurb as number | undefined,
      expectedMonthlyRent: REGRESSION_A.expectedMonthlyRent,
      holdingCosts: REGRESSION_A.holdingCosts,
      region: REGRESSION_A.region,
      propertyCondition: REGRESSION_A.propertyCondition,
    });
    assert.equal(score.ready, false, `refurb=${String(refurb)} must not be Save-ready`);
    assert.ok(score.missingFields.includes("Refurb budget"));
  }
});

test("metrics/score consistency — same effective refurb drives TPC/profit/ROI", () => {
  const score = manualScore();
  const r = score.roiResult!;
  // Single engine path — score panel and metrics would both use score.roiResult
  assert.equal(r.inputs.refurb_budget, REGRESSION_A.refurbBudget);
  assert.equal(
    r.total_project_cost,
    REGRESSION_A.purchasePrice + REGRESSION_A.refurbBudget + REGRESSION_A.holdingCosts,
  );
  assert.equal(r.estimated_profit, REGRESSION_A.estimatedGdv - r.total_project_cost);
});

test("Save persistence uses customer refurb not engine zero", () => {
  const opportunity = createDealOpportunity({
    title: REGRESSION_A.title,
    purchasePrice: REGRESSION_A.purchasePrice,
    estimatedGdv: REGRESSION_A.estimatedGdv,
    expectedMonthlyRent: REGRESSION_A.expectedMonthlyRent,
    refurbBudget: REGRESSION_A.refurbBudget,
  });
  assert.equal(opportunity.refurbBudget, 40_000);
  assert.notEqual(opportunity.refurbBudget, 0);
});
