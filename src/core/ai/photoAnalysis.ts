// AI photo analysis surface.
//
// Today this returns mock per-room analyses. The provider interface below is
// the only thing UI code imports, so swapping in OpenAI Vision (or any
// real model) later is a one-file change — no consumer changes required.
//
// AI is responsible for: room identification, condition, visible issues,
// recommended works, and short summaries. AI is NOT responsible for any
// pricing, ROI, or financial numbers — those live in the pricing/ROI
// engines and are deterministic.
import { analysisStore } from "@/lib/analysis";
import type {
  RoomAnalysis,
  RoomType,
  ConditionLevel,
  RefurbLevel,
} from "@/lib/analysis";

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

// Active provider used by the app. Swap to an OpenAI-Vision-backed provider
// here when wiring real analysis — UI/components stay untouched.
// TODO: introduce `openAiVisionPhotoAnalysisProvider` and toggle via env.
export const photoAnalysisProvider: PhotoAnalysisProvider = mockPhotoAnalysisProvider;

// Convenience helpers so consumers don't need to know about providers.
export function getPhotoAnalysis(projectId: string): RoomAnalysis[] | undefined {
  return photoAnalysisProvider.get(projectId);
}

export function runPhotoAnalysis(input: PhotoAnalysisInput): Promise<RoomAnalysis[]> {
  return photoAnalysisProvider.run(input);
}

export function subscribePhotoAnalysis(fn: () => void): () => void {
  return photoAnalysisProvider.subscribe(fn);
}

export type { RoomAnalysis, RoomType, ConditionLevel, RefurbLevel };
