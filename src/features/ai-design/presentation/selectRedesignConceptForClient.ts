/**
 * Platform-aware durable redesign selection.
 *
 * Web: cookie-authenticated selectRedesignConceptServerFn.
 * Native: Keychain getNativeSupabase + select_project_redesign_concept RPC.
 */
import { Capacitor } from "@capacitor/core";
import {
  assertDurableRedesignConcept,
  rowToDurableRedesignConcept,
  type DurableRedesignConcept,
} from "../domain/redesignAuthority";
import { selectRedesignConceptServerFn } from "./serverFns";

export type SelectRedesignConceptForClientInput = {
  projectId: string;
  conceptId: string;
};

export async function selectRedesignConceptForClient(
  input: SelectRedesignConceptForClientInput,
): Promise<DurableRedesignConcept> {
  if (Capacitor.isNativePlatform()) {
    const { selectRedesignConceptNative } =
      await import("@/platform/supabase/native-redesign-select");
    const row = await selectRedesignConceptNative(input);
    const concept = rowToDurableRedesignConcept(row);
    if (!concept) {
      throw new Error("Selection did not persist");
    }
    return concept;
  }

  const result = await selectRedesignConceptServerFn({
    data: {
      projectId: input.projectId,
      conceptId: input.conceptId,
    },
  });
  return assertDurableRedesignConcept(result);
}
