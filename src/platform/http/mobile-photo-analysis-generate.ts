/**
 * Native client helper for Bearer photo analysis (IOS-READINESS-2C-2).
 *
 * POST https://<production>/api/mobile/v1/analysis/generate
 * Payload is projectId + optional mode only.
 * Returns unknown JSON — callers must assert RoomAnalysis[].
 */
import { nativeAuthenticatedJson } from "./native-authenticated-fetch";
import { MOBILE_API_PREFIX } from "./mobile-session-ping";

export const MOBILE_ANALYSIS_GENERATE_PATH = `${MOBILE_API_PREFIX}/analysis/generate` as const;

export type GeneratePhotoAnalysisNativeInput = {
  projectId: string;
  mode?: "generate" | "retry-weak";
};

export async function generatePhotoAnalysisNative(
  input: GeneratePhotoAnalysisNativeInput,
): Promise<unknown> {
  const json: { projectId: string; mode?: "generate" | "retry-weak" } = {
    projectId: input.projectId,
  };
  if (input.mode) {
    json.mode = input.mode;
  }

  return nativeAuthenticatedJson<unknown>(MOBILE_ANALYSIS_GENERATE_PATH, {
    method: "POST",
    json,
  });
}
