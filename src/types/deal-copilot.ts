import type { ConditionLevel, EstimateCategory, FinishLevel, UKRegion } from "@repo/types";
import type { DealScoreResult, PricingEngineResult, RoiEngineResult } from "@repo/services";

/**
 * Normalized form input ready for engine consumption.
 * All strings parsed to numbers, all enums validated, all required fields present.
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
 * Complete analysis result from all three deterministic engines.
 * Composed by orchestration layer after validation.
 */
export interface DealAnalysisResult {
  /** Readiness & recommendation from dealScore engine */
  score: DealScoreResult;
  /** Cost estimation from pricing engine (null if incomplete) */
  pricing: PricingEngineResult | null;
  /** ROI/yield/metrics from ROI engine (null if incomplete) */
  roi: RoiEngineResult | null;
  /** True if all required fields present and analysis complete */
  ready: boolean;
  /** Array of validation errors or missing field names */
  errors: string[];
}
