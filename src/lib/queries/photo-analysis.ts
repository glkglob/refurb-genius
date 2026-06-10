import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import type { PhotoAnalysisResult } from "@repo/types";
import { projectKeys } from "./projects";

export type PhotoAnalysisResultRow = Tables<"photo_analysis_results">;

/**
 * Photo analysis query keys (tied to project + optional photo).
 */
export const photoAnalysisKeys = {
  all: ["photoAnalysis"] as const,
  byProject: (projectId: string) => [...projectKeys.photoAnalysisByProject(projectId)] as const,
  byPhoto: (photoId: string) => [...photoAnalysisKeys.all, "photo", photoId] as const,
};

/**
 * All analysis results for a project (used in Photos & AI tab, reports).
 * More volatile after bulk upload + AI trigger.
 */
export const photoAnalysisByProjectQueryOptions = (projectId: string) =>
  queryOptions<PhotoAnalysisResultRow[]>({
    queryKey: photoAnalysisKeys.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_analysis_results")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[queries] photo analysis (project) fetch failed", {
          projectId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as PhotoAnalysisResultRow[];
    },
    enabled: !!projectId,
    staleTime: 20 * 1000, // 20s - analysis is produced async after upload
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

/**
 * Analysis for a specific photo (detail view / re-run).
 */
export const photoAnalysisByPhotoQueryOptions = (photoId: string) =>
  queryOptions<PhotoAnalysisResultRow | null>({
    queryKey: photoAnalysisKeys.byPhoto(photoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_analysis_results")
        .select("*")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (error) {
        logger.error("[queries] photo analysis (photo) fetch failed", {
          photoId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data as PhotoAnalysisResultRow | null) ?? null;
    },
    enabled: !!photoId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
