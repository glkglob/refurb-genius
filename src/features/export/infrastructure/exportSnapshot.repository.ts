/**
 * IA-5 — durable Export snapshot persistence (browser context).
 * Completing Export requires a snapshot bound to the current Estimate.
 * Page view / download alone is not Complete.
 */
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";

export type ExportSnapshotHeader = {
  id: string;
  estimateId: string;
  projectId: string;
  createdAt: string;
  kind: string;
};

export async function getLatestExportSnapshot(
  projectId: string,
): Promise<ExportSnapshotHeader | null> {
  const user = auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("project_export_snapshots")
    .select("id, estimate_id, project_id, created_at, kind")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    estimateId: data.estimate_id,
    projectId: data.project_id,
    createdAt: data.created_at,
    kind: data.kind,
  };
}

export async function saveExportSnapshot(input: {
  projectId: string;
  estimateId: string;
  kind?: string;
}): Promise<ExportSnapshotHeader> {
  const user = auth.getUser();
  if (!user) throw new Error("You must be signed in to save an export snapshot.");

  const { data, error } = await supabase
    .from("project_export_snapshots")
    .insert({
      project_id: input.projectId,
      user_id: user.id,
      estimate_id: input.estimateId,
      kind: input.kind ?? "investor_report",
    })
    .select("id, estimate_id, project_id, created_at, kind")
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    estimateId: data.estimate_id,
    projectId: data.project_id,
    createdAt: data.created_at,
    kind: data.kind,
  };
}
