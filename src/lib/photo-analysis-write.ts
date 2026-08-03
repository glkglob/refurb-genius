/**
 * Canonical browser-side photo_analysis_results write primitives (AO-1C1 / P1B2 / P1B2R).
 *
 * Owns direct UPDATEs for UI edit of analysis rows.
 * Persists content into analysis_data (jsonb) and confidence (canonical columns).
 * Does NOT coordinate React Query, Auth resolution, or UI toasts —
 * presentation/hooks supply cache orchestration and user feedback.
 */
import { supabase } from "@/platform/supabase/browser";
import type { Json, TablesUpdate } from "@repo/supabase/database.types";
import { serializePhotoAnalysisContent, type PhotoAnalysisJson } from "@repo/types";

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
 * Migration-built update columns for public.photo_analysis_results.
 * analysis_data is Supabase Json produced by a total PhotoAnalysisJson → Json map
 * (no assertion).
 */
type CanonicalPhotoAnalysisUpdate = {
  analysis_data: Json;
  confidence: number | null;
  updated_at: string;
};

/**
 * Total function: PhotoAnalysisJson → Json.
 *
 * PhotoAnalysisJson is the domain JSON union (same shape as Supabase Json).
 * Mapping is structural and omits `undefined` object properties so the result
 * is always JSON-serializable without assertion.
 */
function photoAnalysisJsonToSupabaseJson(value: PhotoAnalysisJson): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    // Reject non-finite numbers — not valid JSON for persistence
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => photoAnalysisJsonToSupabaseJson(item));
  }
  const out: { [key: string]: Json | undefined } = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    out[key] = photoAnalysisJsonToSupabaseJson(child);
  }
  return out;
}

/**
 * Update a photo_analysis_results row by primary key.
 *
 * Preserves PhotoAnalysisViewer payload semantics:
 * - category from caller (not UI "room" alias)
 * - full replacement of known content fields inside analysis_data
 * - client-supplied updated_at ISO string
 * - no .select() / no returned row
 * - no Auth lookup
 *
 * Dual-baseline typing (P1B2R):
 * - Runtime payload is always the migration contract:
 *   { analysis_data, confidence, updated_at }.
 * - Client Update typing differs between tracked (flat historical columns) and
 *   canonical generation (analysis_data + confidence).
 * - Structural assignability: CanonicalPhotoAnalysisUpdate is assignable to
 *   TablesUpdate under both baselines (tracked Update fields are optional;
 *   canonical Update includes the same keys). Typing the argument as
 *   TablesUpdate satisfies postgrest-js RejectExcessProperties without
 *   a double assertion while the runtime object retains canonical fields.
 */
export async function updatePhotoAnalysisResult(
  input: UpdatePhotoAnalysisResultInput,
): Promise<void> {
  const analysis_data = photoAnalysisJsonToSupabaseJson(
    serializePhotoAnalysisContent({
      category: input.category ?? null,
      condition_report: input.condition_report ?? null,
      detected_defects: input.detected_defects,
      material_estimates: input.material_estimates,
      cost_suggestions: input.cost_suggestions,
    }),
  );

  const canonical: CanonicalPhotoAnalysisUpdate = {
    analysis_data,
    confidence: input.confidence_score ?? null,
    updated_at: new Date().toISOString(),
  };

  const payload: TablesUpdate<"photo_analysis_results"> = canonical;

  const { error } = await supabase
    .from("photo_analysis_results")
    .update(payload)
    .eq("id", input.id);

  if (error) {
    throw error;
  }
}
