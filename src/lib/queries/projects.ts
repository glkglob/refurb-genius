import { Capacitor } from "@capacitor/core";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { rowToProject, rowToPhoto, type ProjectWithProgress } from "@/lib/mappers";
import {
  getLatestRoomEstimate,
  getLatestProjectEstimate,
  type PersistedRoomEstimate,
  type PersistedProjectEstimate,
} from "@/features/estimate";
import type { ProjectPhoto } from "@/lib/photos-types";
import { logger } from "@/lib/logger";

export type Financials = {
  purchasePrice: number;
  estimatedGdv: number;
  refurbBudget: number;
  totalProjectCost: number;
  estimatedProfit: number;
  roiPercent: number;
  grossYield: number;
  investmentScore: number;
  riskLevel: string;
  timelineWeeks: number;
};

/**
 * Centralized query key factory for all project-related data.
 * Used for consistent invalidation, prefetching, and caching across tabs.
 */
export const projectKeys = {
  all: ["projects"] as const,
  byId: (id: string) => [...projectKeys.all, id] as const,
  estimateByProject: (projectId: string) => [...projectKeys.byId(projectId), "estimate"] as const,
  photosByProject: (projectId: string) => [...projectKeys.byId(projectId), "photos"] as const,
  financialsByProject: (projectId: string) =>
    [...projectKeys.byId(projectId), "financials"] as const,
  // New feature foundation keys (project-scoped data for tabs / prefetch)
  floorplansByProject: (projectId: string) =>
    [...projectKeys.byId(projectId), "floorplans"] as const,
  photoAnalysisByProject: (projectId: string) =>
    [...projectKeys.byId(projectId), "photoAnalysis"] as const,
  pitchDecksByProject: (projectId: string) =>
    [...projectKeys.byId(projectId), "pitchDecks"] as const,
  galleryByProject: (projectId: string) => [...projectKeys.byId(projectId), "gallery"] as const,
} as const;

/**
 * Canonical full Projects list fetch (C4c-6).
 * Single network authority for dashboard + catalog adapters.
 *
 * Web: browser pip-auth Supabase client.
 * Native: Keychain-backed getNativeSupabase via listProjectsNative (dynamic import
 * so SecureStorage is not in the web/SSR graph).
 */
export async function fetchProjectsList(): Promise<ProjectWithProgress[]> {
  if (Capacitor.isNativePlatform()) {
    const { listProjectsNative } = await import("@/platform/supabase/native-projects");
    const rows = await listProjectsNative();
    return rows.map(rowToProject);
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("[queries] projects list fetch failed", { error: error.message });
    throw new Error(error.message);
  }
  return (data ?? []).map(rowToProject);
}

/**
 * Canonical single-project fetch (C4c-2).
 * Web uses the browser client; native uses getNativeSupabase (dynamic import).
 */
export async function fetchProjectById(id: string): Promise<ProjectWithProgress | null> {
  if (Capacitor.isNativePlatform()) {
    const { getProjectNative } = await import("@/platform/supabase/native-projects");
    const row = await getProjectNative(id);
    return row ? rowToProject(row) : null;
  }

  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();

  if (error) {
    logger.error("[queries] project fetch failed", { projectId: id, error: error.message });
    throw new Error(error.message);
  }
  if (!data) return null;

  return rowToProject(data as Parameters<typeof rowToProject>[0]);
}

/**
 * Canonical Projects list query options (C4c-6).
 * Key is exactly projectKeys.all — shared by useProjects and catalog adapters.
 * Auth gating (`enabled`) is applied by hooks (useAuth user present).
 */
export const projectsListQueryOptions = () =>
  queryOptions<ProjectWithProgress[]>({
    queryKey: projectKeys.all,
    queryFn: fetchProjectsList,
  });

/**
 * Query options for a single project with progress flags.
 * Sensible defaults for a detail view: 5min stale, 10min gc, single retry.
 */
