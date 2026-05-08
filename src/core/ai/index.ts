// AI surface: photo analysis, redesign concepts, summary wording.
// Mock today, real models tomorrow — UI imports only from here.
//
// Boundary: AI generates language and visuals. AI does NOT generate
// pricing, ROI, or any financial number. Money lives in `@/core/pricing`
// and `@/core/roi`.
//
// TODO(deal-copilot): listing parsing, deal narratives, and inbox triage
// extend this module via new providers. They must stay language/vision
// only — financial figures still come from the pricing and ROI engines.


export {
  photoAnalysisProvider,
  mockPhotoAnalysisProvider,
  getPhotoAnalysis,
  runPhotoAnalysis,
  subscribePhotoAnalysis,
} from "./photoAnalysis";
export type {
  PhotoAnalysisProvider,
  PhotoAnalysisInput,
} from "./photoAnalysis";

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

// Legacy exports — pages currently import these directly. New code should
// prefer the provider helpers above.
export {
  analysisStore,
  ROOM_TYPES,
  CONDITION_LEVELS,
  REFURB_LEVELS,
} from "@/lib/analysis";
export type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/lib/analysis";

export { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
export type { RedesignConcept, RedesignStyle } from "@/lib/redesign";
