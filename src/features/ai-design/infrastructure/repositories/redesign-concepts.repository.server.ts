/**
 * IA-4 — Server-only redesign_concepts persistence.
 *
 * Live table columns (production): id, user_id, project_id, photo_id, title,
 * description, style, image_url, created_at, updated_at.
 *
 * Durable selection + Analysis binding are stored in description as JSON
 * (concept payload). No schema migration required.
 *
 * Ownership: RLS redesign_all_own + auth.uid() via server client.
 */
import "@tanstack/react-start/server-only";

import {
  conceptToPayload,
  parseRedesignPayload,
  payloadToConcept,
  type DurableRedesignConcept,
  type RedesignConceptPayload,
} from "../../domain/redesignAuthority";
import type { RedesignConcept } from "../../domain";

type LiveRow = {
  id: string;
  style: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
};

function rowToConcept(row: LiveRow): DurableRedesignConcept | null {
  // Prefer structured JSON in description; fall back to minimal fields.
  const fromJson = row.description ? parseRedesignPayload(safeJson(row.description)) : null;
  if (fromJson) {
    return payloadToConcept(row.style || "Modern", fromJson, row.id);
  }
  if (!row.style && !row.title) return null;
  return {
    id: row.id,
    style: (row.style || "Modern") as DurableRedesignConcept["style"],
    tagline: row.title || row.style || "Concept",
    palette: [],
    flooring: "",
    lighting: "",
    furniture: row.description || "",
    afterGradient: "linear-gradient(135deg, #F5F5F2 0%, #E4DED2 100%)",
    ...(row.image_url ? { afterImageUrl: row.image_url } : {}),
    analysisIdentity: "",
    isSelected: false,
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
): { title: string; description: string; style: string; image_url: string | null } {
  const payload = conceptToPayload(concept, analysisIdentity, isSelected);
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
    .select("id, style, title, description, image_url")
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

export async function selectDurableRedesignConcept(input: {
  projectId: string;
  conceptId: string;
}): Promise<DurableRedesignConcept> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();

  const existing = await listDurableRedesignConcepts(input.projectId);
  const target = existing.find((c) => c.id === input.conceptId);
  if (!target) {
    throw new Error("Redesign concept not found for this project");
  }

  for (const row of existing) {
    if (!row.isSelected && row.id !== target.id) continue;
    const payload: RedesignConceptPayload = {
      tagline: row.tagline,
      palette: row.palette,
      flooring: row.flooring,
      lighting: row.lighting,
      furniture: row.furniture,
      afterGradient: row.afterGradient,
      ...(row.afterImageUrl ? { afterImageUrl: row.afterImageUrl } : {}),
      ...(row.estimatedCostUplift ? { estimatedCostUplift: row.estimatedCostUplift } : {}),
      analysisIdentity: row.analysisIdentity,
      isSelected: row.id === input.conceptId,
    };
    const { error } = await supabase
      .from("redesign_concepts")
      .update({
        title: payload.tagline.slice(0, 200),
        description: JSON.stringify(payload),
        style: row.style,
        image_url: row.afterImageUrl ?? null,
      } as never)
      .eq("id", row.id)
      .eq("project_id", input.projectId);
    if (error) throw new Error(error.message || "Failed to persist redesign selection");
  }

  // Ensure target selected even if it was not previously selected
  if (!existing.some((c) => c.isSelected && c.id === input.conceptId)) {
    const payload: RedesignConceptPayload = {
      tagline: target.tagline,
      palette: target.palette,
      flooring: target.flooring,
      lighting: target.lighting,
      furniture: target.furniture,
      afterGradient: target.afterGradient,
      ...(target.afterImageUrl ? { afterImageUrl: target.afterImageUrl } : {}),
      ...(target.estimatedCostUplift ? { estimatedCostUplift: target.estimatedCostUplift } : {}),
      analysisIdentity: target.analysisIdentity,
      isSelected: true,
    };
    const { error } = await supabase
      .from("redesign_concepts")
      .update({
        title: payload.tagline.slice(0, 200),
        description: JSON.stringify(payload),
        style: target.style,
        image_url: target.afterImageUrl ?? null,
      } as never)
      .eq("id", input.conceptId)
      .eq("project_id", input.projectId);
    if (error) throw new Error(error.message || "Failed to persist redesign selection");
  }

  const after = await listDurableRedesignConcepts(input.projectId);
  const selected = after.find((c) => c.id === input.conceptId && c.isSelected);
  if (!selected) throw new Error("Selection did not persist");
  return selected;
}
