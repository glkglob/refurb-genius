// AI domain contracts (analysis, scope, estimates, redesign).
export type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
  AnalysisSource,
} from "@/features/ai-upload/domain";

export type {
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
  ScopeAnalysisInput,
} from "@/features/ai-design/domain";

export type {
  AIGeneratedRoom,
  AIGeneratedItem,
  GenerateEstimateInput,
} from "@/features/estimate/domain";

export type { RedesignConcept, RedesignStyle } from "@/lib/redesign";

export {
  roomAnalysisSchema,
  scopeAnalysisResultSchema,
  aiEstimateResponseSchema,
  redesignConceptTextSchema,
} from "@/core/ai/validation";
