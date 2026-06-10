// AI surface — orchestration, validation, and shared-kernel re-exports.
// Feature capabilities import from @/features/ai-upload, ai-design, estimate.

export {
  photoAnalysisProvider,
  mockPhotoAnalysisProvider,
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  subscribePhotoAnalysis,
  runPhotoAnalysisServerFn,
} from "@/features/ai-upload";
export type {
  AnalysisSource,
  PhotoAnalysisProvider,
  PhotoAnalysisInput,
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/features/ai-upload";

export {
  redesignProvider,
  mockRedesignProvider,
  listRedesignConcepts,
  generateRedesignConcepts,
  generateRedesignConceptsServerFn,
  runScopeAnalysisServerFn,
  REDESIGN_CONCEPTS,
  REDESIGN_STYLES,
} from "@/features/ai-design";
export type {
  RedesignProvider,
  RedesignInput,
  RedesignConcept,
  RedesignStyle,
  ScopeAnalysisInput,
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
} from "@/features/ai-design";

export {
  aiSummariesProvider,
  mockAiSummariesProvider,
  reportHeadline,
  executiveSummary,
  roomSummary,
  recommendedWorks,
} from "./aiSummaries";
export type { AiSummariesProvider, ProjectSummaryInput } from "./aiSummaries";

export { generateEstimateServerFn } from "@/features/estimate";
export type { GenerateEstimateInput, AIGeneratedRoom, AIGeneratedItem } from "@/features/estimate";
export { createDefaultFeasibilityService } from "@/features/feasibility";
export type { FeasibilityStudy } from "@/features/feasibility";

export { analysisStore } from "@/features/ai-upload/infrastructure";
export { ROOM_TYPES, CONDITION_LEVELS, REFURB_LEVELS } from "@/features/ai-upload";

export {
  roomAnalysisSchema,
  scopeAnalysisResultSchema,
  aiEstimateResponseSchema,
  redesignConceptTextSchema,
  safeParseRoomAnalysis,
  safeParseScopeResult,
  safeParseEstimate,
  safeParseRedesignText,
  roomTypeSchema,
  conditionLevelSchema,
  refurbLevelSchema,
} from "./validation";

export { withRetry, classifyError } from "./platform/retry";
export { getCached, setCached, clearProjectCache, getCacheStats } from "./platform/cache";
export {
  runVisionThenScope,
  runScopeThenEstimate,
  runFullRefurbIntel,
} from "./platform/orchestrator";
export type { AIOrchestrationMode, FullIntelResult } from "./platform/orchestrator";
export { normalizeAIEstimate } from "./normalizers";
export type {
  EstimateNormalizationInput,
  NormalizedEstimateRoom,
  NormalizedEstimateResult,
} from "./normalizers";
