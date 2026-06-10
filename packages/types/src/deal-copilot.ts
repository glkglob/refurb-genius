import type { Estimate } from "./estimate";
import type { InvestmentMetrics } from "./metrics";
import type { ConditionLevel } from "./analysis";
import type { EstimateCategory, FinishLevel } from "./estimate";
import type { UKRegion } from "./project";

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
  score: {
    ready: boolean;
    score: number | null;
    recommendation: string;
    reasons: string[];
    missingFields: string[];
  };
  /** Cost estimation from pricing engine (null if incomplete) */
  pricing: Estimate | null;
  /** ROI/yield/metrics from ROI engine (null if incomplete) */
  roi: InvestmentMetrics | null;
  /** True if all required fields present and analysis complete */
  ready: boolean;
  /** Array of validation errors or missing field names */
  errors: string[];
}
