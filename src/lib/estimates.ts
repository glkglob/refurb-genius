import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/integrations/supabase/types";
import type { EstimateCategory, FinishLevel, PricingEngineResult } from "@/core/pricing";
import type { ConditionLevel } from "@/core/ai";
import type { CalculatedLineItem } from "@/core/pricing";
import type { UKRegion } from "./projects";
import { auth } from "./auth";

type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type EstimateItemRow = Database["public"]["Tables"]["estimate_items"]["Row"];
type EstimateRoomRow = Database["public"]["Tables"]["estimate_rooms"]["Row"];

export type PersistedProjectEstimate = {
  estimate: EstimateRow;
  items: EstimateItemRow[];
};

export type PersistedRoomEstimate = {
  estimate: EstimateRow;
  rooms: (EstimateRoomRow & { items: EstimateItemRow[] })[];
};

export async function saveProjectEstimate(
  projectId: string,
  result: PricingEngineResult,
): Promise<PersistedProjectEstimate> {
  const user = auth.getUser();
  if (!user) throw new Error("You must be signed in to save an estimate.");

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      project_id: projectId,
      user_id: user.id,
      region: result.inputs.region,
      condition_level: result.inputs.property_condition,
      finish_level: result.inputs.finish_quality,
      labour_total: result.labour_total,
      materials_total: result.materials_total,
      subtotal: result.subtotal,
      contingency: result.contingency,
      vat_amount: result.vat,
      low_total: result.low_total,
      mid_total: result.mid_total,
      high_total: result.high_total,
      timeline_weeks: result.timeline_weeks,
    })
    .select()
    .single();

  if (estimateError) throw new Error(estimateError.message);

  const rows = result.lineItems.map((item) => ({
    estimate_id: estimate.id,
    user_id: user.id,
    category: item.category,
    labour: item.labour,
    materials: item.materials,
    total_cost: item.total,
    weeks: item.weeks,
  }));

  if (rows.length === 0) return { estimate, items: [] };

  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .insert(rows)
    .select();

  if (itemsError) {
    const { error: rollbackError } = await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id);

    if (rollbackError) {
      logger.error("[estimates] Failed to rollback estimate after items insert failure", {
        estimateId: estimate.id,
        projectId,
        itemsInsertError: itemsError.message,
        rollbackError: rollbackError.message,
      });

      throw new Error(
        `Failed to save estimate items: ${itemsError.message}. Rollback delete also failed for estimate ${estimate.id}: ${rollbackError.message}`,
      );
    }

    throw new Error(itemsError.message);
  }

  return { estimate, items: items ?? [] };
}

