/**
 * IA-4-R1 — Server-only redesign_concepts persistence.
 *
 * Canonical authority columns: analysis_identity, is_selected.
 * Selection writes ONLY via select_project_redesign_concept (atomic RPC).
 * Description JSON remains concept presentation payload (not selection authority).
 */
import "@tanstack/react-start/server-only";

import {
  conceptToPayload,
  parseRedesignPayload,
  payloadToConcept,
  type DurableRedesignConcept,
} from "../../domain/redesignAuthority";
import type { RedesignConcept } from "../../domain";

type LiveRow = {
  id: string;
  style: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  analysis_identity?: string | null;
  is_selected?: boolean | null;
};

function rowToConcept(row: LiveRow): DurableRedesignConcept | null {
  // Canonical authority: columns (not JSON isSelected).
  const analysisIdentity = typeof row.analysis_identity === "string" ? row.analysis_identity : "";
  const isSelected = Boolean(row.is_selected);

  const fromJson = row.description ? parseRedesignPayload(safeJson(row.description)) : null;
  if (fromJson) {
    const concept = payloadToConcept(row.style || "Modern", fromJson, row.id);
    return {
      ...concept,
      // Columns override JSON for authority fields.
      analysisIdentity,
      isSelected,
    };
  }

  if (!row.style && !row.title && !analysisIdentity && !isSelected) return null;

  return {
    id: row.id,
    style: (row.style || "Modern") as DurableRedesignConcept["style"],
    tagline: row.title || row.style || "Concept",
    palette: [],
    flooring: "",
    lighting: "",
    furniture:
      typeof row.description === "string" && !row.description.startsWith("{")
        ? row.description
        : "",
    afterGradient: "linear-gradient(135deg, #F5F5F2 0%, #E4DED2 100%)",
    ...(row.image_url ? { afterImageUrl: row.image_url } : {}),
    analysisIdentity,
    isSelected,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function conceptToRowFields(
  concept: RedesignConcept,
  analysisIdentity: string,
  isSelected: boolean,
): {
  title: string;
  description: string;
  style: string;
  image_url: string | null;
  analysis_identity: string;
  is_selected: boolean;
} {
  // Description still holds presentation payload for UI; isSelected forced false in JSON
  // so JSON cannot override column authority.
  const payload = conceptToPayload(concept, analysisIdentity, false);
  return {
    title: concept.tagline.slice(0, 200) || concept.style,
    description: JSON.stringify(payload),
    style: concept.style,
    image_url: concept.afterImageUrl ?? null,
    analysis_identity: analysisIdentity,
    is_selected: isSelected,
  };
}

export async function listDurableRedesignConcepts(
  projectId: string,
): Promise<DurableRedesignConcept[]> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("redesign_concepts")
    .select("id, style, title, description, image_url, analysis_identity, is_selected")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load redesign concepts");
  }

  const out: DurableRedesignConcept[] = [];
  for (const row of (data ?? []) as LiveRow[]) {
    const c = rowToConcept(row);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Replace non-selected candidates with a new generation batch.
 * Preserves selected row when analysis_identity matches (same Analysis).
 */
export async function replaceRedesignCandidates(input: {
  projectId: string;
  userId: string;
  analysisIdentity: string;
  concepts: RedesignConcept[];
}): Promise<DurableRedesignConcept[]> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  const existing = await listDurableRedesignConcepts(input.projectId);
  const preserved = existing.find(
    (c) => c.isSelected && c.analysisIdentity === input.analysisIdentity,
  );

  if (preserved) {
    const { error: delErr } = await supabase
      .from("redesign_concepts")
      .delete()
      .eq("project_id", input.projectId)
      .neq("id", preserved.id);
    if (delErr) throw new Error(delErr.message || "Failed to clear redesign candidates");
  } else {
    const { error: delAll } = await supabase
      .from("redesign_concepts")
      .delete()
      .eq("project_id", input.projectId);
    if (delAll) throw new Error(delAll.message || "Failed to clear redesign candidates");
  }

  const stylesToSkip = new Set(preserved ? [preserved.style] : []);
  const rows = input.concepts
    .filter((c) => !stylesToSkip.has(c.style))
    .map((concept) => {
      const fields = conceptToRowFields(concept, input.analysisIdentity, false);
      return {
        project_id: input.projectId,
        user_id: input.userId,
        ...fields,
      };
    });

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("redesign_concepts").insert(rows as never);
    if (insErr) throw new Error(insErr.message || "Failed to persist redesign candidates");
  }

  return listDurableRedesignConcepts(input.projectId);
}

/**
 * Atomic selection via select_project_redesign_concept.
 * Prior selection remains if RPC fails (transaction rollback).
 */
export async function selectDurableRedesignConcept(input: {
  projectId: string;
  conceptId: string;
}): Promise<DurableRedesignConcept> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("select_project_redesign_concept", {
    p_project_id: input.projectId,
    p_concept_id: input.conceptId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/redesign_concept_not_found|P0002/i.test(msg)) {
      throw new Error("Redesign concept not found for this project");
    }
    if (/project_not_authorised|42501/i.test(msg)) {
      throw new Error("Not authorised for this project");
    }
    if (/not_authenticated|28000/i.test(msg)) {
      throw new Error("Not authenticated");
    }
    throw new Error(msg || "Failed to persist redesign selection");
  }

  // RPC may return a row object or array depending on client version.
  const row = (Array.isArray(data) ? data[0] : data) as LiveRow | null;
  if (!row?.id) {
    throw new Error("Selection did not persist");
  }

  const concept = rowToConcept(row);
  if (!concept?.isSelected) {
    // Re-list for full presentation payload after RPC.
    const all = await listDurableRedesignConcepts(input.projectId);
    const selected = all.find((c) => c.id === input.conceptId && c.isSelected);
    if (!selected) throw new Error("Selection did not persist");
    return selected;
  }
  return concept;
}
