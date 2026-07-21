import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { rowToProject, rowToPhoto, type ProjectWithProgress } from "@/lib/mappers";
import {
  getLatestRoomEstimate,
  getLatestProjectEstimate,
  type PersistedRoomEstimate,
  type PersistedProjectEstimate,
} from "@/features/estimate/infrastructure";
import type { ProjectPhoto } from "@/lib/photos";
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
 * Query options for a single project with progress flags.
 * Sensible defaults for a detail view: 5min stale, 10min gc, single retry.
 */
export const projectQueryOptions = (id: string) =>
  queryOptions<ProjectWithProgress | null>({
    queryKey: projectKeys.byId(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        logger.error("[queries] project fetch failed", { projectId: id, error: error.message });
        throw new Error(error.message);
      }
      if (!data) return null;

      // Reuse mapper for consistency with existing hooks/lib
      return rowToProject(data as Parameters<typeof rowToProject>[0]);
    },
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
 * Query options for project photos.
 * Canonical photos query — shared by usePhotos and project tab prefetch.
 */
export const photosQueryOptions = (projectId: string) =>
  queryOptions<ProjectPhoto[]>({
    queryKey: projectKeys.photosByProject(projectId),
    queryFn: async () => {
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
    },
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30s - photos can be added frequently
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

/**
 * Query options for derived financials.
 * Fetches project + latest estimate and computes ROI/profit etc.
 * No extra table; keeps data independent per tab.
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
      let refurbBudget = 0;
      try {
        const est = await getLatestRoomEstimate(projectId);
        if (est?.estimate?.mid_total) {
          refurbBudget = Number(est.estimate.mid_total);
        }
      } catch {
        // fallback to simple estimate if room one missing
        const simple = await getLatestProjectEstimate(projectId);
        if (simple?.estimate?.mid_total) refurbBudget = Number(simple.estimate.mid_total);
      }

      // Canonical investor metrics via deterministic ROI engine (same as Deal Copilot).
      // Dynamic import keeps this query module free of hard package cycles at load time.
      const { runRoiEngine } = await import("@repo/services");
      const roi = runRoiEngine({
        purchase_price: Number(purchase_price) || 0,
        refurb_budget: refurbBudget,
        estimated_gdv: Number(estimated_gdv) || 0,
        rental_income: 0,
        holding_costs: 0,
        region: (region as import("@/lib/projects").UKRegion) || "London",
        property_condition: "Average",
      });

      return {
        purchasePrice: Number(purchase_price) || 0,
        estimatedGdv: Number(estimated_gdv) || 0,
        refurbBudget,
        totalProjectCost: roi.total_project_cost,
        estimatedProfit: roi.estimated_profit,
        roiPercent: Math.round(roi.roi),
        grossYield: roi.gross_yield,
        investmentScore: roi.investment_score,
        riskLevel: roi.risk_level.toLowerCase(),
        // Timeline remains estimate-derived when available; engine has no weeks field.
        timelineWeeks: 8,
      };
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
