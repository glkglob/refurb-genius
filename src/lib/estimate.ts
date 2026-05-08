// Mock refurbishment estimate engine. Pure functions so it can be reused on
// the report page or replaced with a server-side calculator later.
import type { UKRegion } from "./projects";
import type { ConditionLevel } from "./analysis";

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
  "London": 1.30,
  "South East England": 1.18,
  "East of England": 1.12,
  "South West England": 1.08,
  "West Midlands": 1.00,
  "East Midlands": 0.98,
  "Yorkshire and the Humber": 0.96,
  "North West England": 0.95,
  "Scotland": 0.95,
  "Wales": 0.92,
  "North East England": 0.90,
  "Northern Ireland": 0.90,
};

export const CONDITION_MULTIPLIERS: Record<ConditionLevel, number> = {
  "Modern": 0.60,
  "Average": 0.85,
  "Dated": 1.00,
  "Poor": 1.25,
  "Full Renovation Needed": 1.50,
};

export const FINISH_MULTIPLIERS: Record<FinishLevel, number> = {
  Budget: 0.80,
  Standard: 1.00,
  Premium: 1.35,
};

// Base costs per category at Dated condition / Standard finish / West Midlands
// (multiplier 1.00). Labour + materials split is indicative.
type Base = {
  labour: number;
  materials: number;
  weeks: number;
};

export const CATEGORY_BASE: Record<EstimateCategory, Base> = {
  "Kitchen": { labour: 4500, materials: 8500, weeks: 3 },
  "Bathroom": { labour: 3200, materials: 4800, weeks: 2 },
  "Flooring": { labour: 2200, materials: 3800, weeks: 1.5 },
  "Painting": { labour: 2800, materials: 1200, weeks: 1.5 },
  "Electrical": { labour: 3500, materials: 2500, weeks: 2 },
  "Plumbing": { labour: 2800, materials: 2200, weeks: 1.5 },
  "Heating": { labour: 2400, materials: 3600, weeks: 1.5 },
  "Roofing": { labour: 4200, materials: 5800, weeks: 2 },
  "Structural": { labour: 6500, materials: 5500, weeks: 4 },
  "Damp Treatment": { labour: 1800, materials: 1700, weeks: 1 },
  "Garden": { labour: 2200, materials: 1800, weeks: 1.5 },
  "Windows & Doors": { labour: 2400, materials: 5600, weeks: 1.5 },
};

export type EstimateInputs = {
  region: UKRegion;
  condition: ConditionLevel;
  finish: FinishLevel;
  categories: EstimateCategory[];
};

export type LineItem = {
  category: EstimateCategory;
  labour: number;
  materials: number;
  total: number;
  weeks: number;
};

export type EstimateResult = {
  inputs: EstimateInputs;
  multiplier: number;
  items: LineItem[];
  labour_total: number;
  materials_total: number;
  subtotal: number;
  contingency: number;
  vat: number;
  mid_total: number;
  low_total: number;
  high_total: number;
  timeline_weeks: number;
};

const round = (n: number) => Math.round(n / 10) * 10;

export function calculateEstimate(inputs: EstimateInputs): EstimateResult {
  const region = REGION_MULTIPLIERS[inputs.region];
  const condition = CONDITION_MULTIPLIERS[inputs.condition];
  const finish = FINISH_MULTIPLIERS[inputs.finish];
  const multiplier = region * condition * finish;

  const items: LineItem[] = inputs.categories.map((cat) => {
    const base = CATEGORY_BASE[cat];
    const labour = round(base.labour * multiplier);
    const materials = round(base.materials * multiplier);
    return {
      category: cat,
      labour,
      materials,
      total: labour + materials,
      weeks: +(base.weeks * Math.max(0.8, condition)).toFixed(1),
    };
  });

  const labour_total = items.reduce((s, i) => s + i.labour, 0);
  const materials_total = items.reduce((s, i) => s + i.materials, 0);
  const subtotal = labour_total + materials_total;
  const contingency = Math.round(subtotal * 0.10);
  const vat = Math.round((subtotal + contingency) * 0.20);
  const mid_total = subtotal + contingency + vat;
  const low_total = Math.round(mid_total * 0.85);
  const high_total = Math.round(mid_total * 1.15);

  // Timeline: assume 60% parallelisation across categories.
  const sumWeeks = items.reduce((s, i) => s + i.weeks, 0);
  const timeline_weeks = Math.max(
    items.length ? Math.ceil(Math.max(...items.map((i) => i.weeks))) : 0,
    Math.ceil(sumWeeks * 0.6),
  );

  return {
    inputs,
    multiplier: +multiplier.toFixed(3),
    items,
    labour_total,
    materials_total,
    subtotal,
    contingency,
    vat,
    mid_total,
    low_total,
    high_total,
    timeline_weeks,
  };
}

export const formatGBP = (n: number) =>
  `£${Math.round(n).toLocaleString("en-GB")}`;
