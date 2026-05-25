// AI surface: photo analysis, redesign concepts, summary wording, and
// AI-generated refurbishment estimates. Mock today, real models tomorrow —
// UI imports only from here.
//
// Boundary: AI generates language, visuals, and line-item estimate
// suggestions (base costs). Financial calculations (regional adjustment,
// ROI, profit) still live in `@/core/pricing` and `@/core/roi`.
//
// TODO(deal-copilot): listing parsing, deal narratives, and inbox triage
// extend this module via new providers.
//
// TODO(refurb-iq): specification writer, scope-of-works prose, and snag
// descriptions extend this module via new providers.

export {
  photoAnalysisProvider,
  mockPhotoAnalysisProvider,
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  subscribePhotoAnalysis,
} from "./photoAnalysis";
export type { AnalysisSource, PhotoAnalysisProvider, PhotoAnalysisInput } from "./photoAnalysis";

export {
  redesignProvider,
  mockRedesignProvider,
  listRedesignConcepts,
  generateRedesignConcepts,
} from "./redesignConcepts";
export type { RedesignProvider, RedesignInput } from "./redesignConcepts";

export {
  aiSummariesProvider,
  mockAiSummariesProvider,
  reportHeadline,
  executiveSummary,
  roomSummary,
  recommendedWorks,
} from "./aiSummaries";
export type { AiSummariesProvider, ProjectSummaryInput } from "./aiSummaries";

// AI estimate generation — server function for the estimate builder.
export { generateEstimateServerFn } from "./serverFns";
export type {
  GenerateEstimateInput,
  AIGeneratedRoom,
  AIGeneratedItem,
} from "./server/openAiEstimate.server";

// AI scope analysis — photo → condition + costed scope of works.
export { runScopeAnalysisServerFn } from "./serverFns";
export type {
  ScopeAnalysisInput,
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
} from "./server/openAiScopeAnalysis.server";

// Legacy exports — pages currently import these directly. New code should
// prefer the provider helpers above.
export { analysisStore, ROOM_TYPES, CONDITION_LEVELS, REFURB_LEVELS } from "@/lib/analysis";
export type { RoomAnalysis, RoomType, ConditionLevel, RefurbLevel } from "@/lib/analysis";

export { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
export type { RedesignConcept, RedesignStyle } from "@/lib/redesign";
