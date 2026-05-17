import {
  scoreDealOpportunity,
  runPricingEngine,
  type DealScoreInput,
  type PricingEngineInputs,
} from "@repo/services";
import type { EstimateCategory, FinishLevel } from "@repo/types";
import type { DealAnalysisResult, ParsedDealFormData } from "@/types/deal-copilot";

/**
 * Orchestrate all three deterministic engines to produce complete deal analysis.
 *
 * Flow:
 * 1. Validate deal via scoreDealOpportunity() — this internally runs roiEngine
 * 2. If ready, optionally run pricingEngine with pricing inputs
 * 3. Compose all results into single DealAnalysisResult
 *
 * All calculation logic remains in @repo/services engines.
 * This layer only composes, validates inputs, and maps between contracts.
 */
export function analyzeDeal(formData: ParsedDealFormData): DealAnalysisResult {
  // Map form data to deal scoring input
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

  // Step 1: Run deal scoring (this internally runs roiEngine)
  const score = scoreDealOpportunity(scoreInput);

  // If deal is not ready (missing required fields), return early
  if (!score.ready) {
    return {
      score,
      pricing: null,
      roi: score.roiResult,
      ready: false,
      errors: score.missingFields,
    };
  }

  // Step 2: Run pricing engine if enough info provided
  // Pricing is optional for MVP; if missing, pricing result is null
  let pricing = null;
  if (
    formData.propertySize &&
    formData.propertySize > 0 &&
    formData.finishLevel &&
    formData.selectedCategories &&
    formData.selectedCategories.length > 0
  ) {
    const pricingInput: PricingEngineInputs = {
      region: formData.region,
      property_condition: formData.propertyCondition,
      finish_quality: formData.finishLevel,
      selected_categories: formData.selectedCategories,
      property_size_sqm: formData.propertySize,
    };

    pricing = runPricingEngine(pricingInput);
  }

  // Step 3: Compose all results
  return {
    score,
    pricing,
    roi: score.roiResult,
    ready: true,
    errors: [],
  };
}

/**
 * Determine if deal analysis is complete enough for display/save.
 * Scoring must be ready; pricing is optional for MVP.
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
