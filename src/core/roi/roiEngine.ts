// Deterministic ROI / investment engine.
//
// Single source of truth for investor metrics. No AI, no randomness — given
// the same inputs, returns the same outputs. Pages and components must call
// `runRoiEngine` instead of recomputing locally.
import type { UKRegion } from "@/lib/projects";
import type { ConditionLevel } from "@/lib/analysis";

export type RoiRiskLevel = "Low" | "Moderate" | "High";

export type RoiEngineInputs = {
  purchase_price: number;
  refurb_budget: number;
  estimated_gdv: number;
  /** Current annual rental income (£), pre-refurb. 0 if unknown. */
  rental_income: number;
  /** Annual holding costs: finance, insurance, council tax, utilities, etc. */
  holding_costs: number;
  region: UKRegion;
  property_condition: ConditionLevel;
};

export type RoiEngineResult = {
  inputs: RoiEngineInputs;
  total_project_cost: number;
  estimated_profit: number;
  /** Return on cost, %. */
  roi: number;
  /** Gross yield on total project cost, %. */
  gross_yield: number;
  /** Projected annual rental uplift over current income (£). */
  rental_uplift: number;
  /** 1..10 composite. Higher is better. */
  investment_score: number;
  risk_level: RoiRiskLevel;
};

// Regional rental strength — used to project post-refurb annual rent when
// the caller does not provide one. Calibrated to West Midlands = 1.00.
const REGION_RENT_STRENGTH: Record<UKRegion, number> = {
  "London": 1.55,
  "South East England": 1.30,
  "East of England": 1.18,
  "South West England": 1.10,
  "West Midlands": 1.00,
  "East Midlands": 0.96,
  "Yorkshire and the Humber": 0.92,
  "North West England": 0.95,
  "Scotland": 0.95,
  "Wales": 0.90,
  "North East England": 0.88,
  "Northern Ireland": 0.88,
};

// Condition risk premium — worse condition = higher delivery risk.
const CONDITION_RISK: Record<ConditionLevel, number> = {
  "Modern": 0.0,
  "Average": 0.5,
  "Dated": 1.0,
  "Poor": 1.8,
  "Full Renovation Needed": 2.5,
};

/** Implied gross annual rent on the post-refurb property (£). */
export function projectedAnnualRent(inputs: RoiEngineInputs): number {
  const strength = REGION_RENT_STRENGTH[inputs.region] ?? 1;
  // ~5.5% gross yield on GDV at neutral region as a deterministic baseline.
  return Math.round(inputs.estimated_gdv * 0.055 * strength);
}

/**
 * Run the deterministic ROI engine.
 *
 * Profit = GDV − purchase − refurb − holding costs.
 * ROI    = profit / total project cost (×100).
 * Yield  = projected annual rent / total project cost (×100).
 * Uplift = projected annual rent − current rental income (£).
 * Score  = weighted blend of ROI, yield, and condition risk, clamped 1..10.
 */
export function runRoiEngine(inputs: RoiEngineInputs): RoiEngineResult {
  const total_project_cost =
    inputs.purchase_price + inputs.refurb_budget + Math.max(0, inputs.holding_costs);
  const estimated_profit = inputs.estimated_gdv - total_project_cost;

  const roi = total_project_cost > 0 ? (estimated_profit / total_project_cost) * 100 : 0;

  const annualRent = projectedAnnualRent(inputs);
  const gross_yield = total_project_cost > 0 ? (annualRent / total_project_cost) * 100 : 0;
  const rental_uplift = Math.max(0, annualRent - Math.max(0, inputs.rental_income));

  // Score: ROI 60%, yield 30%, condition penalty 10%. 30% ROI ≈ full marks
  // on the ROI axis; 10% yield ≈ full marks on the yield axis.
  const roiScore = clamp(roi / 3, 0, 10);
  const yieldScore = clamp(gross_yield, 0, 10);
  const conditionPenalty = CONDITION_RISK[inputs.property_condition] ?? 1;
  const raw = roiScore * 0.6 + yieldScore * 0.3 - conditionPenalty * 0.1;
  const investment_score = clamp(+raw.toFixed(1), 1, 10);

  const risk_level: RoiRiskLevel =
    investment_score >= 7.5 ? "Low" : investment_score >= 5 ? "Moderate" : "High";

  return {
    inputs,
    total_project_cost,
    estimated_profit,
    roi: +roi.toFixed(1),
    gross_yield: +gross_yield.toFixed(1),
    rental_uplift,
    investment_score,
    risk_level,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
