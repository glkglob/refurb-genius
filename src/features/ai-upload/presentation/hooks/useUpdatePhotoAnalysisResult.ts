/**
 * Presentation-safe photo_analysis_results edit mutation (AO-1C1).
 *
 * Owns React Query optimistic cache for photoAnalysisByProject.
 * Delegates persistence to src/lib/photo-analysis-write.ts.
 * Does not own toasts, dialog state, or Apply-to-Estimate cache.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePhotoAnalysisResult } from "@/lib/photo-analysis-write";
import {
  photoAnalysisByProjectQueryOptions,
  type PhotoAnalysisResultRow,
} from "@/lib/queries/photo-analysis";
import { parsePhotoAnalysisContent } from "@repo/types";
import type { Json } from "@repo/supabase/database.types";

export interface UpdatePhotoAnalysisResultMutationInput {
  id: string;
  newData: {
    category?: string;
    condition_report?: string;
    defects?: unknown[];
    material_estimates?: unknown[];
    cost_suggestions?: {
      low?: number;
      mid?: number;
      high?: number;
    };
    confidence?: number;
  };
}

export interface UpdatePhotoAnalysisResultMutationResult {
  id: string;
  newData: UpdatePhotoAnalysisResultMutationInput["newData"];
}

type OptimisticCtx = {
  previous?: PhotoAnalysisResultRow[];
};

/**
 * Mutation hook for saving edited analysis fields for a project.
 * Pass the same projectId used for photoAnalysisByProjectQueryOptions.
 *
 * Persistence writes analysis_data + confidence (canonical columns).
 * Optimistic cache patches the application model fields only.
 */
export function useUpdatePhotoAnalysisResult(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    UpdatePhotoAnalysisResultMutationResult,
    Error,
    UpdatePhotoAnalysisResultMutationInput,
    OptimisticCtx
  >({
    mutationFn: async ({ id, newData }) => {
      await updatePhotoAnalysisResult({
        id,
        category: newData.category ?? null,
        condition_report: newData.condition_report ?? null,
        detected_defects: newData.defects ?? [],
        material_estimates: newData.material_estimates ?? [],
        cost_suggestions: newData.cost_suggestions ?? {},
        confidence_score: newData.confidence ?? null,
      });
      return { id, newData };
    },
    retry: false,
    onMutate: async ({ id, newData }) => {
      const key = photoAnalysisByProjectQueryOptions(projectId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PhotoAnalysisResultRow[]>(key);
      // Parse optimistic content through the same guards as the DB mapper
      const optimisticJson: Json = {
        category: newData.category ?? null,
        condition_report: newData.condition_report ?? null,
        detected_defects: (newData.defects ?? []) as Json,
        material_estimates: (newData.material_estimates ?? []) as Json,
        cost_suggestions: (newData.cost_suggestions ?? {}) as Json,
      };
      const parsed = parsePhotoAnalysisContent(optimisticJson);
      queryClient.setQueryData<PhotoAnalysisResultRow[]>(key, (old = []) =>
        old.map((a) =>
          a.id === id
            ? {
                ...a,
                category: parsed.category,
                condition_report: parsed.condition_report,
                detected_defects: parsed.detected_defects,
                material_estimates: parsed.material_estimates,
                cost_suggestions: parsed.cost_suggestions,
                confidence_score: newData.confidence ?? null,
              }
            : a,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          photoAnalysisByProjectQueryOptions(projectId).queryKey,
          ctx.previous,
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: photoAnalysisByProjectQueryOptions(projectId).queryKey,
      });
    },
  });
}
