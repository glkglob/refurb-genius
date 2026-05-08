// Supabase-backed project store. Preserves the synchronous external-store
// API the app already consumes (list / get / getProgress / subscribe) by
// caching results in memory and notifying subscribers when async fetches
// complete.
import { supabase } from "@/integrations/supabase/client";
import { auth } from "./auth";

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
export type ProjectStage = "photos" | "analysis" | "estimate" | "report";

type ProjectRow = Project & {
  photos_done: boolean;
  analysis_done: boolean;
  estimate_done: boolean;
  report_done: boolean;
};

let cache: ProjectRow[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function rowToProject(r: Record<string, unknown>): ProjectRow {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    address: r.address ?? "",
    postcode: r.postcode ?? "",
    region: r.region as UKRegion,
    property_type: r.property_type as PropertyType,
    bedrooms: Number(r.bedrooms ?? 0),
    bathrooms: Number(r.bathrooms ?? 0),
    size_sqm: Number(r.size_sqm ?? 0),
    purchase_price: Number(r.purchase_price ?? 0),
    estimated_gdv: Number(r.estimated_gdv ?? 0),
    notes: r.notes ?? "",
    created_at: r.created_at,
    status: (r.status ?? "Draft") as ProjectStatus,
    photos_done: !!r.photos_done,
    analysis_done: !!r.analysis_done,
    estimate_done: !!r.estimate_done,
    report_done: !!r.report_done,
  };
}

async function fetchAll(): Promise<void> {
  if (!auth.getUser()) {
    cache = [];
    loaded = true;
    notify();
    return;
  }
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[projects] fetch failed", error);
    cache = [];
  } else {
    cache = (data ?? []).map(rowToProject);
  }
  loaded = true;
  notify();
}

function ensureLoaded() {
  if (loaded || loading) return;
  loading = fetchAll().finally(() => {
    loading = null;
  });
}

// Reload when auth changes
if (typeof window !== "undefined") {
  auth.onChange(() => {
    loaded = false;
    cache = [];
    notify();
    ensureLoaded();
  });
}

export const projectStore = {
  list(): Project[] {
    ensureLoaded();
    return cache;
  },
  get(id: string): Project | undefined {
    ensureLoaded();
    return cache.find((p) => p.id === id);
  },
  async refresh(): Promise<void> {
    await fetchAll();
  },
  async create(input: NewProjectInput): Promise<Project> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in.");
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: input.name,
        address: input.address,
        postcode: input.postcode,
        region: input.region,
        property_type: input.property_type,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        size_sqm: input.size_sqm,
        purchase_price: input.purchase_price,
        estimated_gdv: input.estimated_gdv,
        notes: input.notes,
        status: "Draft",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const project = rowToProject(data);
    cache = [project, ...cache];
    notify();
    return project;
  },
  getProgress(id: string): Record<ProjectStage, boolean> {
    const p = cache.find((x) => x.id === id);
    return {
      photos: !!p?.photos_done,
      analysis: !!p?.analysis_done,
      estimate: !!p?.estimate_done,
      report: !!p?.report_done,
    };
  },
  setStage(id: string, stage: ProjectStage, value = true) {
    const idx = cache.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const column = `${stage}_done` as const;
    if (cache[idx][column] === value) return;
    cache = cache.map((p) =>
      p.id === id ? { ...p, [column]: value } : p,
    );
    notify();
    const patch =
      stage === "photos" ? { photos_done: value }
      : stage === "analysis" ? { analysis_done: value }
      : stage === "estimate" ? { estimate_done: value }
      : { report_done: value };
    supabase
      .from("projects")
      .update(patch)
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[projects] setStage failed", error);
      });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
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
