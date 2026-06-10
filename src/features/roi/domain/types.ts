import type {
  CashFlowModel,
  GdvBreakdown,
  RoiReport,
  SensitivityScenario,
  SensitivityScenarioAssumptions,
} from "@repo/types";
import type {
  RoiEngineInputs as KernelRoiEngineInputs,
  RoiEngineResult as KernelRoiEngineResult,
  RoiRiskLevel as KernelRoiRiskLevel,
} from "@repo/services";

export type RoiEngineInputs = KernelRoiEngineInputs;
export type RoiEngineResult = KernelRoiEngineResult;
export type RoiRiskLevel = KernelRoiRiskLevel;

export type {
  RoiReport,
  SensitivityScenario,
  SensitivityScenarioAssumptions,
  GdvBreakdown,
  CashFlowModel,
};
