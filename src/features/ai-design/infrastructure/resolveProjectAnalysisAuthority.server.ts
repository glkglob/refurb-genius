/**
 * Server-only: resolve current durable photo-analysis authority for a project.
 *
 * Used by redesign (and any investor AI path) so the browser cannot supply
 * stale/forged RoomAnalysis payloads as production authority.
 */
import "@tanstack/react-start/server-only";

import type { Json, Tables } from "@repo/supabase";
import {
  isProductionValidAnalysisSet,
  projectNotAuthorisedError,
  staleAnalysisRequiresReanalysisError,
  type AnalysisSource,
  type RoomAnalysis,
} from "@/features/ai-upload";

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
 * Load current project photos + room_analyses and return analyses only when
 * the set is production-valid against the live catalogue.
 *
 * Does not run vision, mutate data, or use client cache.
 */
export async function resolveCurrentProjectAnalysisAuthority(
  input: ResolveCurrentProjectAnalysisAuthorityInput,
): Promise<RoomAnalysis[]> {
  const { userId, projectId } = input;

  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError || !project) {
    // Fail closed without leaking another user's project existence.
    throw projectNotAuthorisedError();
  }

  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("id,url,name")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: true });

  if (photosError) {
    throw staleAnalysisRequiresReanalysisError();
  }

  const catalogue = (photos ?? []).map((p) => ({
    id: p.id,
    url: p.url,
    name: p.name,
  }));

  if (catalogue.length === 0) {
    throw staleAnalysisRequiresReanalysisError();
  }

  const { data: rows, error: analysesError } = await supabase
    .from("room_analyses")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (analysesError) {
    throw staleAnalysisRequiresReanalysisError();
  }

  const analyses = (rows ?? []).map(mapRoomAnalysisRow);

  if (!isProductionValidAnalysisSet(analyses, catalogue)) {
    throw staleAnalysisRequiresReanalysisError();
  }

  return analyses;
}
