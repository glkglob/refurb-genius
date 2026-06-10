/**
 * Legacy shim — moved to the ai-upload feature slice presentation layer.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  photoAnalysisProvider,
  mockPhotoAnalysisProvider,
  serverPhotoAnalysisProvider,
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  subscribePhotoAnalysis,
  type PhotoAnalysisInput,
  type PhotoAnalysisProvider,
} from "@/features/ai-upload/presentation/photo-analysis.provider";

export type {
  AnalysisSource,
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/features/ai-upload/domain";
