/**
 * AI-design slice — Scope analysis persistence (browser context).
 *
 * IA-5-R1: publication via save_project_scope_analysis SECURITY DEFINER RPC.
 * Client submits content only; server derives Analysis + Redesign provenance.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/platform/supabase/browser";
import type { Database } from "@repo/supabase";
import type {
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
} from "../../domain";
import type {
  SaveScopeAnalysisCommand,
  ScopeAnalysisRepository as ScopeAnalysisRepositoryPort,
} from "../../application/ports";
import { auth } from "@/lib/auth";

type ScopeAnalysisRow = Database["public"]["Tables"]["scope_analyses"]["Row"];
type ScopeRoomRow = Database["public"]["Tables"]["scope_analysis_rooms"]["Row"];
type ScopeIssueRow = Database["public"]["Tables"]["scope_analysis_issues"]["Row"];
type ScopeItemRow = Database["public"]["Tables"]["scope_analysis_items"]["Row"];

export type PersistedScopeAnalysis = {
  analysis: ScopeAnalysisRow;
  rooms: Array<ScopeRoomRow & { issues: ScopeIssueRow[]; items: ScopeItemRow[] }>;
};

/** IA-5 — durable Scope authority header for currentness (no rooms payload). */
export type ScopeAuthorityHeader = {
  id: string;
  analysisIdentity: string;
  redesignIdentity: string;
  redesignConceptId: string | null;
  createdAt: string;
};

/** Legacy alias — prefer `SaveScopeAnalysisCommand` from application ports. */
export type SaveScopeAnalysisInput = SaveScopeAnalysisCommand;

function roomsToJson(rooms: ScopeRoom[]): unknown[] {
  return rooms.map((room) => ({
    room: room.room,
    area_sqm: room.area_sqm ?? null,
    condition_summary: room.condition_summary ?? "",
    issues: (room.issues ?? []).map((issue) => ({
      category: issue.category,
      description: issue.description,
      severity: issue.severity,
      recommended_action: issue.recommended_action,
    })),
    recommended_items: (room.recommended_items ?? []).map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      base_unit_cost: item.base_unit_cost,
      notes: item.notes ?? null,
    })),
  }));
}

/**
 * IA-5-R1: publish Scope via server-derived provenance RPC.
 * Does not accept client analysis_identity / redesign_* write authority.
 */
