// InvestmentMetrics — investor-facing ROI / risk / score summary.
import type { ConditionLevel } from "./analysis";
import type { UKRegion } from "./project";

export type RiskLevel = "Low" | "Moderate" | "High";

export type InvestmentMetricsInputs = {
  purchase_price: number;
  refurb_budget: number;
  estimated_gdv: number;
  rental_income: number;
  projected_rental_income?: number;
  holding_costs: number;
  region: UKRegion;
  property_condition: ConditionLevel;
};

export type InvestmentMetrics = {
  inputs: InvestmentMetricsInputs;
  total_project_cost: number;
  estimated_profit: number;
  roi: number;
  gross_yield: number;
  rental_uplift: number;
  investment_score: number;
  risk_level: RiskLevel;
};
