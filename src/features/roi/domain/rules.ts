import type {
  CashFlowModel,
  GdvBreakdown,
  RoiEngineInputs,
  RoiEngineResult,
  SensitivityScenarioAssumptions,
} from "./types";

export function buildGdvBreakdown(inputs: RoiEngineInputs, metrics: RoiEngineResult): GdvBreakdown {
  return {
    purchasePrice: inputs.purchase_price,
    refurbCost: inputs.refurb_budget,
    holdingCosts: Math.max(0, inputs.holding_costs),
    estimatedGdv: inputs.estimated_gdv,
    grossMargin: metrics.estimated_profit,
  };
}

export function buildCashFlowModel(
  inputs: RoiEngineInputs,
  metrics: RoiEngineResult,
): CashFlowModel {
  return {
    acquisition: inputs.purchase_price,
    refurb: inputs.refurb_budget,
    holding: Math.max(0, inputs.holding_costs),
    exit: inputs.estimated_gdv,
    netProfit: metrics.estimated_profit,
  };
}

export function applySensitivityToInputs(
  base: RoiEngineInputs,
  assumptions: SensitivityScenarioAssumptions,
): RoiEngineInputs {
  return {
    ...base,
    estimated_gdv: adjusted(base.estimated_gdv, assumptions.gdvDeltaPercent),
    refurb_budget: adjusted(base.refurb_budget, assumptions.refurbDeltaPercent),
    holding_costs: Math.max(0, adjusted(base.holding_costs, assumptions.holdingCostDeltaPercent)),
  };
}

function adjusted(value: number, deltaPercent: number): number {
  return Math.round(value * (1 + deltaPercent / 100));
}
