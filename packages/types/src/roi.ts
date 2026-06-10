import type { InvestmentMetrics } from "./metrics";

export type SensitivityScenarioAssumptions = {
  gdvDeltaPercent: number;
  refurbDeltaPercent: number;
  holdingCostDeltaPercent: number;
};

export type SensitivityScenario = {
  name: string;
  assumptions: SensitivityScenarioAssumptions;
  metrics: InvestmentMetrics;
};

export type GdvBreakdown = {
  purchasePrice: number;
  refurbCost: number;
  holdingCosts: number;
  estimatedGdv: number;
  grossMargin: number;
};

export type CashFlowModel = {
  acquisition: number;
  refurb: number;
  holding: number;
  exit: number;
  netProfit: number;
};

export type RoiReport = {
  generatedAt: string;
  baseMetrics: InvestmentMetrics;
  gdv: GdvBreakdown;
  cashFlow: CashFlowModel;
  scenarios: SensitivityScenario[];
  assumptions: string[];
};
