/**
 * Legacy shim — moved to the ai-design feature slice.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  saveScopeAnalysis,
  getLatestScopeAnalysis,
  type PersistedScopeAnalysis,
  type SaveScopeAnalysisInput,
} from "@/features/ai-design/infrastructure/repositories/scope-analysis.repository";

export type {
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
  ScopeAnalysisInput,
} from "@/features/ai-design/domain";
