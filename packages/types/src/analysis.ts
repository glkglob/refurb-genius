// AnalysisResult — single-room AI analysis output.
export const ROOM_TYPES = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Hallway",
  "Exterior",
  "Garden",
  "Other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const CONDITION_LEVELS = [
  "Modern",
  "Average",
  "Dated",
  "Poor",
  "Full Renovation Needed",
] as const;
export type ConditionLevel = (typeof CONDITION_LEVELS)[number];

export const REFURB_LEVELS = ["Light", "Medium", "Heavy", "Full"] as const;
export type RefurbLevel = (typeof REFURB_LEVELS)[number];

export type AnalysisSource = "ai" | "mock" | "fallback" | "persisted";

export type RoomAnalysis = {
  id: string;
  photo_url: string;
  photo_name: string;
  room_type: RoomType;
  condition_level: ConditionLevel;
  refurbishment_level: RefurbLevel;
  visible_issues: string[];
  recommended_works: string[];
  ai_summary: string;
  confidence_score: number;
  source: AnalysisSource;
};

export type AnalysisResult = RoomAnalysis;
