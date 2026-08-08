/**
 * AI-upload slice — Room analysis persistence (browser context).
 *
 * Durable authority is the transactional RPC replace_project_room_analyses.
 * In-memory cache is updated only after successful durable replacement.
 */
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { fetchProjectPhotosList } from "@/lib/queries/projects";
import type { Json, Tables } from "@repo/supabase";
import {
  buildMockRoomAnalyses,
  hasMockAnalysis,
  persistenceFailedError,
  type AnalysisSource,
  type RoomAnalysis,
  PhotoAnalysisError,
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
} from "../../domain";
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
 * Map durable room_analyses list columns to domain string[].
 * Accepts PostgREST/jsonb historical Json arrays and canonical text[] (string[]).
 */
export function jsonToStringArray(value: Json | string[] | null | undefined): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") out.push(item);
  }
  return out;
}

const cache = new Map<string, RoomAnalysis[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function rowToAnalysis(r: Tables<"room_analyses">): RoomAnalysis {
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

type RpcAnalysisPayload = {
  photo_id: string;
  room_type: string;
  condition_level: string;
  refurbishment_level: string;
  visible_issues: string[];
  recommended_works: string[];
  ai_summary: string;
  confidence_score: number;
  source: string;
};

async function replaceViaRpc(projectId: string, analyses: RoomAnalysis[]): Promise<RoomAnalysis[]> {
  const user = auth.getUser();
  if (!user) {
    throw persistenceFailedError("not authenticated");
  }

  if (hasMockAnalysis(analyses) || analyses.some((a) => a.source === "mock")) {
    throw new PhotoAnalysisError(
      PHOTO_ANALYSIS_MOCK_FORBIDDEN,
      "Mock analysis results cannot be persisted as production analysis.",
    );
  }

  if (analyses.some((a) => !a.photo_id)) {
    throw persistenceFailedError("missing photo_id");
  }

  const payload: RpcAnalysisPayload[] = analyses.map((a) => ({
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
    logger.warn("[analysis] replace_project_room_analyses failed", { error: error.message });
    throw persistenceFailedError(error.message);
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw persistenceFailedError("empty RPC response");
  }

  const mapped = (data as Tables<"room_analyses">[]).map(rowToAnalysis);
  if (mapped.some((a) => !a.photo_id) || hasMockAnalysis(mapped)) {
    throw persistenceFailedError("invalid persisted rows");
  }
  return mapped;
}

function delay(ms = 1200) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Source photos for dev mock provider — canonical C5-1 list (C5-2). */
async function buildFromProjectPhotos(projectId: string): Promise<RoomAnalysis[]> {
  const photos = await fetchProjectPhotosList(projectId);
  if (photos.length === 0) {
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

  /**
   * Durable replacement is authoritative.
   * Resolves only after transactional RPC success; cache updates only then.
   */
  async save(projectId: string, analyses: RoomAnalysis[]): Promise<void> {
    if (hasMockAnalysis(analyses)) {
      throw new PhotoAnalysisError(
        PHOTO_ANALYSIS_MOCK_FORBIDDEN,
        "Mock analysis results cannot be persisted as production analysis.",
      );
    }

    const previous = cache.get(projectId);
    try {
      const persisted = await replaceViaRpc(projectId, analyses);
      cache.set(projectId, persisted);
      notify();
    } catch (err) {
      // Ensure failed save does not leave a false-success cache entry.
      if (previous === undefined) {
        cache.delete(projectId);
      } else {
        cache.set(projectId, previous);
      }
      throw err;
    }
  }

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Dev-only mock run (mockPhotoAnalysisProvider). Never hits durable production save.
   */
  async runMock(projectId: string): Promise<RoomAnalysis[]> {
    await delay();
    const result = await buildFromProjectPhotos(projectId);
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
