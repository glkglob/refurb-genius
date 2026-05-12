// Investor ROI / risk / score metrics.
// Canonical engine: ./roiEngine.ts
//
// TODO(deal-copilot): monitoring re-runs `runRoiEngine` on a schedule to
// detect drift; alerts fire when score / ROI / risk crosses a threshold.
// Automation rules read the same result shape — never recompute metrics.

export {
  runRoiEngine,
  projectedAnnualRent,
} from "./roiEngine";
export type {
  RoiEngineInputs,
  RoiEngineResult,
  RoiRiskLevel,
} from "./roiEngine";
export type {
  RoiEngineResult as InvestorMetrics,
  RoiRiskLevel as RiskLevel,
} from "./roiEngine";

// Canonical runtime ROI comes from `runRoiEngine` above. The export below is
// a legacy compatibility helper and should not be used by new code.
export { calculateInvestorMetrics } from "@/lib/metrics";
