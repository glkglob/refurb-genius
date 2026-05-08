// Refurbishment pricing engine. Pure functions — safe for any product surface.
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
