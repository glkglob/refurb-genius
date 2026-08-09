/**
 * Standard house flip scenario.
 * Used for regression testing to detect calculation drift.
 *
 * DC-R1: pricing-authoritative fixtures MUST supply non-empty selectedCategories
 * so mid_total is finite and > 0. Empty-category behavior is tested separately.
 */
import type { ParsedDealFormData, DealAnalysisResult, EstimateCategory } from "@repo/types";

/** Shared meaningful pricing scope for authoritative analyzeDeal fixtures. */
export const PRICING_AUTHORITY_CATEGORIES: EstimateCategory[] = ["Kitchen", "Bathroom", "Flooring"];

export const standardFlipInput: ParsedDealFormData = {
  title: "3-bed terrace, Croydon",
  purchasePrice: 350000,
  refurbBudget: 55000,
  estimatedGdv: 475000,
  rentalIncome: 1500, // £1,500/month
  holdingCosts: 8000,
  region: "London",
  propertyCondition: "Average",
  selectedCategories: PRICING_AUTHORITY_CATEGORIES,
  propertySize: 100,
};

/**
 * Expected pricing-authoritative output from deterministic engines.
 *
 * Derived with selectedCategories Kitchen/Bathroom/Flooring, size 100 m², London, Average, Standard:
 * - pricing.mid_total = 43771 (runPricingEngine)
 * - TPC = 350000 + 43771 + 8000 = 401771
 * - profit = 475000 - 401771 = 73229
 * - ROI = 73229/401771 * 100 → 18.2%
 * - investment_score / yield from runRoiEngine (rental_income = 1500*12 as current income)
 * - score.recommendation uses scoreDealOpportunity on user refurb 55000 → Reject
 */
export const standardFlipExpected = {
  score: {
    ready: true,
    recommendation: "Reject" as const,
    roi: 18.2,
    estimated_profit: 73229,
    investment_score: 6.6,
    risk_level: "Moderate" as const,
    gross_yield: 10.1,
    pricing_mid_total: 43771,
  },
};

/**
 * Manual underwriting expectations (no pricing authority) for the same economics
 * with customer refurbBudget 55000 and rent 1500/mo via scoreDealOpportunity.
 * TPC = 350000+55000+8000 = 413000; profit = 62000; ROI = 15.0%
 */
export const standardFlipManualUnderwritingExpected = {
  total_project_cost: 413000,
  estimated_profit: 62000,
  roi: 15.0,
  investment_score: 4.3,
  recommendation: "Reject" as const,
};

/**
 * Tolerance for floating-point comparisons.
 * Engine outputs are rounded to 1 decimal place for ROI/yield.
 */
export const TOLERANCE = 0.1;

/**
 * Verify standard flip pricing-authoritative output against known expected values.
 */
export function validateStandardFlip(result: DealAnalysisResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!result.ready) {
    errors.push("Analysis should be ready for standard flip input with pricing categories");
  }

  if (
    result.pricing?.mid_total !== undefined &&
    Math.abs(result.pricing.mid_total - standardFlipExpected.score.pricing_mid_total) > 1
  ) {
    errors.push(
      `mid_total drift: expected ${standardFlipExpected.score.pricing_mid_total}, got ${result.pricing.mid_total}`,
    );
  }

  if (
    result.roi?.roi !== undefined &&
    Math.abs(result.roi.roi - standardFlipExpected.score.roi) > TOLERANCE
  ) {
    errors.push(`ROI drift: expected ${standardFlipExpected.score.roi}%, got ${result.roi.roi}%`);
  }

  if (
    result.roi?.estimated_profit !== undefined &&
    Math.abs(result.roi.estimated_profit - standardFlipExpected.score.estimated_profit) > 1000
  ) {
    errors.push(
      `Profit drift: expected £${standardFlipExpected.score.estimated_profit}, got £${result.roi.estimated_profit}`,
    );
  }

  if (
    result.roi?.investment_score !== undefined &&
    Math.abs(result.roi.investment_score - standardFlipExpected.score.investment_score) > TOLERANCE
  ) {
    errors.push(
      `Investment score drift: expected ${standardFlipExpected.score.investment_score}/10, got ${result.roi.investment_score}/10`,
    );
  }

  if (result.score.recommendation !== standardFlipExpected.score.recommendation) {
    errors.push(
      `Recommendation drift: expected "${standardFlipExpected.score.recommendation}", got "${result.score.recommendation}"`,
    );
  }

  if (
    result.ready &&
    result.roi &&
    result.pricing &&
    result.roi.inputs.refurb_budget !== result.pricing.mid_total
  ) {
    errors.push(
      `Authority drift: ROI refurb ${result.roi.inputs.refurb_budget} !== mid_total ${result.pricing.mid_total}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
