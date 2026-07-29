/**
 * Pure AIEstimateBuilder → SaveAIEstimateInput mapper (AO-1L1).
 *
 * No React, QueryClient, toast, Auth, Supabase, or navigation.
 * Regional line-item adjustment uses existing calculateLineItem.
 * Totals are accepted as inputs — display totals remain in the component.
 */
import { calculateLineItem } from "@/core/pricing";
import type { SaveAIEstimateInput } from "../infrastructure/repositories/estimate.repository";

/** Narrow room shape matching AIEstimateBuilder editor rooms (persistence fields). */
export type AIEstimateBuilderSaveItem = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  base_unit_cost: number;
  notes?: string;
  is_ai_suggested?: boolean;
};

export type AIEstimateBuilderSaveRoom = {
  name: string;
  area_sqm?: number;
  items: AIEstimateBuilderSaveItem[];
};

export type BuildAIEstimateBuilderSaveInputParams = {
  projectId: string;
  propertyType: string;
  bedrooms: number;
  region: string;
  rooms: AIEstimateBuilderSaveRoom[];
  notes: string;
  multiplier: number;
  totals: {
    subtotal: number;
    vat_amount: number;
    total: number;
  };
};

/**
 * Build the exact SaveAIEstimateInput payload used by AIEstimateBuilder.
 * Title, vat_rate, notes optionalization, and line-item regional adjustment
 * match the pre-extraction handleSave mapping.
 */
export function buildAIEstimateBuilderSaveInput(
  params: BuildAIEstimateBuilderSaveInputParams,
): SaveAIEstimateInput {
  return {
    projectId: params.projectId,
    title: `AI Estimate — ${params.propertyType}, ${params.bedrooms} bed`,
    region: params.region,
    rooms: params.rooms.map((room) => ({
      name: room.name,
      area_sqm: room.area_sqm,
      items: room.items.map((item) => calculateLineItem(item, params.multiplier)),
    })),
    subtotal: params.totals.subtotal,
    vat_rate: 20,
    vat_amount: params.totals.vat_amount,
    total: params.totals.total,
    notes: params.notes || undefined,
  };
}
