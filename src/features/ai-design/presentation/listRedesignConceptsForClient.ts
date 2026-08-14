/**
 * Platform-aware durable redesign-concept list.
 *
 * Web: cookie-authenticated listRedesignConceptsServerFn.
 * Native: Keychain getNativeSupabase + RLS SELECT (createServerFn is not a
 * native data plane — Capacitor has no server.url).
 */
import { Capacitor } from "@capacitor/core";
import {
  assertRedesignConceptList,
  rowToDurableRedesignConcept,
  type DurableRedesignConcept,
} from "../domain/redesignAuthority";
import { listRedesignConceptsServerFn } from "./serverFns";

export async function listRedesignConceptsForClient(
  projectId: string,
): Promise<DurableRedesignConcept[]> {
  if (Capacitor.isNativePlatform()) {
    const { listRedesignConceptsNative } =
      await import("@/platform/supabase/native-redesign-concepts");
    const rows = await listRedesignConceptsNative(projectId);
    const out: DurableRedesignConcept[] = [];
    for (const row of rows) {
      const concept = rowToDurableRedesignConcept(row);
      if (concept) out.push(concept);
    }
    return out;
  }

  const result = await listRedesignConceptsServerFn({ data: { projectId } });
  return assertRedesignConceptList(result);
}
