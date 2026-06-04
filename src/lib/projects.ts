// Supabase-backed project store. Preserves the synchronous external-store
// API the app already consumes (list / get / getProgress / subscribe) by
// caching results in memory and notifying subscribers when async fetches
// complete.
import { supabase } from "@/services/supabase";
import { auth } from "./auth";
import { captureApiError, addDiagnosticBreadcrumb } from "./sentry";
import { logger } from "./logger";
import { rowToProject, type ProjectWithProgress } from "./mappers";

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

/** @deprecated Use `ProjectWithProgress` from `@/lib/mappers`. Kept as alias for internal store cache. */
type ProjectRow = ProjectWithProgress;

export type ProjectStoreSnapshot = {
  projects: Project[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

let cache: ProjectRow[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
let waitingForAuth = false;
let error: string | null = null;
let snapshot: ProjectStoreSnapshot = {
  projects: cache,
  loading: false,
  loaded,
  error,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function fetchAll(): Promise<void> {
  // Verify an active Supabase session exists before querying. Using the live
  // session (rather than the in-memory auth.getUser() cache) prevents a race
  // where a stale cached user causes a fetch to fire while the JWT is expired
  // or still being refreshed, which would make Supabase treat the request as
  // anon and fail with "permission denied for function is_admin" (HTTP 403).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    cache = [];
    loaded = true;
    waitingForAuth = false;
    error = null;
    notify();
    return;
  }

  addDiagnosticBreadcrumb("projects:fetch:start");

  try {
    const { data, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchError) {
      logger.error("[projects] fetch failed", { error: fetchError.message });
      captureApiError(fetchError, {
        table: "projects",
        operation: "select",
        context: "fetch_all_projects",
      });
      cache = [];
      loaded = true;
      waitingForAuth = false;
      projectStoreError(fetchError.message);
    } else {
      cache = (data ?? []).map(rowToProject);
      loaded = true;
      waitingForAuth = false;
      projectStoreError(null);
      addDiagnosticBreadcrumb("projects:fetch:success", { count: cache.length });
    }
  } catch (err) {
    logger.error("[projects] fetch exception", { error: String(err) });
    captureApiError(err, {
      table: "projects",
      operation: "select",
      context: "fetch_all_projects_exception",
    });
    cache = [];
    loaded = true;
    waitingForAuth = false;
    projectStoreError(String(err));
  }
  notify();
}

function projectStoreError(message: string | null) {
  error = message;
}

function ensureLoaded() {
  if (loaded || loading) return;
  if (!auth.getUser()) {
    waitingForAuth = true;
    return;
  }
  waitingForAuth = false;
  loading = fetchAll().finally(() => {
    loading = null;
    notify();
  });
}

function getProjectStoreSnapshot(): ProjectStoreSnapshot {
  const isLoading = Boolean(loading) || waitingForAuth;
  if (
    snapshot.projects !== cache ||
    snapshot.loading !== isLoading ||
    snapshot.loaded !== loaded ||
    snapshot.error !== error
  ) {
    snapshot = {
      projects: cache,
      loading: isLoading,
      loaded,
      error,
    };
  }
  return snapshot;
}

// Reload when auth changes
if (typeof window !== "undefined") {
  auth.onChange(() => {
    loaded = false;
    waitingForAuth = false;
    error = null;
    cache = [];
    notify();
    if (auth.getUser()) {
      ensureLoaded();
    } else {
      loaded = true;
      notify();
    }
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
  getSnapshot(): ProjectStoreSnapshot {
    ensureLoaded();
    return getProjectStoreSnapshot();
  },
  async refresh(): Promise<void> {
    await fetchAll();
  },
  async create(input: NewProjectInput): Promise<Project> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in.");
    try {
      addDiagnosticBreadcrumb("projects:create:start", { projectName: input.name });
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
      if (error) {
        logger.error("[projects] create failed", { projectName: input.name, error: error.message });
        captureApiError(error, {
          table: "projects",
          operation: "insert",
          context: "create_project",
        });
        throw new Error(error.message);
      }
      const project = rowToProject(data);
      cache = [project, ...cache];
      addDiagnosticBreadcrumb("projects:create:success", { projectId: project.id });
      notify();
      return project;
    } catch (err) {
      logger.error("[projects] create exception", { projectName: input.name, error: String(err) });
      captureApiError(err, {
        table: "projects",
        operation: "insert",
        context: "create_project_exception",
      });
      throw err;
    }
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
    cache = cache.map((p) => (p.id === id ? { ...p, [column]: value } : p));
    notify();
    const patch =
      stage === "photos"
        ? { photos_done: value }
        : stage === "analysis"
          ? { analysis_done: value }
          : stage === "estimate"
            ? { estimate_done: value }
            : { report_done: value };
    void supabase
      .from("projects")
      .update(patch)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          logger.error("[projects] setStage failed", {
            projectId: id,
            stage,
            error: error.message,
          });
          captureApiError(error, {
            table: "projects",
            operation: "update",
            context: `setStage_${stage}`,
          });
        } else {
          addDiagnosticBreadcrumb("projects:stage:updated", { projectId: id, stage });
        }
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
