// Mock AI analysis + redesign concepts. Swap implementations here when
// upgrading to a real model — consumers won't change.
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

export * from "@/lib/redesign";
