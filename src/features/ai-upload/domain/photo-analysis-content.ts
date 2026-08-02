/**
 * Re-export photo-analysis analysis_data mapping from @repo/types.
 *
 * Ownership remains the ai-upload domain public surface; implementation lives
 * in the shared types package so browser write/query seams can import the pure
 * mapper without loading the full feature presentation barrel (side effects).
 */
export {
  parsePhotoAnalysisContent,
  serializePhotoAnalysisContent,
  mapPhotoAnalysisRow,
  createPhotoAnalysisAppModel,
  EMPTY_PHOTO_ANALYSIS_CONTENT,
  type PhotoAnalysisAppModel,
  type PhotoAnalysisContent,
  type PhotoAnalysisDefect,
  type PhotoAnalysisMaterial,
  type PhotoAnalysisCostSuggestions,
  type PhotoAnalysisDbRowLike,
  type PhotoAnalysisJson,
} from "@repo/types";
