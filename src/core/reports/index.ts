// Report-layer shared constants, demo fixtures, and the report engine.
//
// TODO(deal-copilot): acquisition reports extend `buildReport` with extra
// `ReportSection`s (e.g. opportunity source, comparable deals, monitoring
// history). Do not introduce a parallel report builder.

export {
  buildReport,
  REPORT_SECTION_ORDER,
} from "./reportEngine";
export type {
  Report,
  ReportBranding,
  ReportEngineInputs,
  ReportSection,
  ReportSectionKey,
} from "./reportEngine";

export {
  DISCLAIMER,
  mockAnalysis,
  mockEstimate,
  mockMetrics,
  mockRecentAnalyses,
} from "@/lib/mockData";
export type { RecentAnalysis } from "@/lib/mockData";

// Re-exports for legacy import paths (settings page reads regions here).
export { UK_REGIONS, PROPERTY_TYPES } from "@/core/projects";