export async function getLatestProjectEstimate(
  projectId: string,
): Promise<PersistedProjectEstimate | null> {
  const user = auth.getUser();
  if (!user) return null;

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (estimateError) throw new Error(estimateError.message);
  if (!estimate) return null;

  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", estimate.id)
    .order("category", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  return { estimate, items: items ?? [] };
}

export function persistedEstimateInput(saved: PersistedProjectEstimate) {
  return {
    region: saved.estimate.region as UKRegion,
    condition: saved.estimate.condition_level as ConditionLevel,
    finish: saved.estimate.finish_level as FinishLevel,
    categories: saved.items.map((item) => item.category as EstimateCategory),
  };
}

// ──────────────────────────────────────────────────────────────
// Room-based AI estimate persistence
// ──────────────────────────────────────────────────────────────

export type SaveAIEstimateInput = {
  projectId: string;
  title: string;
  region: string;
  rooms: Array<{
    name: string;
    area_sqm?: number;
    items: CalculatedLineItem[];
  }>;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes?: string;
};

export async function saveAIEstimate(input: SaveAIEstimateInput): Promise<PersistedRoomEstimate> {
  const user = auth.getUser();
  if (!user) throw new Error("You must be signed in to save an estimate.");

  // 1. Create the estimate header
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      project_id: input.projectId,
      user_id: user.id,
      title: input.title,
      region: input.region,
      status: "draft",
      subtotal: input.subtotal,
      vat_rate: input.vat_rate,
      vat_amount: input.vat_amount,
      high_total: input.total,
      mid_total: input.total,
      low_total: Math.round(input.total * 0.85),
      ai_generated: true,
      notes: input.notes,
      // Legacy columns — zero for AI estimates (these are per-category)
      labour_total: 0,
      materials_total: 0,
      contingency: 0,
      timeline_weeks: 0,
      condition_level: "Dated",
      finish_level: "Standard",
    })
    .select()
    .single();

  if (estimateError) throw new Error(estimateError.message);

  // 2. Create rooms
  const roomInserts = input.rooms.map((room, idx) => ({
    estimate_id: estimate.id,
    name: room.name,
    area_sqm: room.area_sqm ?? null,
    subtotal: room.items.reduce((s, i) => s + i.total_cost, 0),
    display_order: idx,
  }));

  const { data: rooms, error: roomsError } = await supabase
    .from("estimate_rooms")
    .insert(roomInserts)
    .select();

  if (roomsError) {
    const { error: rollbackError } = await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id);

    if (rollbackError) {
      logger.error("[estimates] Failed to rollback estimate after rooms insert failure", {
        estimateId: estimate.id,
        projectId: input.projectId,
        roomsInsertError: roomsError.message,
        rollbackError: rollbackError.message,
      });
      throw new Error(
        `Failed to save rooms: ${roomsError.message}. Rollback also failed for estimate ${estimate.id}: ${rollbackError.message}`,
      );
    }

    throw new Error(roomsError.message);
  }

  // 3. Create items for each room
  // Build a lookup keyed by display_order so we don't rely on insert order
  const roomsByDisplayOrder = new Map(rooms.map((r) => [r.display_order, r]));

  const itemInserts = input.rooms.flatMap((room, roomIdx) => {
    const dbRoom = roomsByDisplayOrder.get(roomIdx);
    if (!dbRoom) {
      throw new Error(`Room at display_order=${roomIdx} not found in DB response`);
    }
    return room.items.map((item, itemIdx) => ({
      estimate_id: estimate.id,
      room_id: dbRoom.id,
      user_id: user.id,
      name: item.name,
      category: item.category ?? "both",
      quantity: item.quantity,
      unit: item.unit ?? "item",
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
      notes: item.notes ?? null,
      is_ai_suggested: true,
      display_order: itemIdx,
      // Legacy columns
      labour: 0,
      materials: 0,
      weeks: 0,
    }));
  });

  if (itemInserts.length === 0) {
    return { estimate, rooms: rooms.map((r) => ({ ...r, items: [] })) };
  }

  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .insert(itemInserts)
    .select();

  if (itemsError) {
    // Cascade: deleting estimate also deletes rooms (FK CASCADE)
    const { error: rollbackError } = await supabase
      .from("estimates")
      .delete()
      .eq("id", estimate.id);

    if (rollbackError) {
      logger.error("[estimates] Failed to rollback estimate after items insert failure", {
        estimateId: estimate.id,
        projectId: input.projectId,
        itemsInsertError: itemsError.message,
        rollbackError: rollbackError.message,
      });
      throw new Error(
        `Failed to save items: ${itemsError.message}. Rollback also failed for estimate ${estimate.id}: ${rollbackError.message}`,
      );
    }

    throw new Error(itemsError.message);
  }

  // Group items by room
  const itemsByRoom = new Map<string, EstimateItemRow[]>();
  for (const item of items ?? []) {
    const roomId = item.room_id ?? "";
    const list = itemsByRoom.get(roomId) ?? [];
    list.push(item);
    itemsByRoom.set(roomId, list);
  }

  return {
    estimate,
    rooms: rooms.map((r) => ({
      ...r,
      items: itemsByRoom.get(r.id) ?? [],
    })),
  };
}

export async function getLatestRoomEstimate(
  projectId: string,
): Promise<PersistedRoomEstimate | null> {
  const user = auth.getUser();
  if (!user) return null;

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("ai_generated", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (estimateError) throw new Error(estimateError.message);
  if (!estimate) return null;

  const { data: rooms, error: roomsError } = await supabase
    .from("estimate_rooms")
    .select("*")
    .eq("estimate_id", estimate.id)
    .order("display_order", { ascending: true });

  if (roomsError) throw new Error(roomsError.message);

  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .select("*")
    .eq("estimate_id", estimate.id)
    .order("display_order", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const itemsByRoom = new Map<string, EstimateItemRow[]>();
  for (const item of items ?? []) {
    const roomId = item.room_id ?? "";
    const list = itemsByRoom.get(roomId) ?? [];
    list.push(item);
    itemsByRoom.set(roomId, list);
  }

  return {
    estimate,
    rooms: (rooms ?? []).map((r) => ({
      ...r,
      items: itemsByRoom.get(r.id) ?? [],
    })),
  };
}
