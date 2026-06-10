/**
 * AI-upload slice — Room analysis persistence (browser context).
 *
 * Moved from `src/lib/analysis.ts` (analysisStore is now a shim).
 * DB mapping + in-memory cache only — vision AI never runs here.
 */
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { photoStore } from "@/lib/photos";
import type { Tables } from "@repo/supabase";
import { buildMockRoomAnalyses, type AnalysisSource, type RoomAnalysis } from "../../domain";
import type { RoomAnalysisRepository as RoomAnalysisRepositoryPort } from "../../application/ports";

const VALID_SOURCES: ReadonlySet<string> = new Set<AnalysisSource>([
  "ai",
  "mock",
  "fallback",
  "persisted",
]);

function isAnalysisSource(value: unknown): value is AnalysisSource {
  return typeof value === "string" && VALID_SOURCES.has(value);
}

const cache = new Map<string, RoomAnalysis[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

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
    source: isAnalysisSource(r.source) ? r.source : "persisted",
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

function delay(ms = 1200) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildFromProjectPhotos(projectId: string): RoomAnalysis[] {
  const photos = photoStore.list(projectId);
  return buildMockRoomAnalyses(
    photos.map((p) => ({ id: p.id, url: p.url, name: p.name, size: p.size })),
  );
}

export class SupabaseRoomAnalysisRepository implements RoomAnalysisRepositoryPort {
  get(projectId: string): RoomAnalysis[] | undefined {
    return cache.get(projectId);
  }

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
  }

  async save(projectId: string, analyses: RoomAnalysis[]): Promise<void> {
    cache.set(projectId, analyses);
    notify();
    await persistToSupabase(projectId, analyses);
  }

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /** Dev-only mock run from local photo metadata (mockPhotoAnalysisProvider). */
  async runMock(projectId: string): Promise<RoomAnalysis[]> {
    await delay();
    const result = buildFromProjectPhotos(projectId);
    await this.save(projectId, result);
    return result;
  }
}

export const supabaseRoomAnalysisRepository = new SupabaseRoomAnalysisRepository();

/** Legacy-compatible store surface — prefer the repository port in new code. */
export const analysisStore = {
  get: (projectId: string) => supabaseRoomAnalysisRepository.get(projectId),
  set: (projectId: string, analyses: RoomAnalysis[]) => {
    void supabaseRoomAnalysisRepository.save(projectId, analyses);
  },
  load: (projectId: string) => supabaseRoomAnalysisRepository.load(projectId),
  run: (projectId: string) => supabaseRoomAnalysisRepository.runMock(projectId),
  subscribe: (fn: () => void) => supabaseRoomAnalysisRepository.subscribe(fn),
};

if (typeof window !== "undefined") {
  auth.onChange(() => {
    cache.clear();
    notify();
  });
}
