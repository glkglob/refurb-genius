/**
 * Presentation wiring for weak-photo re-analysis (thin wrapper over application use case).
 *
 * Web: cookie ServerFn vision + browser persist.
 * Native: same Bearer /api/mobile/v1/analysis/generate authority (retry-weak).
 */
import { Capacitor } from "@capacitor/core";
import { makeRetryWeakAnalyses } from "../application";
import { analysisPhotoKey, assertRoomAnalysisList, mergeAnalysesRetainingGood } from "../domain";
import type { RoomAnalysis } from "../domain";
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
  if (Capacitor.isNativePlatform()) {
    const { generatePhotoAnalysisNative } =
      await import("@/platform/http/mobile-photo-analysis-generate");
    return assertRoomAnalysisList(
      await generatePhotoAnalysisNative({ projectId: input.projectId, mode: "retry-weak" }),
    );
  }
  return retryWeak({ projectId: input.projectId });
}

export { analysisPhotoKey, mergeAnalysesRetainingGood };
