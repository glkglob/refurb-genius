/**
 * Legacy shim — analysisStore moved to the ai-upload feature slice.
 * TODO(feature-slice): delete once no importers remain.
 */
export { analysisStore } from "@/features/ai-upload/infrastructure/repositories/room-analysis.repository";
export {
  ROOM_TYPES,
  CONDITION_LEVELS,
  REFURB_LEVELS,
  buildMockRoomAnalyses,
  type AnalysisPhotoSource,
  type AnalysisSource,
  type RoomAnalysis,
  type RoomType,
  type ConditionLevel,
  type RefurbLevel,
} from "@/features/ai-upload/domain";
