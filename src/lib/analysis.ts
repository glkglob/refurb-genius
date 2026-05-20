import { type ProjectPhoto, photoStore } from "./photos";
import { auth } from "./auth";
import { buildMockRoomAnalyses, type RoomAnalysis } from "@/core/ai/mockAnalysis";
export {
  ROOM_TYPES,
  CONDITION_LEVELS,
  REFURB_LEVELS,
  buildMockRoomAnalyses,
} from "@/core/ai/mockAnalysis";
export type {
  AnalysisPhotoSource,
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

export const analysisStore = {
  get(projectId: string): RoomAnalysis[] | undefined {
    return cache.get(projectId);
  },
  set(projectId: string, analyses: RoomAnalysis[]): void {
    cache.set(projectId, analyses);
    notify();
  },
  async run(projectId: string): Promise<RoomAnalysis[]> {
    // Mock fallback: build analyses from photos using templates.
    // This is the local implementation used when no real AI provider is active.
    await delay();
    const result = buildFromProjectPhotos(projectId);
    cache.set(projectId, result);
    notify();
    return result;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Clear cache on auth change to prevent stale analysis from previous user
if (typeof window !== "undefined") {
  auth.onChange(() => {
    cache.clear();
    notify();
  });
}
