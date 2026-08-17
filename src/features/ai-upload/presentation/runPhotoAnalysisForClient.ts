/**
 * Platform-aware photo analysis execution (IOS-READINESS-2C-2).
 *
 * Web: existing cookie createServerFn + browser persist path.
 * Native: Bearer POST /api/mobile/v1/analysis/generate (server-side vision + persist).
 */
import { Capacitor } from "@capacitor/core";
import { assertRoomAnalysisList, type RoomAnalysis } from "../domain";

export type RunPhotoAnalysisForClientInput = {
  projectId: string;
  region?: string;
  propertyType?: string;
};

export async function runPhotoAnalysisForClient(
  input: RunPhotoAnalysisForClientInput,
): Promise<RoomAnalysis[]> {
  if (Capacitor.isNativePlatform()) {
    const { generatePhotoAnalysisNative } =
      await import("@/platform/http/mobile-photo-analysis-generate");
    return assertRoomAnalysisList(
      await generatePhotoAnalysisNative({ projectId: input.projectId }),
    );
  }

  const { serverPhotoAnalysisProvider } = await import("./photo-analysis.provider");
  return serverPhotoAnalysisProvider.run(input);
}
