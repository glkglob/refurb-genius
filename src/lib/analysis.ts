import { type ProjectPhoto, photoStore } from "./photos";
import { auth } from "./auth";
import { supabase } from "@/services/supabase";
import { logger } from "./logger";
import {
  buildMockRoomAnalyses,
  type RoomAnalysis,
  type AnalysisSource,
} from "@/core/ai/mockAnalysis";
import type { Tables } from "@/integrations/supabase/types";
export {
  ROOM_TYPES,
  CONDITION_LEVELS,
  REFURB_LEVELS,
  buildMockRoomAnalyses,
} from "@/core/ai/mockAnalysis";
export type {
  AnalysisPhotoSource,
  AnalysisSource,
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/core/ai/mockAnalysis";

const cache = new Map<string, RoomAnalysis[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function buildFromProjectPhotos(projectId: string): RoomAnalysis[] {
  const photos = photoStore.list(projectId);
  return buildMockRoomAnalyses(
    photos.map((p: ProjectPhoto) => ({ id: p.id, url: p.url, name: p.name, size: p.size })),
  );
}

function delay(ms = 1200) {
  return new Promise((r) => setTimeout(r, ms));
}

function rowToAnalysis(r: Tables<"room_analyses">): RoomAnalysis {
  return {
    id: r.id,
    photo_url: r.photo_url,
    photo_name: r.photo_name,
    room_type: r.room_type as RoomAnalysis["room_type"],
    condition_level: r.condition_level as RoomAnalysis["condition_level"],
    refurbishment_level: r.refurbishment_level as RoomAnalysis["refurbishment_level"],
    visible_issues: r.visible_issues ?? [],
    recommended_works: r.recommended_works ?? [],
    ai_summary: r.ai_summary ?? "",
    confidence_score: Number(r.confidence_score ?? 0),
    // Use stored source when present (post-migration); fall back to "persisted"
    // for any legacy rows or during transition.
    source: (r.source as AnalysisSource) ?? "persisted",
  };
}

async function loadFromSupabase(projectId: string): Promise<RoomAnalysis[] | null> {
  try {
    const { data, error } = await supabase
      .from("room_analyses")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) {
      logger.warn("[analysis] failed to load persisted analyses", { error: error.message });
      return null;
    }
    if (!data?.length) return null;
    return data.map(rowToAnalysis);
  } catch {
    return null;
  }
}

async function persistToSupabase(projectId: string, analyses: RoomAnalysis[]): Promise<void> {
  const user = auth.getUser();
  if (!user) return;

  try {
    await supabase.from("room_analyses").delete().eq("project_id", projectId);

    if (analyses.length > 0) {
      const rows = analyses.map((a) => ({
        project_id: projectId,
        user_id: user.id,
        photo_url: a.photo_url,
        photo_name: a.photo_name,
        room_type: a.room_type,
        condition_level: a.condition_level,
        refurbishment_level: a.refurbishment_level,
        visible_issues: a.visible_issues,
        recommended_works: a.recommended_works,
        ai_summary: a.ai_summary,
        confidence_score: a.confidence_score,
        source: a.source,
      }));
      const { error } = await supabase.from("room_analyses").insert(rows);
      if (error) {
        logger.warn("[analysis] failed to persist analyses", { error: error.message });
      }
    }
  } catch {
    logger.warn("[analysis] persist failed silently");
  }
}

export const analysisStore = {
  get(projectId: string): RoomAnalysis[] | undefined {
    return cache.get(projectId);
  },
  set(projectId: string, analyses: RoomAnalysis[]): void {
    cache.set(projectId, analyses);
    notify();
    void persistToSupabase(projectId, analyses);
  },
  async load(projectId: string): Promise<RoomAnalysis[] | undefined> {
    const cached = cache.get(projectId);
    if (cached) return cached;
    const persisted = await loadFromSupabase(projectId);
    if (persisted) {
      cache.set(projectId, persisted);
      notify();
      return persisted;
    }
    return undefined;
  },
  /** Run mock analysis from local photo metadata. This is a dev-only
   *  convenience used by `mockPhotoAnalysisProvider`. In production the UI
   *  calls `runPhotoAnalysis()` from `@/core/ai` which routes through
   *  `serverPhotoAnalysisProvider` → `runPhotoAnalysisServerFn` → real
   *  OpenAI Vision pipeline. */
  async run(projectId: string): Promise<RoomAnalysis[]> {
    await delay();
    const result = buildFromProjectPhotos(projectId);
    cache.set(projectId, result);
    notify();
    void persistToSupabase(projectId, result);
    return result;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

if (typeof window !== "undefined") {
  auth.onChange(() => {
    cache.clear();
    notify();
  });
}
