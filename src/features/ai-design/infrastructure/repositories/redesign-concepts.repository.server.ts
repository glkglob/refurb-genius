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
  interpretRedesignPersistenceError,
  rowToDurableRedesignConcept,
  type DurableRedesignConcept,
  type RedesignConceptLiveRow,
} from "../../domain/redesignAuthority";
import type { RedesignConcept } from "../../domain";

type LiveRow = RedesignConceptLiveRow;

/** Structural client so cookie and Bearer/token clients share one algorithm. */
export type RedesignPersistenceClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
};

function mapRows(data: unknown): DurableRedesignConcept[] {
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as LiveRow[];
  const out: DurableRedesignConcept[] = [];
  for (const row of rows) {
    const c = rowToDurableRedesignConcept(row);
    if (c) out.push(c);
  }
  return out;
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

export async function listDurableRedesignConceptsWithClient(
  supabase: RedesignPersistenceClient,
  projectId: string,
): Promise<DurableRedesignConcept[]> {
  const { data, error } = await supabase
    .from("redesign_concepts")
    .select("id, style, title, description, image_url, analysis_identity, is_selected")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load redesign concepts");
  }

  return mapRows(data ?? []);
}

export async function listDurableRedesignConcepts(
  projectId: string,
): Promise<DurableRedesignConcept[]> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();
  return listDurableRedesignConceptsWithClient(
    supabase as unknown as RedesignPersistenceClient,
    projectId,
  );
}

/**
 * Replace non-selected candidates with a new generation batch.
 * RPC preserves selected row when analysis_identity matches current Analysis.
 * analysis_identity is derived inside the database from durable room_analyses.
 */
export async function replaceRedesignCandidatesWithClient(
  supabase: RedesignPersistenceClient,
  input: {
    projectId: string;
    analysisIdentity: string;
    concepts: RedesignConcept[];
  },
): Promise<DurableRedesignConcept[]> {
  // Presentation-only payload. Server RPC derives authority columns from
  // room_analyses. input.analysisIdentity is mirrored into description JSON
  // for presentation only and is not trusted for column authority.
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
    throw interpretRedesignPersistenceError(error.message ?? "", "replace");
  }

  const mapped = mapRows(data);
  if (mapped.length > 0) return mapped;

  return listDurableRedesignConceptsWithClient(supabase, input.projectId);
}

export async function replaceRedesignCandidates(input: {
  projectId: string;
  userId: string;
  analysisIdentity: string;
  concepts: RedesignConcept[];
}): Promise<DurableRedesignConcept[]> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();
  void input.userId;
  return replaceRedesignCandidatesWithClient(
    supabase as unknown as RedesignPersistenceClient,
    input,
  );
}

/**
 * Atomic selection via select_project_redesign_concept.
 * Prior selection remains if RPC fails (transaction rollback).
 */
export async function selectDurableRedesignConceptWithClient(
  supabase: RedesignPersistenceClient,
  input: {
    projectId: string;
    conceptId: string;
  },
): Promise<DurableRedesignConcept> {
  const { data, error } = await supabase.rpc("select_project_redesign_concept", {
    p_project_id: input.projectId,
    p_concept_id: input.conceptId,
  });

  if (error) {
    throw interpretRedesignPersistenceError(error.message ?? "", "select");
  }

  // RPC may return a row object or array depending on client version.
  const row = (Array.isArray(data) ? data[0] : data) as LiveRow | null;
  if (!row?.id) {
    throw new Error("Selection did not persist");
  }

  const concept = rowToDurableRedesignConcept(row);
  if (!concept?.isSelected) {
    const all = await listDurableRedesignConceptsWithClient(supabase, input.projectId);
    const selected = all.find((c) => c.id === input.conceptId && c.isSelected);
    if (!selected) throw new Error("Selection did not persist");
    return selected;
  }
  return concept;
}

export async function selectDurableRedesignConcept(input: {
  projectId: string;
  conceptId: string;
}): Promise<DurableRedesignConcept> {
  const { createSupabaseServerClient } = await import("@/serverFns/auth.server");
  const supabase = await createSupabaseServerClient();
  return selectDurableRedesignConceptWithClient(
    supabase as unknown as RedesignPersistenceClient,
    input,
  );
}
