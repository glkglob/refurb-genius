// Refurbishment pricing engine. Pure functions — safe for any product surface.
// Canonical engine: ./pricingEngine.ts
//
// TODO(deal-copilot): underwriting + monitoring must call `runPricingEngine`
// for every refurb cost figure. No parallel pricing math anywhere else.

export {
  runPricingEngine,
  sizeMultiplier,
  VAT_RATE,
  CONTINGENCY_RATE,
  REFERENCE_SIZE_SQM,
} from "./pricingEngine";
export type {
  PricingEngineInputs,
  PricingEngineResult,
  PricingEstimateItem,
} from "./pricingEngine";

// Legacy calculator + lookup tables kept for backwards compatibility with
// pages already wired to the older API. New code should call
// `runPricingEngine` instead.
export {
  calculateEstimate,
  formatGBP,
  FINISH_LEVELS,
  ESTIMATE_CATEGORIES,
  REGION_MULTIPLIERS,
  CONDITION_MULTIPLIERS,
  FINISH_MULTIPLIERS,
  CATEGORY_BASE,
} from "@/lib/estimate";
export type {
  FinishLevel,
  EstimateCategory,
  EstimateInputs,
  EstimateResult,
  LineItem,
} from "@/lib/estimate";
