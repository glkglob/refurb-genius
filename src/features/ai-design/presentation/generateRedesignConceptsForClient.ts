/**
 * Platform-aware redesign generation.
 *
 * Web: cookie-authenticated generateRedesignConceptsServerFn.
 * Native: Bearer POST /api/mobile/v1/redesign/generate (server-side AI).
 */
import { Capacitor } from "@capacitor/core";
import {
  assertRedesignConceptList,
  type DurableRedesignConcept,
} from "../domain/redesignAuthority";
import type { RedesignStyle } from "../domain";
import { generateRedesignConceptsServerFn } from "./serverFns";

export type GenerateRedesignConceptsForClientInput = {
  projectId: string;
  styles?: RedesignStyle[];
};

export async function generateRedesignConceptsForClient(
  input: GenerateRedesignConceptsForClientInput,
): Promise<DurableRedesignConcept[]> {
  if (Capacitor.isNativePlatform()) {
    const { generateRedesignConceptsNative } =
      await import("@/platform/http/mobile-redesign-generate");
    return assertRedesignConceptList(await generateRedesignConceptsNative(input));
  }

  const result = await generateRedesignConceptsServerFn({
    data: {
      projectId: input.projectId,
      styles: input.styles,
    },
  });
  return assertRedesignConceptList(result);
}
