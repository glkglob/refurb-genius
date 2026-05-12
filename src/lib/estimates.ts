import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { EstimateCategory, FinishLevel, PricingEngineResult } from "@/core/pricing";
import type { ConditionLevel } from "@/core/ai";
import type { UKRegion } from "./projects";
import { auth } from "./auth";

type EstimateRow = Database["public"]["Tables"]["estimates"]["Row"];
type EstimateItemRow = Database["public"]["Tables"]["estimate_items"]["Row"];

export type PersistedProjectEstimate = {
  estimate: EstimateRow;
  items: EstimateItemRow[];
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
      vat: result.vat,
      low_total: result.low_total,
      mid_total: result.mid_total,
      high_total: result.high_total,
      timeline_weeks: result.timeline_weeks,
    })
    .select()
    .single();

  if (estimateError) throw new Error(estimateError.message);

  const rows = result.estimate_items.map((item) => ({
    estimate_id: estimate.id,
    user_id: user.id,
    category: item.category,
    labour: item.labour,
    materials: item.materials,
    total: item.total,
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
      console.error("Failed to rollback estimate after estimate_items insert failure.", {
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
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("*")
    .eq("project_id", projectId)
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
