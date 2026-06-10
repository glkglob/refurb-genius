export {
  REDESIGN_STYLES,
  type RedesignStyle,
  type RedesignConcept,
  type ScopeAnalysisPhotoSource,
  type ScopeAnalysisInput,
  type ScopeIssue,
  type ScopeRecommendedItem,
  type ScopeRoom,
  type ScopeAnalysisResult,
  type ScopeIssueSeverity,
  type ScopeItemCategory,
  type GenerateRedesignInput,
  type RedesignProviderInput,
} from "./types";
export { buildMockScopeResult } from "./scopeMockData";
export {
  hasCriticalIssues,
  countIssuesBySeverity,
  isActionableScope,
  scopeItemCount,
  highestSeverityRoom,
} from "./rules";
export {
  scopeSeveritySchema,
  scopeCategorySchema,
  scopeIssueSchema,
  scopeRecommendedItemSchema,
  scopeRoomSchema,
  scopeAnalysisResultSchema,
  redesignPaletteItemSchema,
  redesignConceptTextSchema,
  safeParseScopeResult,
  safeParseRedesignText,
  type ValidatedScopeAnalysisResult,
  type ValidatedRedesignConceptText,
} from "./validation";
