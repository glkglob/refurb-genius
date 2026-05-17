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
 * 1. scoreDealOpportunity() — validation gate
 * 2. runPricingEngine() — get actual refurb cost
 * 3. runRoiEngine() — consume pricing.mid_total as refurb_budget (NOT user-entered value)
 *
 * **Financial Authority Rule:**
 * ROI MUST consume pricing output. The user-entered refurbBudget is an initial assumption only.
 * Once pricing runs, its mid_total becomes the canonical refurb_budget for ROI calculation.
 *
 * All calculation logic remains in @repo/services engines.
 * This layer only orchestrates, validates inputs, and maps between contracts.
 */
export function analyzeDeal(formData: ParsedDealFormData): DealAnalysisResult {
  // Step 1: Validate deal readiness via scoreDealOpportunity()
  // This gives us recommendation + missing fields status.
  // NOTE: The scoreInput still uses user-entered refurbBudget for initial validation.
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

  // Step 2: Run pricing engine — canonical refurb cost authority
  const pricingInput: PricingEngineInputs = {
    region: formData.region,
    property_condition: formData.propertyCondition,
    finish_quality: formData.finishLevel || "Standard",
    selected_categories: formData.selectedCategories || [],
    property_size_sqm: formData.propertySize || 100,
  };

  const pricing = runPricingEngine(pricingInput);

  // CRITICAL: If pricing cannot produce a result, ROI must not run.
  // ROI is only permitted to consume pricing.mid_total — never the user-entered refurbBudget.
  if (!pricing || pricing.mid_total == null) {
    return {
      score,
      pricing: null,
      roi: null,
      ready: false,
      errors: ["Pricing engine did not return a valid result — ROI calculation blocked"],
    };
  }

  // Step 3: Run ROI engine — refurb_budget is pricing.mid_total, no fallback permitted
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

  // Step 4: Compose all results
  return {
    score,
    pricing,
    roi,
    ready: true,
    errors: [],
  };
}

/**
 * Determine if deal analysis is complete enough for display/save.
 * Both score and pricing must be ready; ROI is gated on pricing.
 */
export function isDealAnalysisReady(analysis: DealAnalysisResult): boolean {
  return analysis.ready && analysis.score.ready;
}

/**
 * Extract pricing-relevant fields from analysis result for display.
 * Returns null if pricing was not run.
 */
export function getPricingFromAnalysis(analysis: DealAnalysisResult) {
  return analysis.pricing;
}

/**
 * Extract ROI-relevant fields from analysis result.
 * Always available if analysis is ready (embedded in score result).
 */
export function getRoiFromAnalysis(analysis: DealAnalysisResult) {
  return analysis.roi;
}
