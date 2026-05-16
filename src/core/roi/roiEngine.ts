// Backward compatibility shim. ROI engine has been extracted to @repo/services.
// Use @repo/services directly for new code.

export { runRoiEngine, projectedAnnualRent } from "@repo/services";
export type { RoiEngineInputs, RoiEngineResult, RoiRiskLevel } from "@repo/services";
