// AI domain contracts (analysis, scope, estimates, redesign).
export type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
  AnalysisSource,
} from "./analysis";

export interface ScopeAnalysisPhotoSource {
  id: string;
  url: string;
  name: string;
  size?: number;
}

export interface ScopeAnalysisInput {
  projectId: string;
  photos: ScopeAnalysisPhotoSource[];
  roomTags: string[];
  propertyType: string;
  bedrooms: number;
  bathrooms?: number;
  region: string;
  notes?: string;
}

export type ScopeIssueSeverity = "low" | "medium" | "high" | "critical";
export type ScopeItemCategory = "materials" | "labour" | "both" | "fees";

export interface ScopeIssue {
  category: string;
  description: string;
  severity: ScopeIssueSeverity;
  recommended_action: string;
}

export interface ScopeRecommendedItem {
  name: string;
  category: ScopeItemCategory;
  quantity: number;
  unit: string;
  base_unit_cost: number;
  notes?: string;
}

export interface ScopeRoom {
  room: string;
  area_sqm?: number;
  condition_summary: string;
  issues: ScopeIssue[];
  recommended_items: ScopeRecommendedItem[];
}

export interface ScopeAnalysisResult {
  overall_score: number;
  summary: string;
  rooms: ScopeRoom[];
}

export interface GenerateEstimateInput {
  propertyType: string;
  bedrooms: number;
  bathrooms?: number;
  region: string;
  postcode?: string;
  condition: string;
  requirements: string;
  sizeSqm?: number;
}

export interface AIGeneratedRoom {
  name: string;
  area_sqm?: number;
  items: AIGeneratedItem[];
}

export interface AIGeneratedItem {
  name: string;
  category: "materials" | "labour" | "both" | "fees";
  quantity: number;
  unit: string;
  base_unit_cost: number;
  notes?: string;
}

export type { RedesignConcept, RedesignStyle } from "./redesign";
