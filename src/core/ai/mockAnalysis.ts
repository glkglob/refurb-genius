/**
 * Legacy shim — types and mock data moved to the ai-upload feature slice.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  ROOM_TYPES,
  CONDITION_LEVELS,
  REFURB_LEVELS,
  buildMockRoomAnalyses,
  type RoomType,
  type ConditionLevel,
  type RefurbLevel,
  type AnalysisSource,
  type RoomAnalysis,
  type AnalysisPhotoSource,
} from "@/features/ai-upload/domain";
