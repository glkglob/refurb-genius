/**
 * IA-5-R1 — durable Export snapshot persistence (browser context).
 * Publication via publish_project_export_snapshot SECURITY DEFINER RPC.
 * Direct client INSERT is sealed.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";

export type ExportSnapshotHeader = {
  id: string;
  estimateId: string;
  projectId: string;
  createdAt: string;
  kind: string;
};

type ExportReadClient = {
  from: typeof supabase.from;
};

async function resolveExportReadContext(): Promise<{
  client: ExportReadClient;
  userId: string;
} | null> {
  if (Capacitor.isNativePlatform()) {
    const { getNativeSupabase } = await import("@/platform/supabase/native");
    const client = getNativeSupabase();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user?.id) return null;
    return { client, userId: user.id };
  }

  const user = auth.getUser();
  if (!user?.id) return null;
  return { client: supabase, userId: user.id };
}

function mapExportSnapshotHeader(data: {
  id: string;
  estimate_id: string;
  project_id: string;
  created_at: string;
  kind: string;
}): ExportSnapshotHeader {
  return {
    id: data.id,
    estimateId: data.estimate_id,
    projectId: data.project_id,
    createdAt: data.created_at,
    kind: data.kind,
  };
}

async function loadLatestExportSnapshot(
  client: ExportReadClient,
  projectId: string,
  userId: string,
): Promise<ExportSnapshotHeader | null> {
  const { data, error } = await client
    .from("project_export_snapshots")
    .select("id, estimate_id, project_id, created_at, kind")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapExportSnapshotHeader(data);
}

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

  return mapExportSnapshotHeader(data);
}

/**
 * Strict export-snapshot read for Dashboard workflow evidence.
 * Successful absence is `null`. Missing session and query failure throw.
 */
export async function getLatestExportSnapshotStrict(
  projectId: string,
): Promise<ExportSnapshotHeader | null> {
  const ctx = await resolveExportReadContext();
  if (!ctx) {
    throw new Error("You must be signed in.");
  }
  return loadLatestExportSnapshot(ctx.client, projectId, ctx.userId);
}

/**
 * Publish Export snapshot bound to the CURRENT Estimate for the project.
 * Server rejects stale estimate_id and cross-project estimate associations.
 */
export async function saveExportSnapshot(input: {
  projectId: string;
  estimateId: string;
  kind?: string;
}): Promise<ExportSnapshotHeader> {
  const user = auth.getUser();
  if (!user) throw new Error("You must be signed in to save an export snapshot.");

  const { data, error } = await supabase.rpc("publish_project_export_snapshot", {
    p_project_id: input.projectId,
    p_estimate_id: input.estimateId,
    p_kind: input.kind ?? "investor_report",
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Export publication returned no row.");

  const row = data as {
    id: string;
    estimate_id: string;
    project_id: string;
    created_at: string;
    kind: string;
  };

  return {
    id: row.id,
    estimateId: row.estimate_id,
    projectId: row.project_id,
    createdAt: row.created_at,
    kind: row.kind,
  };
}