export async function saveScopeAnalysis(
  input: SaveScopeAnalysisInput,
): Promise<PersistedScopeAnalysis> {
  const user = auth.getUser();
  if (!user) throw new Error("You must be signed in to save a scope analysis.");

  const { data: header, error } = await supabase.rpc("save_project_scope_analysis", {
    p_project_id: input.projectId,
    p_overall_score: input.analysis.overall_score,
    p_summary: input.analysis.summary,
    p_region: input.region,
    p_notes: input.notes ?? "",
    p_rooms: roomsToJson(input.analysis.rooms) as never,
  });

  if (error) throw new Error(error.message);
  if (!header) throw new Error("Scope publication returned no row.");

  const analysis = header as ScopeAnalysisRow;

  // Load tree for return shape (SELECT under RLS).
  const { data: rooms, error: roomsError } = await supabase
    .from("scope_analysis_rooms")
    .select("*")
    .eq("scope_analysis_id", analysis.id)
    .order("display_order", { ascending: true });

  if (roomsError) throw new Error(roomsError.message);
  if (!rooms || rooms.length === 0) {
    return { analysis, rooms: [] };
  }

  const roomIds = rooms.map((r) => r.id);
  const [issuesResult, itemsResult] = await Promise.all([
    supabase
      .from("scope_analysis_issues")
      .select("*")
      .in("room_id", roomIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("scope_analysis_items")
      .select("*")
      .in("room_id", roomIds)
      .order("display_order", { ascending: true }),
  ]);

  if (issuesResult.error) throw new Error(issuesResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const issuesByRoom = groupBy(issuesResult.data ?? [], (i) => i.room_id);
  const itemsByRoom = groupBy(itemsResult.data ?? [], (i) => i.room_id);

  return {
    analysis,
    rooms: rooms.map((r) => ({
      ...r,
      issues: issuesByRoom.get(r.id) ?? [],
      items: itemsByRoom.get(r.id) ?? [],
    })),
  };
}

type ScopeReadClient = {
  from: typeof supabase.from;
};

async function resolveScopeReadContext(): Promise<{
  client: ScopeReadClient;
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

function mapScopeAuthorityHeader(data: {
  id: string;
  analysis_identity: string | null;
  redesign_identity: string | null;
  redesign_concept_id: string | null;
  created_at: string;
}): ScopeAuthorityHeader {
  return {
    id: data.id,
    analysisIdentity: data.analysis_identity ?? "",
    redesignIdentity: data.redesign_identity ?? "",
    redesignConceptId: data.redesign_concept_id ?? null,
    createdAt: data.created_at,
  };
}

async function loadLatestScopeAuthorityHeader(
  client: ScopeReadClient,
  projectId: string,
  userId: string,
): Promise<ScopeAuthorityHeader | null> {
  const { data, error } = await client
    .from("scope_analyses")
    .select("id, analysis_identity, redesign_identity, redesign_concept_id, created_at")
    .eq("property_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapScopeAuthorityHeader(data);
}

/**
 * IA-5 — load latest Scope authority header for workflow currentness.
 */
export async function getLatestScopeAuthorityHeader(
  projectId: string,
): Promise<ScopeAuthorityHeader | null> {
  const user = auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("scope_analyses")
    .select("id, analysis_identity, redesign_identity, redesign_concept_id, created_at")
    .eq("property_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapScopeAuthorityHeader(data);
}

/**
 * Strict Scope header read for Dashboard workflow evidence.
 * Successful absence is `null`. Missing session and query failure throw.
 */
export async function getLatestScopeAuthorityHeaderStrict(
  projectId: string,
): Promise<ScopeAuthorityHeader | null> {
  const ctx = await resolveScopeReadContext();
  if (!ctx) {
    throw new Error("You must be signed in.");
  }
  return loadLatestScopeAuthorityHeader(ctx.client, projectId, ctx.userId);
}

export async function getLatestScopeAnalysis(
  projectId: string,
): Promise<ScopeAnalysisResult | null> {
  const user = auth.getUser();
  if (!user) return null;

  const { data: analysis, error: analysisError } = await supabase
    .from("scope_analyses")
    .select("*")
    .eq("property_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysisError) throw new Error(analysisError.message);
  if (!analysis) return null;

  const { data: rooms, error: roomsError } = await supabase
    .from("scope_analysis_rooms")
    .select("*")
    .eq("scope_analysis_id", analysis.id)
    .order("display_order", { ascending: true });

  if (roomsError) throw new Error(roomsError.message);
  if (!rooms || rooms.length === 0) return null;

  const roomIds = rooms.map((r) => r.id);

  const [issuesResult, itemsResult] = await Promise.all([
    supabase
      .from("scope_analysis_issues")
      .select("*")
      .in("room_id", roomIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("scope_analysis_items")
      .select("*")
      .in("room_id", roomIds)
      .order("display_order", { ascending: true }),
  ]);

  if (issuesResult.error) throw new Error(issuesResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const issuesByRoom = groupBy(issuesResult.data ?? [], (i) => i.room_id);
  const itemsByRoom = groupBy(itemsResult.data ?? [], (i) => i.room_id);

  const scopeRooms: ScopeRoom[] = rooms.map((room) => ({
    room: room.room_name,
    area_sqm: room.area_sqm ?? undefined,
    condition_summary: room.condition_summary ?? "",
    issues: (issuesByRoom.get(room.id) ?? []).map(
      (issue): ScopeIssue => ({
        category: issue.category ?? "general",
        description: issue.description,
        severity: (issue.severity as ScopeIssue["severity"]) ?? "medium",
        recommended_action: issue.recommended_action ?? "",
      }),
    ),
    recommended_items: (itemsByRoom.get(room.id) ?? []).map(
      (item): ScopeRecommendedItem => ({
        name: item.name,
        category: (item.category as ScopeRecommendedItem["category"]) ?? "both",
        quantity: Number(item.quantity) || 1,
        unit: item.unit ?? "item",
        base_unit_cost: Number(item.base_unit_cost) || 0,
        notes: item.notes ?? undefined,
      }),
    ),
  }));

  return {
    overall_score: Number(analysis.overall_score) || 0,
    summary: analysis.summary ?? "",
    rooms: scopeRooms,
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export class SupabaseScopeAnalysisRepository implements ScopeAnalysisRepositoryPort {
  async save(command: SaveScopeAnalysisCommand): Promise<void> {
    await saveScopeAnalysis(command);
  }

  async loadLatest(projectId: string): Promise<ScopeAnalysisResult | null> {
    return getLatestScopeAnalysis(projectId);
  }
}

export const supabaseScopeAnalysisRepository = new SupabaseScopeAnalysisRepository();
