/**
 * AI-upload slice — Room analysis persistence (browser context).
 *
 * Moved from `src/lib/analysis.ts` (analysisStore is now a shim).
 * DB mapping + in-memory cache only — vision AI never runs here.
 */
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { fetchProjectPhotosList } from "@/lib/queries/projects";
import type { Json, Tables } from "@repo/supabase";
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

/**
 * Map migration-built jsonb columns (generated as Json) to domain string[].
 *
 * Rule:
 * - null / undefined / non-array → []
 * - array → keep only string elements (drop numbers, objects, nested arrays)
 *
 * Keeps raw Json at the infrastructure boundary; presentation never sees Json.
 */
export function jsonToStringArray(value: Json | null | undefined): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
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
    visible_issues: jsonToStringArray(r.visible_issues),
    recommended_works: jsonToStringArray(r.recommended_works),
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

  // Production path must not persist mock demo analyses as project authority.
  if (analyses.some((a) => a.source === "mock")) {
    logger.warn("[analysis] refused to persist mock analysis rows", { projectId });
    return;
  }

  try {
    // Non-destructive replacement: insert new rows first, then retire prior rows.
    // A failed AI/persist must not wipe existing analysis before replacement succeeds.
    const { data: existing, error: existingError } = await supabase
      .from("room_analyses")
      .select("id")
      .eq("project_id", projectId);
    if (existingError) {
      logger.warn("[analysis] failed to load existing analysis ids", {
        error: existingError.message,
      });
      return;
    }

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
        return;
      }
    }

    const priorIds = (existing ?? []).map((r) => r.id).filter(Boolean);
    if (priorIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("room_analyses")
        .delete()
        .in("id", priorIds);
      if (deleteError) {
        logger.warn("[analysis] failed to retire prior analyses after insert", {
          error: deleteError.message,
        });
      }
    }
  } catch {
    logger.warn("[analysis] persist failed silently");
  }
}

function delay(ms = 1200) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Source photos for dev mock provider — canonical C5-1 list (C5-2). */
async function buildFromProjectPhotos(projectId: string): Promise<RoomAnalysis[]> {
  const photos = await fetchProjectPhotosList(projectId);
  if (photos.length === 0) {
    // Never invent FALLBACK_PHOTOS as project analysis when the catalogue is empty.
    return [];
  }
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
    // In-memory cache may hold results for UI; DB path refuses mock rows.
    cache.set(projectId, analyses);
    notify();
    await persistToSupabase(projectId, analyses);
  }

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Dev-only mock run from project photo metadata (mockPhotoAnalysisProvider).
   * Not used by production serverPhotoAnalysisProvider. Empty catalogue → no mock rows.
   */
  async runMock(projectId: string): Promise<RoomAnalysis[]> {
    await delay();
    const result = await buildFromProjectPhotos(projectId);
    // Cache only for local mock provider — do not hit DB with source=mock.
    cache.set(projectId, result);
    notify();
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
