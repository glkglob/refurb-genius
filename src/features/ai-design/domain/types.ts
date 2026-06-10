/**
 * AI-design slice — Domain entities and value types.
 *
 * Scope-of-works and redesign concept shapes. Redesign static catalog
 * (`REDESIGN_CONCEPTS`) remains in `src/lib/redesign` until a later pass.
 */
import type { RoomAnalysis } from "@/features/ai-upload";
import type { RedesignStyle, RedesignConcept } from "@/lib/redesign";

export { REDESIGN_STYLES, type RedesignStyle, type RedesignConcept } from "@/lib/redesign";

export type ScopeIssueSeverity = "low" | "medium" | "high" | "critical";
export type ScopeItemCategory = "materials" | "labour" | "both" | "fees";

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

export type GenerateRedesignInput = {
  projectId: string;
  styles?: RedesignStyle[];
  analyses?: RoomAnalysis[];
};

export type RedesignProviderInput = {
  projectId: string;
  styles?: RedesignStyle[];
  roomType?: string;
};
