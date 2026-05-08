// Report-layer shared constants, demo fixtures, and the report engine.
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
