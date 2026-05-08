// Report-layer shared constants, demo fixtures, and helpers.
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
