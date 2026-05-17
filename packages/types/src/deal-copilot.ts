import type { ConditionLevel, EstimateCategory, FinishLevel, UKRegion } from "./index";

/**
 * Normalized form input ready for engine consumption.
 * All strings parsed to numbers, all enums validated, all required fields present.
 * This is the validated/parsed form ready for orchestration.
 */
export interface ParsedDealFormData {
  title: string;
  purchasePrice: number;
  refurbBudget: number;
  estimatedGdv: number;
  rentalIncome: number;
  holdingCosts: number;
  region: UKRegion;
  propertyCondition: ConditionLevel;
  propertySize?: number;
  finishLevel?: FinishLevel;
  selectedCategories?: EstimateCategory[];
}

/**
 * Complete analysis result from deterministic engines.
 * Composed by orchestration layer after validation.
 *
 * Financial authority:
 * - score: readiness + recommendation from dealScore engine
 * - pricing: cost estimation from pricing engine
 * - roi: ROI/yield/metrics from ROI engine (consuming pricing.mid_total as refurb_budget)
 *
 * Engine result types are imported separately in orchestration layer only.
 * Types layer doesn't reference @repo/services to preserve dependency direction.
 */
export interface DealAnalysisResult {
  /** Readiness & recommendation from dealScore engine */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  score: any; // @repo/services.DealScoreResult
  /** Cost estimation from pricing engine (null if incomplete) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pricing: any | null; // @repo/services.PricingEngineResult
  /** ROI/yield/metrics from ROI engine (null if incomplete) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  roi: any | null; // @repo/services.RoiEngineResult
  /** True if all required fields present and analysis complete */
  ready: boolean;
  /** Array of validation errors or missing field names */
  errors: string[];
}
