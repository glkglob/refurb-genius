// Investor ROI / risk / score metrics.
// Canonical engine: ./roiEngine.ts
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
