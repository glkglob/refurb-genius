// Multi-step AI orchestration for higher accuracy and context passing.
// Wires vision → scope (injects detected rooms + issues into scope notes for better prompt context)
// and scope → estimate (seeds requirements from scope items/issues).
// Callers can opt-in to orchestrated flows for "balanced"/"high-quality" results while
// direct serverFns remain available for simple/fast paths.
// All steps go through existing serverFns (auth + per-action rate limiting + fallbacks).

import type { ScopeAnalysisInput, ScopeAnalysisResult } from "@/features/ai-design/domain";
import type { GenerateEstimateInput, AIGeneratedRoom } from "../server/openAiEstimate.server";
import { runPhotoAnalysisServerFn } from "@/features/ai-upload/presentation/serverFns";
import { runScopeAnalysisServerFn } from "@/features/ai-design/presentation/serverFns";
import { generateEstimateServerFn } from "../serverFns";

export type AIOrchestrationMode = "fast" | "balanced" | "high-quality";

export async function runVisionThenScope(
  input: ScopeAnalysisInput,
  mode: AIOrchestrationMode = "balanced",
): Promise<ScopeAnalysisResult> {
  const warnings: string[] = [];
  try {
    // Step 1: run vision for room detection + condition (uses ai-vision rate bucket)
    const visionResults = await runPhotoAnalysisServerFn({
      data: { projectId: input.projectId, photos: input.photos },
    });

    // Enrich context for scope prompt (notes field is injected into system prompt)
    const detectedRooms = visionResults
      .map((v) => v.room_type)
      .filter((r, i, arr) => arr.indexOf(r) === i);

    const visionSummary = visionResults
      .slice(0, 6)
      .map(
        (v) =>
          `${v.room_type} (${v.condition_level}, ${v.refurbishment_level}): ${v.visible_issues.slice(0, 2).join("; ")}`,
      )
      .join(" | ");

    const enrichedRoomTags = Array.from(new Set([...(input.roomTags || []), ...detectedRooms]));
    const enrichedNotes = [
      input.notes || "",
      visionSummary ? `Vision AI pre-analysis: ${visionSummary}` : "",
      mode === "high-quality"
        ? "High-quality mode: be extra thorough on structural/damp risks and realistic 2026 quantities."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const scopeInput: ScopeAnalysisInput = {
      ...input,
      roomTags: enrichedRoomTags.length ? enrichedRoomTags : input.roomTags,
      notes: enrichedNotes || undefined,
    };

    // Step 2: scope with enriched context (ai-scope rate bucket)
    const scope = await runScopeAnalysisServerFn({ data: scopeInput });
    return scope;
  } catch (err) {
    warnings.push("Vision→scope orchestration partial failure; falling back to direct scope.");
    // Fall back to direct scope call (still benefits from serverFn protections)
    return runScopeAnalysisServerFn({ data: input });
  }
}

export async function runScopeThenEstimate(
  scope: ScopeAnalysisResult,
  base: Omit<GenerateEstimateInput, "requirements">,
  mode: AIOrchestrationMode = "balanced",
): Promise<AIGeneratedRoom[]> {
  // Build rich requirements text from scope (items + critical issues) to seed the estimate prompt
  const topItems = scope.rooms
    .flatMap((r) => r.recommended_items)
    .slice(0, 8)
    .map((i) => `${i.name} (x${i.quantity} ${i.unit})`)
    .join("; ");

  const criticalIssues = scope.rooms
    .flatMap((r) =>
      r.issues.filter((iss) => iss.severity === "critical" || iss.severity === "high"),
    )
    .slice(0, 5)
    .map((iss) => iss.description);

  const requirements = [
    "Standard good quality modern refurb for investment",
    topItems ? `Prioritise from scope: ${topItems}` : "",
    criticalIssues.length
      ? `Address critical/high issues first: ${criticalIssues.join(" | ")}`
      : "",
    mode === "high-quality"
      ? "High-quality: provide detailed room-by-room with realistic quantities and 2026 UK costs."
      : "",
  ]
    .filter(Boolean)
    .join(". ");

  const estimateInput: GenerateEstimateInput = {
    ...base,
    requirements,
  };

  try {
    const rooms = await generateEstimateServerFn({ data: estimateInput });
    return rooms;
  } catch (err) {
    // The generate fn already has its own fallback logic in some paths; surface empty to caller
    return [];
  }
}

export type FullIntelResult = {
  scope?: ScopeAnalysisResult;
  estimate?: AIGeneratedRoom[];
  warnings: string[];
  modelUsed?: string;
  cached?: boolean;
};

export async function runFullRefurbIntel(input: {
  projectId: string;
  photos: Array<{ id: string; url: string; name: string; size?: number }>;
  property: {
    propertyType: string;
    bedrooms: number;
    bathrooms?: number;
    region: string;
  };
  mode?: AIOrchestrationMode;
}): Promise<FullIntelResult> {
  const warnings: string[] = [];
  const mode = input.mode || "balanced";

  try {
    const scopeInput: ScopeAnalysisInput = {
      projectId: input.projectId,
      photos: input.photos,
      roomTags: [], // will be enriched by vision
      propertyType: input.property.propertyType,
      bedrooms: input.property.bedrooms,
      bathrooms: input.property.bathrooms,
      region: input.property.region,
    };

    const scope = await runVisionThenScope(scopeInput, mode);

    const estimateBase: Omit<GenerateEstimateInput, "requirements"> = {
      propertyType: input.property.propertyType,
      bedrooms: input.property.bedrooms,
      bathrooms: input.property.bathrooms,
      region: input.property.region,
      condition: "Average", // caller can refine; scope overall gives signal
      // sizeSqm omitted unless provided upstream
    };

    const estimate = await runScopeThenEstimate(scope, estimateBase, mode);

    return {
      scope,
      estimate: estimate.length ? estimate : undefined,
      warnings,
      cached: false,
    };
  } catch (err) {
    warnings.push(
      "Full intel orchestration encountered an error; partial results may be available via direct flows.",
    );
    return { warnings };
  }
}
