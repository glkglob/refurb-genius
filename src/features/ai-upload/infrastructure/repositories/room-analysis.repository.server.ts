/**
 * Server-only room_analyses persistence for Bearer mobile Analysis.
 *
 * Uses the authenticated token client (SECURITY INVOKER RPC).
 * Never imports the browser repository (Capacitor/cookie auth).
 */
import "@tanstack/react-start/server-only";

import type { Json, Tables } from "@repo/supabase";
import {
  hasMockAnalysis,
  persistenceFailedError,
  PhotoAnalysisError,
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
  type AnalysisSource,
  type RoomAnalysis,
} from "../../domain";
import type { PhotoAnalysisAuthClient } from "../resolveAuthorizedPhotos.server";

const VALID_SOURCES: ReadonlySet<string> = new Set<AnalysisSource>([
  "ai",
  "mock",
  "fallback",
  "persisted",
]);

function isAnalysisSource(value: unknown): value is AnalysisSource {
  return typeof value === "string" && VALID_SOURCES.has(value);
}

function jsonToStringArray(value: Json | string[] | null | undefined): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") out.push(item);
  }
  return out;
}

export function rowToServerAnalysis(r: Tables<"room_analyses">): RoomAnalysis {
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

type AnalysisListQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
    };
  };
};

function asAnalysisListQuery(value: unknown): AnalysisListQuery {
  return value as AnalysisListQuery;
}

export async function listProjectRoomAnalysesWithClient(
  supabase: PhotoAnalysisAuthClient,
  projectId: string,
): Promise<RoomAnalysis[]> {
  const { data, error } = await asAnalysisListQuery(supabase.from("room_analyses"))
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw persistenceFailedError(error.message);
  }
  if (!data) return [];
  return (data as Tables<"room_analyses">[]).map(rowToServerAnalysis);
}

export async function replaceProjectRoomAnalysesWithClient(
  supabase: PhotoAnalysisAuthClient,
  projectId: string,
  analyses: RoomAnalysis[],
): Promise<RoomAnalysis[]> {
  if (hasMockAnalysis(analyses) || analyses.some((a) => a.source === "mock")) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_MOCK_FORBIDDEN,
      "Mock analysis results cannot be persisted as production analysis.",
    );
  }

  if (analyses.some((a) => !a.photo_id)) {
    throw persistenceFailedError("missing photo_id");
  }

  const payload = analyses.map((a) => ({
    photo_id: a.photo_id as string,
    room_type: a.room_type,
    condition_level: a.condition_level,
    refurbishment_level: a.refurbishment_level,
    visible_issues: a.visible_issues,
    recommended_works: a.recommended_works,
    ai_summary: a.ai_summary,
    confidence_score: a.confidence_score,
    source: a.source,
  }));

  const { data, error } = await supabase.rpc("replace_project_room_analyses", {
    p_project_id: projectId,
    p_analyses: payload,
  });

  if (error) {
    throw persistenceFailedError(error.message);
  }
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw persistenceFailedError("empty RPC response");
  }

  const mapped = (data as Tables<"room_analyses">[]).map(rowToServerAnalysis);
  if (mapped.some((a) => !a.photo_id) || hasMockAnalysis(mapped)) {
    throw persistenceFailedError("invalid persisted rows");
  }
  return mapped;
}
