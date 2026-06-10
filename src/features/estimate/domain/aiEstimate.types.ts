/**
 * AI estimate output shapes (pure types — safe for @repo/types re-exports).
 */

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
