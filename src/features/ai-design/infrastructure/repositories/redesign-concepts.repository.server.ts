/**
 * IA-4-R2 — Server-only redesign_concepts persistence.
 *
 * Canonical authority columns: analysis_identity, is_selected.
 * Selection writes ONLY via select_project_redesign_concept (atomic RPC).
 * Generation writes ONLY via replace_project_redesign_candidates (sealed RPC).
 * Description JSON remains concept presentation payload (not selection authority).
 * Direct authenticated DML on authority columns is revoked at the database.
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

function conceptToPresentationFields(
  concept: RedesignConcept,
  analysisIdentity: string,
): {
  title: string;
  description: string;
  style: string;
  image_url: string | null;
} {
  // Description holds presentation payload; isSelected forced false in JSON so
  // JSON cannot claim selection authority. analysisIdentity in JSON is
  // presentation only — RPC overwrites column from room_analyses.
  const payload = conceptToPayload(concept, analysisIdentity, false);
  return {
    title: concept.tagline.slice(0, 200) || concept.style,
    description: JSON.stringify(payload),
    style: concept.style,
    image_url: concept.afterImageUrl ?? null,
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
 * RPC preserves selected row when analysis_identity matches current Analysis.
 * analysis_identity is derived inside the database from durable room_analyses.
 */
export async function replaceRedesignCandidates(input: {
  projectId: string;
  userId: string;
  analysisIdentity: string;
  concepts: RedesignConcept[];
}): Promise<DurableRedesignConcept[]> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  // Presentation-only payload. Server RPC derives authority columns from
  // room_analyses. input.analysisIdentity is mirrored into description JSON
  // for presentation only and is not trusted for column authority.
  void input.userId;

  const p_concepts = input.concepts.map((concept) => {
    const fields = conceptToPresentationFields(concept, input.analysisIdentity);
    return {
      title: fields.title,
      description: fields.description,
      style: fields.style,
      image_url: fields.image_url,
    };
  });

  const { data, error } = await supabase.rpc("replace_project_redesign_candidates", {
    p_project_id: input.projectId,
    p_concepts,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/redesign_requires_analysis_identity/i.test(msg)) {
      throw new Error("Cannot generate Redesign without durable Analysis photo identity.");
    }
    if (/project_not_authorised|42501/i.test(msg)) {
      throw new Error("Not authorised for this project");
    }
    if (/not_authenticated|28000/i.test(msg)) {
      throw new Error("Not authenticated");
    }
    throw new Error(msg || "Failed to persist redesign candidates");
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as LiveRow[];
  if (rows.length > 0) {
    const out: DurableRedesignConcept[] = [];
    for (const row of rows) {
      const c = rowToConcept(row);
      if (c) out.push(c);
    }
    if (out.length > 0) return out;
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
