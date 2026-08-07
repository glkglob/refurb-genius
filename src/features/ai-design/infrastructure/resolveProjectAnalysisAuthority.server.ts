/**
 * Server-only: resolve current durable photo-analysis authority for a project.
 *
 * Uses get_current_project_analysis_authority (projects FOR SHARE) so the
 * catalogue cannot change mid-resolution and client payloads are never trusted.
 */
import "@tanstack/react-start/server-only";

import type { Tables } from "@repo/supabase";
import {
  projectNotAuthorisedError,
  staleAnalysisRequiresReanalysisError,
  type AnalysisSource,
  type RoomAnalysis,
} from "@/features/ai-upload";
import type { Json } from "@repo/supabase";

export type ResolveCurrentProjectAnalysisAuthorityInput = {
  userId: string;
  projectId: string;
};

const VALID_SOURCES: ReadonlySet<string> = new Set<AnalysisSource>([
  "ai",
  "mock",
  "fallback",
  "persisted",
]);

function isAnalysisSource(value: unknown): value is AnalysisSource {
  return typeof value === "string" && VALID_SOURCES.has(value);
}

function jsonToStringArray(value: Json | null | undefined): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Pure row map — mirrors browser repository without importing browser clients. */
export function mapRoomAnalysisRow(r: Tables<"room_analyses">): RoomAnalysis {
  return {
    id: r.id,
    photo_id: r.photo_id ?? null,
    photo_url: r.photo_url,
    photo_name: r.photo_name,
    room_type: r.room_type as RoomAnalysis["room_type"],
    condition_level: r.condition_level as RoomAnalysis["condition_level"],
    refurbishment_level: r.refurbishment_level as RoomAnalysis["refurbishment_level"],
    visible_issues: jsonToStringArray(r.visible_issues),
    recommended_works: jsonToStringArray(r.recommended_works),
    ai_summary: r.ai_summary ?? "",
    confidence_score: Number(r.confidence_score ?? 0),
    source: isAnalysisSource(r.source) ? r.source : "persisted",
  };
}

/**
 * Load a serialized current authority view via database RPC.
 * Does not run vision, mutate data, or use client cache/analyses.
 */
export async function resolveCurrentProjectAnalysisAuthority(
  input: ResolveCurrentProjectAnalysisAuthorityInput,
): Promise<RoomAnalysis[]> {
  const { projectId } = input;
  // userId is enforced inside the RPC via auth.uid(); retained for call-site clarity.
  void input.userId;

  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_current_project_analysis_authority", {
    p_project_id: projectId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/project_not_authorised|42501|PGRST301/i.test(msg)) {
      throw projectNotAuthorisedError();
    }
    throw staleAnalysisRequiresReanalysisError();
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw staleAnalysisRequiresReanalysisError();
  }

  return (data as Tables<"room_analyses">[]).map(mapRoomAnalysisRow);
}
