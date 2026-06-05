import { supabase } from "@/services/supabase";
import type { Database } from "@repo/supabase";
import type {
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
  ScopeRecommendedItem,
} from "@/core/ai/server/openAiScopeAnalysis.server";
import { auth } from "./auth";

// ──────────────────────────────────────────────────────────────
// Row types
// ──────────────────────────────────────────────────────────────

type ScopeAnalysisRow = Database["public"]["Tables"]["scope_analyses"]["Row"];
type ScopeRoomRow = Database["public"]["Tables"]["scope_analysis_rooms"]["Row"];
type ScopeIssueRow = Database["public"]["Tables"]["scope_analysis_issues"]["Row"];
type ScopeItemRow = Database["public"]["Tables"]["scope_analysis_items"]["Row"];

export type PersistedScopeAnalysis = {
  analysis: ScopeAnalysisRow;
  rooms: Array<ScopeRoomRow & { issues: ScopeIssueRow[]; items: ScopeItemRow[] }>;
};

// ──────────────────────────────────────────────────────────────
// Save
// ──────────────────────────────────────────────────────────────

export interface SaveScopeAnalysisInput {
  projectId: string;
  analysis: ScopeAnalysisResult;
  region: string;
  notes?: string;
}

export async function saveScopeAnalysis(
  input: SaveScopeAnalysisInput,
): Promise<PersistedScopeAnalysis> {
  const user = auth.getUser();
  if (!user) throw new Error("You must be signed in to save a scope analysis.");

  // 1. Create main analysis record
  const { data: analysis, error: analysisError } = await supabase
    .from("scope_analyses")
    .insert({
      user_id: user.id,
      property_id: input.projectId,
      overall_score: input.analysis.overall_score,
      summary: input.analysis.summary,
      region: input.region,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (analysisError) throw new Error(analysisError.message);

  // 2. Insert rooms
  const roomInserts = input.analysis.rooms.map((room, idx) => ({
    scope_analysis_id: analysis.id,
    room_name: room.room,
    area_sqm: room.area_sqm ?? null,
    condition_summary: room.condition_summary,
    display_order: idx,
  }));

  const { data: dbRooms, error: roomsError } = await supabase
    .from("scope_analysis_rooms")
    .insert(roomInserts)
    .select();

  if (roomsError) {
    // Rollback the analysis record
    await supabase.from("scope_analyses").delete().eq("id", analysis.id);
    throw new Error(roomsError.message);
  }

  // 3. Insert issues + items for each room
  const roomsByOrder = new Map(dbRooms.map((r) => [r.display_order, r]));

  const allIssueInserts: Array<Database["public"]["Tables"]["scope_analysis_issues"]["Insert"]> =
    [];
  const allItemInserts: Array<Database["public"]["Tables"]["scope_analysis_items"]["Insert"]> = [];

  for (const [roomIdx, room] of input.analysis.rooms.entries()) {
    const dbRoom = roomsByOrder.get(roomIdx);
    if (!dbRoom) continue;

    for (const [issueIdx, issue] of room.issues.entries()) {
      allIssueInserts.push({
        room_id: dbRoom.id,
        description: issue.description,
        severity: issue.severity,
        category: issue.category,
        recommended_action: issue.recommended_action,
        display_order: issueIdx,
      });
    }

    for (const [itemIdx, item] of room.recommended_items.entries()) {
      allItemInserts.push({
        room_id: dbRoom.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        base_unit_cost: item.base_unit_cost,
        notes: item.notes ?? null,
        display_order: itemIdx,
      });
    }
  }

  let dbIssues: ScopeIssueRow[] = [];
  let dbItems: ScopeItemRow[] = [];

  if (allIssueInserts.length > 0) {
    const { data, error } = await supabase
      .from("scope_analysis_issues")
      .insert(allIssueInserts)
      .select();
    if (error) {
      // Cascade: deleting analysis also deletes rooms → issues/items
      await supabase.from("scope_analyses").delete().eq("id", analysis.id);
      throw new Error(error.message);
    }
    dbIssues = data ?? [];
  }

  if (allItemInserts.length > 0) {
    const { data, error } = await supabase
      .from("scope_analysis_items")
      .insert(allItemInserts)
      .select();
    if (error) {
      await supabase.from("scope_analyses").delete().eq("id", analysis.id);
      throw new Error(error.message);
    }
    dbItems = data ?? [];
  }

  // Group issues & items by room
  const issuesByRoom = groupBy(dbIssues, (i) => i.room_id);
  const itemsByRoom = groupBy(dbItems, (i) => i.room_id);

  return {
    analysis,
    rooms: dbRooms.map((r) => ({
      ...r,
      issues: issuesByRoom.get(r.id) ?? [],
      items: itemsByRoom.get(r.id) ?? [],
    })),
  };
}

// ──────────────────────────────────────────────────────────────
// Load latest
// ──────────────────────────────────────────────────────────────

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

  // Fetch rooms
  const { data: rooms, error: roomsError } = await supabase
    .from("scope_analysis_rooms")
    .select("*")
    .eq("scope_analysis_id", analysis.id)
    .order("display_order", { ascending: true });

  if (roomsError) throw new Error(roomsError.message);
  if (!rooms || rooms.length === 0) return null;

  // Fetch issues + items for all rooms in this analysis
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

  // Reconstruct the ScopeAnalysisResult shape expected by the UI
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

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

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
