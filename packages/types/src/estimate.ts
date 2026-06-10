// Estimate + EstimateItem — refurbishment cost engine output.
import type { ConditionLevel } from "./analysis";
import type { UKRegion } from "./project";

export const FINISH_LEVELS = ["Budget", "Standard", "Premium"] as const;
export type FinishLevel = (typeof FINISH_LEVELS)[number];

export const ESTIMATE_CATEGORIES = [
  "Kitchen",
  "Bathroom",
  "Flooring",
  "Painting",
  "Electrical",
  "Plumbing",
  "Heating",
  "Roofing",
  "Structural",
  "Damp Treatment",
  "Garden",
  "Windows & Doors",
] as const;
export type EstimateCategory = (typeof ESTIMATE_CATEGORIES)[number];

export type EstimateInputs = {
  region: UKRegion;
  property_condition: ConditionLevel;
  finish_quality: FinishLevel;
  selected_categories: EstimateCategory[];
  property_size_sqm: number;
};

export type EstimateItem = {
  category: EstimateCategory;
  labour: number;
  materials: number;
  total: number;
  weeks: number;
};

export type Estimate = {
  inputs: EstimateInputs;
  multiplier: number;
  size_multiplier: number;
  lineItems: EstimateItem[];
  labour_total: number;
  materials_total: number;
  subtotal: number;
  contingency: number;
  vat: number;
  low_total: number;
  mid_total: number;
  high_total: number;
  timeline_weeks: number;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  warnings: string[];
};
