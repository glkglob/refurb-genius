/**
 * Native client helper for Bearer photo analysis (NATIVE-AI-ANALYSIS-1).
 *
 * POST https://<production>/api/mobile/v1/analysis/run
 * Payload is { projectId, photoIds } only.
 * Returns unknown JSON — callers must assert the production RoomAnalysis list.
 */
import { nativeAuthenticatedJson } from "./native-authenticated-fetch";
import { MOBILE_API_PREFIX } from "./mobile-session-ping";

export const MOBILE_ANALYSIS_RUN_PATH = `${MOBILE_API_PREFIX}/analysis/run` as const;

export type RunPhotoAnalysisNativeInput = {
  projectId: string;
  photoIds: string[];
};

export async function runPhotoAnalysisNative(input: RunPhotoAnalysisNativeInput): Promise<unknown> {
  return nativeAuthenticatedJson<unknown>(MOBILE_ANALYSIS_RUN_PATH, {
    method: "POST",
    json: {
      projectId: input.projectId,
      photoIds: input.photoIds,
    },
  });
}
