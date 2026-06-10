/**
 * Legacy shim — implementation moved to the ai-design feature slice.
 * TODO(feature-slice): delete once no importers remain.
 */
export { runSecureScopeAnalysis } from "@/features/ai-design/infrastructure/adapters/ai-scope.adapter.server";
export type {
  ScopeAnalysisInput,
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
} from "@/features/ai-design/domain";
