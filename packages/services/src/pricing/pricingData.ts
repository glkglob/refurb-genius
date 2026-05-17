import type { ConditionLevel } from "@/lib/analysis";
import type { UKRegion } from "@/lib/projects";

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

export const REGION_MULTIPLIERS: Record<UKRegion, number> = {
  London: 1.3,
  "South East England": 1.18,
  "East of England": 1.12,
  "South West England": 1.08,
  "West Midlands": 1.0,
  "East Midlands": 0.98,
  "Yorkshire and the Humber": 0.96,
  "North West England": 0.95,
  Scotland: 0.95,
  Wales: 0.92,
  "North East England": 0.9,
  "Northern Ireland": 0.9,
};

export const CONDITION_MULTIPLIERS: Record<ConditionLevel, number> = {
  Modern: 0.6,
  Average: 0.85,
  Dated: 1.0,
  Poor: 1.25,
  "Full Renovation Needed": 1.5,
};

export const FINISH_MULTIPLIERS: Record<FinishLevel, number> = {
  Budget: 0.8,
  Standard: 1.0,
  Premium: 1.35,
};

type Base = {
  labour: number;
  materials: number;
  weeks: number;
};

export const CATEGORY_BASE: Record<EstimateCategory, Base> = {
  Kitchen: { labour: 4500, materials: 8500, weeks: 3 },
  Bathroom: { labour: 3200, materials: 4800, weeks: 2 },
  Flooring: { labour: 2200, materials: 3800, weeks: 1.5 },
  Painting: { labour: 2800, materials: 1200, weeks: 1.5 },
  Electrical: { labour: 3500, materials: 2500, weeks: 2 },
  Plumbing: { labour: 2800, materials: 2200, weeks: 1.5 },
  Heating: { labour: 2400, materials: 3600, weeks: 1.5 },
  Roofing: { labour: 4200, materials: 5800, weeks: 2 },
  Structural: { labour: 6500, materials: 5500, weeks: 4 },
  "Damp Treatment": { labour: 1800, materials: 1700, weeks: 1 },
  Garden: { labour: 2200, materials: 1800, weeks: 1.5 },
  "Windows & Doors": { labour: 2400, materials: 5600, weeks: 1.5 },
};
