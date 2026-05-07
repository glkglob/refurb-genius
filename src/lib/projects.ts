// Mock project store. API surface mirrors what a Supabase-backed store would
// expose so it can be swapped later without touching consumers.

export const PROPERTY_TYPES = [
  "Flat",
  "Terraced",
  "Semi-detached",
  "Detached",
  "HMO",
  "Bungalow",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const UK_REGIONS = [
  "London",
  "South East England",
  "South West England",
  "East of England",
  "East Midlands",
  "West Midlands",
  "North West England",
  "North East England",
  "Yorkshire and the Humber",
  "Scotland",
  "Wales",
  "Northern Ireland",
] as const;

export type UKRegion = (typeof UK_REGIONS)[number];

export type ProjectStatus = "Draft" | "Analysing" | "Estimated" | "Complete";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  address: string;
  postcode: string;
  region: UKRegion;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number;
  purchase_price: number;
  estimated_gdv: number;
  notes: string;
  created_at: string;
  status: ProjectStatus;
};

export type NewProjectInput = Omit<Project, "id" | "user_id" | "created_at" | "status">;

const seed: Project[] = [
  {
    id: "1",
    user_id: "demo",
    name: "Victorian Terrace Refurb",
    address: "12 Elm Street, London",
    postcode: "E1 6AN",
    region: "London",
    property_type: "Terraced",
    bedrooms: 3,
    bathrooms: 1,
    size_sqm: 95,
    purchase_price: 285000,
    estimated_gdv: 410000,
    notes: "Probate sale, dated throughout, strong street.",
    created_at: "2026-04-12",
    status: "Estimated",
  },
  {
    id: "2",
    user_id: "demo",
    name: "Manchester Buy-to-Let",
    address: "44 Oak Road, Manchester",
    postcode: "M14 5GH",
    region: "North West England",
    property_type: "Semi-detached",
    bedrooms: 2,
    bathrooms: 1,
    size_sqm: 72,
    purchase_price: 165000,
    estimated_gdv: 230000,
    notes: "Tenanted, light refurb on void.",
    created_at: "2026-04-28",
    status: "Analysing",
  },
  {
    id: "3",
    user_id: "demo",
    name: "Edinburgh Tenement Flat",
    address: "8 Royal Mile, Edinburgh",
    postcode: "EH1 1RE",
    region: "Scotland",
    property_type: "Flat",
    bedrooms: 1,
    bathrooms: 1,
    size_sqm: 48,
    purchase_price: 195000,
    estimated_gdv: 250000,
    notes: "Short-let potential. Listed building.",
    created_at: "2026-03-04",
    status: "Complete",
  },
];

let projects: Project[] = [...seed];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const projectStore = {
  list(): Project[] {
    return projects;
  },
  get(id: string): Project | undefined {
    return projects.find((p) => p.id === id);
  },
  create(input: NewProjectInput): Project {
    const project: Project = {
      ...input,
      id: crypto.randomUUID(),
      user_id: "demo",
      created_at: new Date().toISOString(),
      status: "Draft",
    };
    projects = [project, ...projects];
    notify();
    return project;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Derived helpers used across dashboards/reports. Estimate ~= 15% of GDV
// until AI estimate runs; profit = GDV - purchase - estimated refurb.
export function estimatedRefurbCost(p: Project): number {
  return Math.round(p.estimated_gdv * 0.15);
}

export function estimatedProfit(p: Project): number {
  return p.estimated_gdv - p.purchase_price - estimatedRefurbCost(p);
}
