// AI suggestion normalizers.
// Goal: AI is great at "what needs doing + rough quantities + condition", poor at hallucinating unit prices.
// These functions map AI output to the deterministic pricing authority (@repo/services)
// while preserving AI's descriptive value (notes, custom items, room breakdown).
// Always call before persisting or showing "final" numbers in reports.

import type { AIGeneratedRoom, AIGeneratedItem } from "./server/openAiEstimate.server";
import type { ScopeAnalysisResult } from "./server/openAiScopeAnalysis.server";
import {
  getRegionalMultiplier,
  calculateLineItem,
  CATEGORY_BASE,
  type CalculatedLineItem,
} from "@/core/pricing";
import type { UKRegion } from "@/lib/projects";
import type { ConditionLevel } from "./mockAnalysis";

export type EstimateNormalizationInput = {
  aiRooms: AIGeneratedRoom[];
  region: UKRegion;
  condition: ConditionLevel;
  scope?: ScopeAnalysisResult; // for risk signals (critical issues etc)
  sizeSqm?: number;
};

export type NormalizedEstimateRoom = {
  name: string;
  area_sqm?: number;
  items: CalculatedLineItem[];
  aiSuggestedSubtotal: number; // before any adjustment
  normalizedSubtotal: number;
};

export type NormalizedEstimateResult = {
  rooms: NormalizedEstimateRoom[];
  totalNormalized: number;
  totalAiSuggested: number;
  riskMultiplier: number; // applied contingency uplift
  warnings: string[];
  notes: string[];
};

/** Derive a risk/contingency uplift (0.08 - 0.25) from condition + scope signals. */
function computeRiskMultiplier(condition: ConditionLevel, scope?: ScopeAnalysisResult): number {
  let base = 0.1;
  if (condition === "Poor" || condition === "Full Renovation Needed") base = 0.18;
  if (condition === "Dated") base = 0.12;

  if (scope) {
    const critical = scope.rooms
      .flatMap((r) => r.issues)
      .filter((i) => i.severity === "critical").length;
    const high = scope.rooms.flatMap((r) => r.issues).filter((i) => i.severity === "high").length;
    if (critical > 0) base = Math.max(base, 0.2);
    if (critical + high > 4) base = Math.max(base, 0.16);
  }
  return Math.min(0.25, Math.max(0.08, base));
}

/** Best-effort map an AI item name to a known pricing category for rate lookup. */
function mapToCategory(name: string): keyof typeof CATEGORY_BASE | null {
  const n = name.toLowerCase();
  if (n.includes("kitchen")) return "Kitchen";
  if (n.includes("bath")) return "Bathroom";
  if (n.includes("floor")) return "Flooring";
  if (n.includes("paint") || n.includes("decorat")) return "Painting";
  if (n.includes("electric") || n.includes("rewire") || n.includes("consumer")) return "Electrical";
  if (n.includes("plumb") || n.includes("tap") || n.includes("waste")) return "Plumbing";
  if (n.includes("heat") || n.includes("boiler") || n.includes("radiator")) return "Heating";
  if (n.includes("roof")) return "Roofing";
  if (n.includes("struct") || n.includes("beam") || n.includes("wall")) return "Structural";
  if (n.includes("damp") || n.includes("mould")) return "Damp Treatment";
  if (n.includes("garden") || n.includes("landscap")) return "Garden";
  if (n.includes("window") || n.includes("door")) return "Windows & Doors";
  return null;
}

/**
 * Normalize one AI item:
 * - If maps to CATEGORY_BASE: use authoritative base rate * regional (AI qty + notes preserved).
 * - Else: keep AI base_unit_cost but apply regional + light sanity clamp + flag.
 */
function normalizeItem(
  item: AIGeneratedItem,
  regionalMult: number,
  categoryOverride?: keyof typeof CATEGORY_BASE,
): CalculatedLineItem & { normalizedFromAuthority: boolean; warning?: string } {
  const cat = categoryOverride ?? mapToCategory(item.name);
  const baseRate = cat ? CATEGORY_BASE[cat] : null;

  let unitCost = item.base_unit_cost * regionalMult;
  let fromAuth = false;
  let warning: string | undefined;

  if (baseRate) {
    // Prefer authority rate for the category (AI may have been optimistic/pessimistic)
    const authAvg = (baseRate.labour + baseRate.materials) / 2;
    // Blend a little: 70% authority + 30% AI suggestion (keeps some project-specific flavour)
    unitCost = (authAvg * 0.7 + item.base_unit_cost * 0.3) * regionalMult;
    fromAuth = true;
  } else {
    // Freeform: still apply region, but warn if wildly different from "typical" mid item (~£150-400)
    if (item.base_unit_cost < 20) {
      unitCost = 80 * regionalMult;
      warning = "AI unit cost very low — clamped to realistic minimum";
    }
    if (item.base_unit_cost > 8000 && !item.name.toLowerCase().includes("kitchen")) {
      unitCost = 1200 * regionalMult;
      warning = "AI unit cost very high for non-kitchen item — clamped";
    }
  }

  const calc = calculateLineItem(
    { ...item, base_unit_cost: unitCost / regionalMult }, // calculate expects pre-region base
    regionalMult,
  );

  return {
    ...calc,
    normalizedFromAuthority: fromAuth,
    warning,
  };
}

export function normalizeAIEstimate(input: EstimateNormalizationInput): NormalizedEstimateResult {
  const regional = getRegionalMultiplier(input.region);
  const risk = computeRiskMultiplier(input.condition, input.scope);
  const warnings: string[] = [];
  const notes: string[] = [
    `Regional multiplier ×${regional.toFixed(2)} applied.`,
    `Risk/contingency uplift derived: ${(risk * 100).toFixed(0)}%.`,
  ];

  const rooms: NormalizedEstimateRoom[] = input.aiRooms.map((r) => {
    const normalizedItems = r.items.map((it) => normalizeItem(it, regional));
    const aiSuggestedSubtotal = r.items.reduce((s, it) => s + it.quantity * it.base_unit_cost, 0);
    let normalizedSubtotal = normalizedItems.reduce((s, it) => s + it.total_cost, 0);

    // Apply risk uplift to the room subtotal (mimics higher contingency on poor condition)
    const uplifted = Math.round(normalizedSubtotal * (1 + risk));
    if (Math.abs(uplifted - normalizedSubtotal) > 50) {
      notes.push(`${r.name}: risk-adjusted +£${(uplifted - normalizedSubtotal).toLocaleString()}`);
    }
    normalizedSubtotal = uplifted;

    // Collect per-item warnings
    normalizedItems.forEach((ni) => {
      if (ni.warning) warnings.push(`${r.name} / ${ni.name}: ${ni.warning}`);
    });

    return {
      name: r.name,
      area_sqm: r.area_sqm,
      items: normalizedItems,
      aiSuggestedSubtotal: Math.round(aiSuggestedSubtotal),
      normalizedSubtotal: Math.round(normalizedSubtotal),
    };
  });

  const totalAiSuggested = rooms.reduce((s, r) => s + r.aiSuggestedSubtotal, 0);
  const totalNormalized = rooms.reduce((s, r) => s + r.normalizedSubtotal, 0);

  if (warnings.length > 0) {
    warnings.unshift("Some AI-suggested rates were adjusted to align with pricing authority.");
  }

  return {
    rooms,
    totalNormalized: Math.round(totalNormalized),
    totalAiSuggested: Math.round(totalAiSuggested),
    riskMultiplier: risk,
    warnings: Array.from(new Set(warnings)),
    notes,
  };
}
