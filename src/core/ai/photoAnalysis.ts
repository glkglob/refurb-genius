// AI photo analysis surface.
//
// Today this returns mock per-room analyses. The provider interface below is
// the only thing UI code imports. The browser talks only to an internal
// server function; OpenAI stays behind that server boundary.
//
// AI is responsible for: room identification, condition, visible issues,
// recommended works, and short summaries. AI is NOT responsible for any
// pricing, ROI, or financial numbers — those live in the pricing/ROI
// engines and are deterministic.
import { analysisStore } from "@/lib/analysis";
import type {
  AnalysisSource,
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/lib/analysis";
import { photoStore } from "@/lib/photos";
import { runPhotoAnalysisServerFn } from "./serverFns";

export type PhotoAnalysisInput = {
  projectId: string;
  // Future: pass region / property_type / preferred audience hints to the
  // model so room narratives can be tuned. Mock provider ignores them.
  region?: string;
  propertyType?: string;
};

export type PhotoAnalysisProvider = {
  /** Read cached analyses for a project, if any. */
  get(projectId: string): RoomAnalysis[] | undefined;
  /** Run analysis end-to-end. Mock today, real Vision call tomorrow. */
  run(input: PhotoAnalysisInput): Promise<RoomAnalysis[]>;
  /** Subscribe to provider-side updates (cache changes). */
  subscribe(fn: () => void): () => void;
};

/** Default mock provider — wraps the existing in-memory analysisStore. */
export const mockPhotoAnalysisProvider: PhotoAnalysisProvider = {
  get(projectId) {
    return analysisStore.get(projectId);
  },
  async run({ projectId }) {
    return analysisStore.run(projectId);
  },
  subscribe(fn) {
    return analysisStore.subscribe(fn);
  },
};

const serverPhotoAnalysisProvider: PhotoAnalysisProvider = {
  get(projectId) {
    return analysisStore.get(projectId);
  },
  async run({ projectId }) {
    const photos = photoStore
      .list(projectId)
      .map(({ id, url, name, size }) => ({ id, url, name, size }));
    const results = await runPhotoAnalysisServerFn({ data: { projectId, photos } });
    analysisStore.set(projectId, results);
    return results;
  },
  subscribe(fn) {
    return analysisStore.subscribe(fn);
  },
};

export const photoAnalysisProvider: PhotoAnalysisProvider = serverPhotoAnalysisProvider;

// Convenience helpers so consumers don't need to know about providers.
export function getPhotoAnalysis(projectId: string): RoomAnalysis[] | undefined {
  return photoAnalysisProvider.get(projectId);
}

export async function loadPhotoAnalysis(projectId: string): Promise<RoomAnalysis[] | undefined> {
  return analysisStore.load(projectId);
}

export function runPhotoAnalysis(input: PhotoAnalysisInput): Promise<RoomAnalysis[]> {
  return photoAnalysisProvider.run(input);
}

export function subscribePhotoAnalysis(fn: () => void): () => void {
  return photoAnalysisProvider.subscribe(fn);
}

export type { AnalysisSource, RoomAnalysis, RoomType, ConditionLevel, RefurbLevel };
