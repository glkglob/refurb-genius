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

// Legacy project+estimate metrics — kept for pages already wired to the
// older API. New code should call `runRoiEngine` instead.
export { calculateInvestorMetrics } from "@/lib/metrics";
export type { InvestorMetrics, RiskLevel } from "@/lib/metrics";
