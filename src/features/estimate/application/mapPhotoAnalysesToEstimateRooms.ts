/**
 * Pure photo-analysis → estimate room mapping (AO-1C2).
 *
 * Side effects: crypto.randomUUID() per newly created room only.
 * No React, QueryClient, toast, Auth, or Supabase.
 */
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";

/** Suggested estimate item shape written into the client estimate cache. */
export interface SuggestedEstimateItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  notes: string;
}

/** Newly suggested room for append-only merge into estimate cache. */
export interface SuggestedEstimateRoom {
  id: string;
  name: string;
  items: SuggestedEstimateItem[];
}

type ParsedDefect = {
  description: string;
  severity?: string;
  category?: string;
  estimated_cost?: number;
};

type ParsedMaterial = {
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit?: number;
};

type ParsedAnalysis = {
  room?: string;
  category?: string;
  defects?: ParsedDefect[];
  material_estimates?: ParsedMaterial[];
  cost_suggestions?: { low?: number; mid?: number; high?: number };
};

/**
 * Parse analysis app model with Apply-to-Estimate semantics (matches viewer rowToParsed):
 * room and category both seed from analysis.category.
 * Content is already domain-typed (analysis_data mapped at the query boundary).
 */
function parseAnalysis(a: PhotoAnalysisResultRow): ParsedAnalysis {
  return {
    room: a.category ?? undefined,
    category: a.category ?? undefined,
    defects: a.detected_defects.map((d) => ({
      description: d.description,
      severity: d.severity,
      category: d.category,
      estimated_cost: d.estimated_cost,
    })),
    material_estimates: a.material_estimates.map((m) => ({
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
      cost_per_unit: m.cost_per_unit,
    })),
    cost_suggestions: a.cost_suggestions ?? undefined,
  };
}

/**
 * Map photo analysis rows into newly suggested estimate rooms.
 * Does not merge with existing estimate rooms; append ownership is the hook's.
 */
export function mapPhotoAnalysesToEstimateRooms(
  analyses: PhotoAnalysisResultRow[],
): SuggestedEstimateRoom[] {
  const suggestedRooms: Record<string, { name: string; items: SuggestedEstimateItem[] }> = {};

  analyses.forEach((analysis) => {
    const data = parseAnalysis(analysis);
    const roomName = data.room || "General / Unspecified";
    if (!suggestedRooms[roomName]) {
      suggestedRooms[roomName] = { name: roomName, items: [] };
    }

    (data.defects || []).forEach((def: ParsedDefect, idx: number) => {
      suggestedRooms[roomName].items.push({
        id: `sugg-${analysis.id}-${idx}`,
        name: def.description,
        category: def.category || data.category || "General",
        quantity: 1,
        unit: "item",
        unit_cost:
          def.estimated_cost ||
          (data.cost_suggestions?.mid ? Math.round(data.cost_suggestions.mid / 10) : 150),
        notes: `From AI photo analysis (conf ${Math.round((analysis.confidence_score || 0.8) * 100)}%)`,
      });
    });

    (data.material_estimates || []).forEach((mat, idx: number) => {
      suggestedRooms[roomName].items.push({
        id: `sugg-mat-${analysis.id}-${idx}`,
        name: mat.name,
        category: data.category || "Materials",
        quantity: mat.quantity || 1,
        unit: mat.unit || "item",
        unit_cost: mat.cost_per_unit || 50,
        notes: "AI material estimate",
      });
    });
  });

  return Object.values(suggestedRooms).map((r) => ({
    id: crypto.randomUUID(),
    name: r.name,
    items: r.items,
  }));
}
