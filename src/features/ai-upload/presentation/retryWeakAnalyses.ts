/**
 * Presentation wiring for weak-photo re-analysis (thin wrapper over application use case).
 *
 * Web: existing subset/weak retry via makeRetryWeakAnalyses.
 * Native: full current-catalogue re-analysis on the same Bearer authority.
 */
import { Capacitor } from "@capacitor/core";
import { makeAnalyzePhotos, makeRetryWeakAnalyses } from "../application";
import type { RoomAnalysis } from "../domain";
import { analysisPhotoKey, mergeAnalysesRetainingGood } from "../domain";
import { supabaseRoomAnalysisRepository } from "../infrastructure/repositories/room-analysis.repository";
import { browserPhotoCatalogRepository } from "../infrastructure/repositories/photo-catalog.repository";
import { analyzePhotosForClient } from "./analyzePhotosForClient";

const serverVisionAdapter = {
  async analyzePhotos(input: {
    projectId: string;
    photos: import("../domain").AnalysisPhotoSource[];
  }): Promise<RoomAnalysis[]> {
    return analyzePhotosForClient({
      projectId: input.projectId,
      photoIds: input.photos.map((photo) => photo.id),
    });
  },
};

const retryWeak = makeRetryWeakAnalyses({
  vision: serverVisionAdapter,
  analyses: supabaseRoomAnalysisRepository,
  photos: browserPhotoCatalogRepository,
});

const analyzeAll = makeAnalyzePhotos({
  vision: serverVisionAdapter,
  analyses: supabaseRoomAnalysisRepository,
  photos: browserPhotoCatalogRepository,
});

/** Re-analyse only retryable photos on web; native always re-runs the current catalogue. */
export async function retryWeakPhotoAnalyses(input: {
  projectId: string;
}): Promise<RoomAnalysis[]> {
  if (Capacitor.isNativePlatform()) {
    return analyzeAll({ projectId: input.projectId });
  }
  return retryWeak({ projectId: input.projectId });
}

export { analysisPhotoKey, mergeAnalysesRetainingGood };
