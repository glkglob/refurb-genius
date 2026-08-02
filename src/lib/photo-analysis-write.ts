/**
 * Canonical browser-side photo_analysis_results write primitives (AO-1C1 / P1B2).
 *
 * Owns direct UPDATEs for UI edit of analysis rows.
 * Persists content into analysis_data (jsonb) and confidence (canonical columns).
 * Does NOT coordinate React Query, Auth resolution, or UI toasts —
 * presentation/hooks supply cache orchestration and user feedback.
 */
import { supabase } from "@/platform/supabase/browser";
import type { Json, TablesUpdate } from "@repo/supabase/database.types";
import { serializePhotoAnalysisContent } from "@repo/types";

export interface UpdatePhotoAnalysisResultInput {
  id: string;
  category?: string | null;
  condition_report?: string | null;
  detected_defects: unknown;
  material_estimates: unknown;
  cost_suggestions: unknown;
  /** Application confidence 0–1; written to canonical `confidence` column. */
  confidence_score?: number | null;
}

/**
 * Canonical update payload for photo_analysis_results.
 * Tracked generated types still list obsolete flat columns; the live migration
 * contract uses analysis_data + confidence. Cast is intentional at this write
 * boundary only.
 */
type PhotoAnalysisCanonicalUpdate = {
  analysis_data: Json;
  confidence: number | null;
  updated_at: string;
};

/**
 * Update a photo_analysis_results row by primary key.
 *
 * Preserves PhotoAnalysisViewer payload semantics:
 * - category from caller (not UI "room" alias)
 * - full replacement of known content fields inside analysis_data
 * - client-supplied updated_at ISO string
 * - no .select() / no returned row
 * - no Auth lookup
 */
export async function updatePhotoAnalysisResult(
  input: UpdatePhotoAnalysisResultInput,
): Promise<void> {
  const analysis_data = serializePhotoAnalysisContent({
    category: input.category ?? null,
    condition_report: input.condition_report ?? null,
    detected_defects: input.detected_defects,
    material_estimates: input.material_estimates,
    cost_suggestions: input.cost_suggestions,
  }) as Json;

  const payload: PhotoAnalysisCanonicalUpdate = {
    analysis_data,
    confidence: input.confidence_score ?? null,
    updated_at: new Date().toISOString(),
  };

  // Dual-type boundary: tracked Update omits analysis_data/confidence; canonical
  // Update accepts them. Runtime writes the migration-built contract.
  const { error } = await supabase
    .from("photo_analysis_results")
    .update(payload as unknown as TablesUpdate<"photo_analysis_results">)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}
