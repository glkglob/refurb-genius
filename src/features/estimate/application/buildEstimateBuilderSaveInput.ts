/**
 * Pure EstimateBuilder → SaveAIEstimateInput mapper (AO-1G1).
 *
 * No React, QueryClient, toast, Auth, Supabase, or navigation.
 * Totals are accepted as inputs — calculations remain in EstimateBuilder.
 */
import type { SaveAIEstimateInput } from "../infrastructure/repositories/estimate.repository";

/** Narrow room shape matching EstimateBuilder editor rooms (persistence fields only). */
export type EstimateBuilderSaveRoom = {
  name: string;
  area_sqm?: number;
  items: Array<{
    name: string;
    category: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    notes?: string;
  }>;
};

export type BuildEstimateBuilderSaveInputParams = {
  projectId: string;
  projectName?: string | null;
  region: string;
  rooms: EstimateBuilderSaveRoom[];
  subtotal: number;
  vat: number;
  total: number;
};

/**
 * Build the exact SaveAIEstimateInput payload used by the manual EstimateBuilder.
 * Constants (vat_rate, notes, labour/materials/weeks, is_ai_suggested) match the
 * pre-extraction handleSave mapping byte-for-byte.
 */
export function buildEstimateBuilderSaveInput(
  params: BuildEstimateBuilderSaveInputParams,
): SaveAIEstimateInput {
  return {
    projectId: params.projectId,
    title: `${params.projectName || "Property"} Refurbishment Estimate`,
    region: params.region,
    rooms: params.rooms.map((room) => ({
      name: room.name,
      area_sqm: room.area_sqm,
      items: room.items.map((item) => ({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        base_unit_cost: item.unit_cost,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
        notes: item.notes,
        labour: 0,
        materials: 0,
        weeks: 0,
        is_ai_suggested: false,
      })),
    })),
    subtotal: params.subtotal,
    vat_rate: 20,
    vat_amount: params.vat,
    total: params.total,
    notes: "Manual estimate built with drag & drop builder",
  } as SaveAIEstimateInput;
}
