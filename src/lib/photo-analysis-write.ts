/**
 * Canonical browser-side photo_analysis_results write primitives (AO-1C1).
 *
 * Owns direct UPDATEs for UI edit of analysis rows.
 * Does NOT coordinate React Query, Auth resolution, or UI toasts —
 * presentation/hooks supply cache orchestration and user feedback.
 */
import { supabase } from "@/platform/supabase/browser";
import type { Json } from "@repo/supabase/database.types";

export interface UpdatePhotoAnalysisResultInput {
  id: string;
  category?: string | null;
  condition_report?: string | null;
  detected_defects: unknown;
  material_estimates: unknown;
  cost_suggestions: unknown;
  confidence_score?: number | null;
}

/**
 * Update a photo_analysis_results row by primary key.
 *
 * Preserves PhotoAnalysisViewer payload semantics:
 * - category from caller (not UI "room" alias)
 * - Json casts for defects / materials / cost suggestions
 * - client-supplied updated_at ISO string
 * - no .select() / no returned row
 * - no Auth lookup
 */
export async function updatePhotoAnalysisResult(
  input: UpdatePhotoAnalysisResultInput,
): Promise<void> {
  const { error } = await supabase
    .from("photo_analysis_results")
    .update({
      category: input.category ?? null,
      condition_report: input.condition_report ?? null,
      detected_defects: input.detected_defects as Json,
      material_estimates: input.material_estimates as Json,
      cost_suggestions: input.cost_suggestions as Json,
      confidence_score: input.confidence_score ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}
