/**
 * Platform-aware photo analysis dispatch.
 *
 * Web: cookie-authenticated runPhotoAnalysisServerFn (dynamic import).
 * Native: Bearer POST /api/mobile/v1/analysis/run (never the cookie serverFn transport).
 */
import { Capacitor } from "@capacitor/core";
import { assertProductionRoomAnalysisList, type RoomAnalysis } from "../domain";

export type AnalyzePhotosForClientInput = {
  projectId: string;
  photoIds: string[];
};

export async function analyzePhotosForClient(
  input: AnalyzePhotosForClientInput,
): Promise<RoomAnalysis[]> {
  if (Capacitor.isNativePlatform()) {
    const { runPhotoAnalysisNative } = await import("@/platform/http/mobile-analysis-run");
    return assertProductionRoomAnalysisList(
      await runPhotoAnalysisNative({
        projectId: input.projectId,
        photoIds: input.photoIds,
      }),
    );
  }

  const { runPhotoAnalysisServerFn } = await import("./serverFns");
  return assertProductionRoomAnalysisList(
    await runPhotoAnalysisServerFn({
      data: {
        projectId: input.projectId,
        photoIds: input.photoIds,
      },
    }),
  );
}
