// Legacy compatibility wrapper for the canonical pricing engine.
import type { UKRegion } from "./projects";
import type { ConditionLevel } from "./analysis";
import {
  REFERENCE_SIZE_SQM,
  runPricingEngine,
  type PricingEstimateItem,
} from "@/core/pricing/pricingEngine";

export {
  CATEGORY_BASE,
  CONDITION_MULTIPLIERS,
  ESTIMATE_CATEGORIES,
  FINISH_LEVELS,
  FINISH_MULTIPLIERS,
  REGION_MULTIPLIERS,
} from "@/core/pricing/pricingData";
export type { EstimateCategory, FinishLevel } from "@/core/pricing/pricingData";
import type { EstimateCategory, FinishLevel } from "@/core/pricing/pricingData";

export type EstimateInputs = {
  region: UKRegion;
  condition: ConditionLevel;
  finish: FinishLevel;
  categories: EstimateCategory[];
};

export type LineItem = PricingEstimateItem;

export type EstimateResult = {
  inputs: EstimateInputs;
  multiplier: number;
  items: LineItem[];
  labour_total: number;
  materials_total: number;
  subtotal: number;
  contingency: number;
  vat: number;
  mid_total: number;
  low_total: number;
  high_total: number;
  timeline_weeks: number;
};

export function calculateEstimate(inputs: EstimateInputs): EstimateResult {
  const result = runPricingEngine({
    region: inputs.region,
    property_condition: inputs.condition,
    finish_quality: inputs.finish,
    selected_categories: inputs.categories,
    property_size_sqm: REFERENCE_SIZE_SQM,
  });

  return {
    inputs,
    multiplier: result.multiplier,
    items: result.estimate_items,
    labour_total: result.labour_total,
    materials_total: result.materials_total,
    subtotal: result.subtotal,
    contingency: result.contingency,
    vat: result.vat,
    mid_total: result.mid_total,
    low_total: result.low_total,
    high_total: result.high_total,
    timeline_weeks: result.timeline_weeks,
  };
}

export const formatGBP = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