export const projectQueryOptions = (id: string) =>
  queryOptions<ProjectWithProgress | null>({
    queryKey: projectKeys.byId(id),
    queryFn: () => fetchProjectById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

/**
 * Query options for the latest room-based estimate (used by Estimate Builder).
 * Independent cache per project so tabs can load separately.
 */
export const estimateQueryOptions = (projectId: string) =>
  queryOptions<PersistedRoomEstimate | null>({
    queryKey: projectKeys.estimateByProject(projectId),
    queryFn: () => getLatestRoomEstimate(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 min - estimates change less frequently
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });

/**
 * Canonical authenticated project-photo list fetch (C5-1).
 * Single network authority for product-UI photo lists (usePhotos, route prefetch)
 * and AI source-photo catalog / mock room-analysis reads (C5-2).
 * Web: browser pip-auth Supabase client.
 * Native: Keychain getNativeSupabase via listPhotosNative (dynamic import).
 * Writes: src/lib/photos-write.ts. photoStore retired (C5-4).
 */
export async function fetchProjectPhotosList(projectId: string): Promise<ProjectPhoto[]> {
  if (Capacitor.isNativePlatform()) {
    const { listPhotosNative } = await import("@/platform/supabase/native-photos");
    const rows = await listPhotosNative(projectId);
    return rows.map(rowToPhoto);
  }

  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    logger.error("[queries] photos fetch failed", { projectId, error: error.message });
    throw new Error(error.message);
  }
  return (data ?? []).map(rowToPhoto);
}

/**
 * Query options for project photos.
 * Canonical photos query — shared by usePhotos and project tab prefetch (C5-1).
 * Key: projectKeys.photosByProject. Fetch: fetchProjectPhotosList.
 * Auth gating (`enabled` with user) is applied by usePhotos; factory enables on projectId.
 */
export const photosQueryOptions = (projectId: string) =>
  queryOptions<ProjectPhoto[]>({
    queryKey: projectKeys.photosByProject(projectId),
    queryFn: () => fetchProjectPhotosList(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30s - photos can be added frequently
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

/**
 * Query options for derived financials.
 * Fetches project + latest estimate and computes ROI/profit etc.
 * No extra table; keeps data independent per tab.
 *
 * P0-1: ROI inputs + Financials DTO via @repo/services calculateFinancialPath
 * (canonical normalizer + runRoiEngine once). mid_total remains refurb authority.
 * Defaults (Average / London / 0 holding / 0 rental / timeline 8) live in the
 * Financials-path policy inside packages/services — not ad hoc in this query.
 */
export const financialsQueryOptions = (projectId: string) =>
  queryOptions<Financials | null>({
    queryKey: projectKeys.financialsByProject(projectId),
    queryFn: async () => {
      // Fetch project for base numbers
      const projectRes = await supabase
        .from("projects")
        .select("purchase_price, estimated_gdv, region")
        .eq("id", projectId)
        .maybeSingle();

      if (projectRes.error || !projectRes.data) return null;

      const { purchase_price, estimated_gdv, region } = projectRes.data;

      // Fetch latest estimate (prefer room-based for detailed budget)
      let midTotal: number | undefined;
      try {
        const est = await getLatestRoomEstimate(projectId);
        if (est?.estimate?.mid_total) {
          midTotal = Number(est.estimate.mid_total);
        }
      } catch {
        // fallback to simple estimate if room one missing
        const simple = await getLatestProjectEstimate(projectId);
        if (simple?.estimate?.mid_total) midTotal = Number(simple.estimate.mid_total);
      }

      // Canonical Financials path: normalize + runRoiEngine once (dynamic import
      // keeps this query module free of hard package cycles at load time).
      const { calculateFinancialPath } = await import("@repo/services");
      const { financials } = calculateFinancialPath({
        purchase_price,
        estimated_gdv,
        region,
        mid_total: midTotal,
      });

      return financials;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

/**
 * Optimistic mutation helpers (usable by any feature query file).
 * Call from useMutation onMutate / onError for list-based data (favorites, annotations, messages, etc).
 * Keeps existing tabs / EstimateBuilder etc. untouched.
 */
export function optimisticSetList<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater: (oldData: T[] | undefined) => T[],
): T[] | undefined {
  const previous = queryClient.getQueryData<T[]>(queryKey);
  queryClient.setQueryData<T[]>(queryKey, (old) => updater(old));
  return previous;
}

export function rollbackList<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  previous: T[] | undefined,
): void {
  if (previous !== undefined) {
    queryClient.setQueryData(queryKey, previous);
  }
}

// ─── C4c-3: Project list/detail mutation cache helpers ─────────────────────

/** Stage progress booleans on ProjectWithProgress (photos_done, …). */
export type ProjectStageDoneField =
  | "photos_done"
  | "analysis_done"
  | "estimate_done"
  | "report_done";

/** Partial progress patch for stage optimistic updates. */
export type ProjectProgressPatch = Partial<Pick<ProjectWithProgress, ProjectStageDoneField>>;

/** Maps workflow stage name → ProjectWithProgress progress field. */
export function projectStageDoneField(
  stage: "photos" | "analysis" | "estimate" | "report",
): ProjectStageDoneField {
  return `${stage}_done`;
}

export function projectStagePatch(
  stage: "photos" | "analysis" | "estimate" | "report",
  value: boolean,
): ProjectProgressPatch {
  return { [projectStageDoneField(stage)]: value };
}

/**
 * Immutable list patch: update matching project id only.
 * Returns undefined when list cache is absent (does not invent []).
 */
export function patchProjectInList(
  projects: ProjectWithProgress[] | undefined,
  projectId: string,
  patch: ProjectProgressPatch,
): ProjectWithProgress[] | undefined {
  if (projects === undefined) return undefined;
  return projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p));
}

/**
 * Immutable detail patch.
 * - undefined → undefined (absent cache; never fabricate)
 * - null → null (missing-project result; never fabricate)
 * - object → shallow-merged ProjectWithProgress
 */
export function patchProjectDetail(
  project: ProjectWithProgress | null | undefined,
  patch: ProjectProgressPatch,
): ProjectWithProgress | null | undefined {
  if (project === undefined) return undefined;
  if (project === null) return null;
  return { ...project, ...patch };
}

export type ProjectStageCacheSnapshot = {
  previousList: ProjectWithProgress[] | undefined;
  previousDetail: ProjectWithProgress | null | undefined;
};

/**
 * Apply stage optimistic updates to list + detail caches.
 * Detail is written only when an existing Project object is cached
 * (not when undefined or null).
 */
export function applyProjectStageOptimistic(
  queryClient: QueryClient,
  projectId: string,
  patch: ProjectProgressPatch,
): ProjectStageCacheSnapshot {
  const previousList = queryClient.getQueryData<ProjectWithProgress[]>(projectKeys.all);
  const previousDetail = queryClient.getQueryData<ProjectWithProgress | null>(
    projectKeys.byId(projectId),
  );

  if (previousList !== undefined) {
    queryClient.setQueryData<ProjectWithProgress[]>(
      projectKeys.all,
      patchProjectInList(previousList, projectId, patch),
    );
  }

  // Only patch a real Project object — never seed absent or null detail.
  if (previousDetail != null) {
    queryClient.setQueryData<ProjectWithProgress | null>(
      projectKeys.byId(projectId),
      patchProjectDetail(previousDetail, patch),
    );
  }

  return { previousList, previousDetail };
}

/**
 * Restore list and detail snapshots independently.
 * - undefined previous → leave cache absent (do not write)
 * - null detail previous → restore null
 * - array/object previous → restore value
 */
export function restoreProjectStageCaches(
  queryClient: QueryClient,
  projectId: string,
  snapshot: ProjectStageCacheSnapshot,
): void {
  if (snapshot.previousList !== undefined) {
    queryClient.setQueryData(projectKeys.all, snapshot.previousList);
  }
  if (snapshot.previousDetail !== undefined) {
    queryClient.setQueryData(projectKeys.byId(projectId), snapshot.previousDetail);
  }
}

/** Seed canonical detail cache after create (complete ProjectWithProgress). */
export function seedProjectDetailCache(
  queryClient: QueryClient,
  project: ProjectWithProgress,
): void {
  queryClient.setQueryData(projectKeys.byId(project.id), project);
}
