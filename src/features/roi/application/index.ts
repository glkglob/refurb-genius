export type { RoiEnginePort } from "./ports";
export {
  makeCalculateInvestmentMetrics,
  type CalculateInvestmentMetricsCommand,
  type CalculateInvestmentMetricsDeps,
} from "./calculateInvestmentMetrics";
export {
  makeRunSensitivityAnalysis,
  type RunSensitivityAnalysisCommand,
  type RunSensitivityAnalysisDeps,
} from "./runSensitivityAnalysis";
export {
  makeGenerateRoiReport,
  type GenerateRoiReportCommand,
  type GenerateRoiReportDeps,
} from "./generateRoiReport";
export { makeRoiService, type RoiService, type RoiServiceDeps } from "./roiService";
