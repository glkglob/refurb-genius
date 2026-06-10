export { runRoiEngine, projectedAnnualRent } from "@repo/services";
export type { RoiEngineInputs, RoiEngineResult, RoiRiskLevel } from "./types";
export type {
  RoiReport,
  SensitivityScenario,
  SensitivityScenarioAssumptions,
  GdvBreakdown,
  CashFlowModel,
} from "./types";
export { buildGdvBreakdown, buildCashFlowModel, applySensitivityToInputs } from "./rules";
