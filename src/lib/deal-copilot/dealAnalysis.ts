import {
  scoreDealOpportunity,
  runPricingEngine,
  runRoiEngine,
  type DealScoreInput,
  type PricingEngineInputs,
  type RoiEngineInputs,
} from "@repo/services";
import type { DealAnalysisResult, ParsedDealFormData } from "@repo/types";

/**
 * Orchestrate all three deterministic engines to produce complete deal analysis.
 *
 * **CRITICAL FLOW:**
 * 1. scoreDealOpportunity() — validation gate (customer underwriting fields)
 * 2. Meaningful pricing scope gate (non-empty categories)
 * 3. runPricingEngine() — get actual refurb cost
 * 4. Authoritative mid_total gate (finite, > 0)
 * 5. runRoiEngine() — consume pricing.mid_total as refurb_budget (NOT user-entered value)
 *
 * **Financial Authority Rule (DC-R1 Model A):**
 * - Customer-entered refurbBudget is the underwriting assumption until pricing is
 *   customer-meaningful / authoritative.
 * - Pricing is authoritative only when selected categories are non-empty AND
 *   mid_total is finite and > 0.
 * - WHEN analyzeDeal is ready (pricing-authoritative): ROI MUST consume
 *   pricing.mid_total only. No fallback to user refurbBudget.
 * - Empty categories / mid_total === 0 must never become ready authority.
 *
 * All calculation logic remains in @repo/services engines.
 * This layer only orchestrates, validates inputs, and maps between contracts.
 */

/**
 * True when pricing inputs and output are customer-meaningful enough to replace
 * the manual underwriting refurb assumption.
 */
export function isPricingAuthoritative(
  selectedCategories: readonly string[] | undefined | null,
  pricing: { mid_total?: number | null } | null | undefined,
): boolean {
  const hasScope = Array.isArray(selectedCategories) && selectedCategories.length > 0;
  if (!hasScope) return false;
  if (!pricing) return false;
  const mid = pricing.mid_total;
  return typeof mid === "number" && Number.isFinite(mid) && mid > 0;
}

export function analyzeDeal(formData: ParsedDealFormData): DealAnalysisResult {
  // Step 1: Validate deal readiness via scoreDealOpportunity()
  // NOTE: score uses user-entered refurbBudget for field readiness only.
  const scoreInput: DealScoreInput = {
    title: formData.title,
    purchasePrice: formData.purchasePrice,
    estimatedGdv: formData.estimatedGdv,
    refurbBudget: formData.refurbBudget,
    expectedMonthlyRent: formData.rentalIncome,
    region: formData.region,
    propertyCondition: formData.propertyCondition,
    holdingCosts: formData.holdingCosts,
  };

  const score = scoreDealOpportunity(scoreInput);

  // If deal is not ready (missing required fields), return early with validation errors
  if (!score.ready) {
    return {
      score,
      pricing: null,
      roi: null,
      ready: false,
      errors: score.missingFields,
    };
  }

  const selectedCategories = formData.selectedCategories ?? [];

  // Step 2: Meaningful pricing scope — empty categories are never authoritative.
  if (selectedCategories.length === 0) {
    return {
      score,
      pricing: null,
      roi: null,
      ready: false,
      errors: ["Pricing scope empty — category-based pricing not authoritative"],
    };
  }

  // Step 3: Run pricing engine
  const pricingInput: PricingEngineInputs = {
    region: formData.region,
    property_condition: formData.propertyCondition,
    finish_quality: formData.finishLevel || "Standard",
    selected_categories: selectedCategories,
    property_size_sqm: formData.propertySize || 100,
  };

  const pricing = runPricingEngine(pricingInput);

  // Step 4: Authoritative mid_total gate.
  // CRITICAL: Do NOT fall back to formData.refurbBudget.
  // mid_total === 0 / non-finite / missing → non-authoritative (not ready).
  if (!isPricingAuthoritative(selectedCategories, pricing)) {
    return {
      score,
      pricing: null,
      roi: null,
      ready: false,
      errors: ["Pricing engine did not return a meaningful mid_total — ROI calculation blocked"],
    };
  }

  // Step 5: Run ROI engine — refurb_budget is pricing.mid_total, no fallback permitted
  const roiInput: RoiEngineInputs = {
    purchase_price: formData.purchasePrice,
    refurb_budget: pricing.mid_total,
    estimated_gdv: formData.estimatedGdv,
    rental_income: formData.rentalIncome * 12,
    holding_costs: formData.holdingCosts,
    region: formData.region,
    property_condition: formData.propertyCondition,
  };

  const roi = runRoiEngine(roiInput);

  // Step 6: Compose authoritative pricing analysis
  return {
    score,
    pricing,
    roi,
    ready: true,
    errors: [],
  };
}

/**
 * Determine if deal analysis is complete enough for pricing-authoritative display.
 * Both score and pricing must be ready; ROI is gated on meaningful pricing.
 */
export function isDealAnalysisReady(analysis: DealAnalysisResult): boolean {
  return analysis.ready && analysis.score.ready;
}

/**
 * Extract pricing-relevant fields from analysis result for display.
 * Returns null if pricing was not run authoritatively.
 */
export function getPricingFromAnalysis(analysis: DealAnalysisResult) {
  return analysis.pricing;
}

/**
 * Extract ROI-relevant fields from analysis result.
 * Available only when analysis is pricing-authoritative ready.
 */
export function getRoiFromAnalysis(analysis: DealAnalysisResult) {
  return analysis.roi;
}
