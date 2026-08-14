/**
 * Native client helper for Bearer redesign generation (IOS-2C3-I).
 *
 * POST https://<production>/api/mobile/v1/redesign/generate
 * Payload is projectId + optional styles only.
 * Returns unknown JSON — callers must assert DurableRedesignConcept[].
 */
import { nativeAuthenticatedJson } from "./native-authenticated-fetch";
import { MOBILE_API_PREFIX } from "./mobile-session-ping";

export const MOBILE_REDESIGN_GENERATE_PATH = `${MOBILE_API_PREFIX}/redesign/generate` as const;

export type GenerateRedesignConceptsNativeInput = {
  projectId: string;
  styles?: string[];
};

export async function generateRedesignConceptsNative(
  input: GenerateRedesignConceptsNativeInput,
): Promise<unknown> {
  const json: { projectId: string; styles?: string[] } = {
    projectId: input.projectId,
  };
  if (input.styles?.length) {
    json.styles = input.styles;
  }

  return nativeAuthenticatedJson<unknown>(MOBILE_REDESIGN_GENERATE_PATH, {
    method: "POST",
    json,
  });
}
