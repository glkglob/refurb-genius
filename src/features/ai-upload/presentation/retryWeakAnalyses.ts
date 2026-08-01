/**
 * Presentation wiring for weak-photo re-analysis (thin wrapper over application use case).
 */
import { makeRetryWeakAnalyses } from "../application";
import type { RoomAnalysis } from "../domain";
import { analysisPhotoKey, mergeAnalysesRetainingGood } from "../domain";
import { supabaseRoomAnalysisRepository } from "../infrastructure/repositories/room-analysis.repository";
import { browserPhotoCatalogRepository } from "../infrastructure/repositories/photo-catalog.repository";
import { runPhotoAnalysisServerFn } from "./serverFns";

const serverVisionAdapter = {
  async analyzePhotos(input: {
    projectId: string;
    photos: import("../domain").AnalysisPhotoSource[];
  }): Promise<RoomAnalysis[]> {
    return runPhotoAnalysisServerFn({ data: input });
  },
};

const retryWeak = makeRetryWeakAnalyses({
  vision: serverVisionAdapter,
  analyses: supabaseRoomAnalysisRepository,
  photos: browserPhotoCatalogRepository,
});

/** Re-analyse only retryable photos; retain good analyses; persist merged set. */
export async function retryWeakPhotoAnalyses(input: {
  projectId: string;
}): Promise<RoomAnalysis[]> {
  return retryWeak({ projectId: input.projectId });
}

export { analysisPhotoKey, mergeAnalysesRetainingGood };
