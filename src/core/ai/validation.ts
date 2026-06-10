// Centralized output validation for AI responses.
// Vision → ai-upload slice; scope/redesign → ai-design slice.
// Estimate schemas remain here until the estimate slice absorbs them.

import { z } from "zod";
import { scopeCategorySchema } from "@/features/ai-design";

// Vision schemas — canonical source is the ai-upload slice domain.
export { ROOM_TYPES, CONDITION_LEVELS, REFURB_LEVELS } from "@/features/ai-upload";
export {
  roomTypeSchema,
  conditionLevelSchema,
  refurbLevelSchema,
  analysisSourceSchema,
  roomAnalysisSchema,
  safeParseRoomAnalysis,
  type ValidatedRoomAnalysisInput,
} from "@/features/ai-upload";

// Scope + redesign schemas — canonical source is the ai-design slice domain.
export {
  scopeSeveritySchema,
  scopeCategorySchema,
  scopeIssueSchema,
  scopeRecommendedItemSchema,
  scopeRoomSchema,
  scopeAnalysisResultSchema,
  redesignPaletteItemSchema,
  redesignConceptTextSchema,
  safeParseScopeResult,
  safeParseRedesignText,
  type ValidatedScopeAnalysisResult,
  type ValidatedRedesignConceptText,
} from "@/features/ai-design";

// Estimate (room-based AI suggestions)
export const aiGeneratedItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: scopeCategorySchema.default("both"),
  quantity: z.number().min(0.01).max(10000).default(1),
  unit: z.string().min(1).max(20).default("item"),
  base_unit_cost: z.number().min(0.01).max(100000).default(50),
  notes: z.string().max(200).optional(),
});

export const aiGeneratedRoomSchema = z.object({
  name: z.string().min(1).max(60),
  area_sqm: z.number().positive().max(500).optional(),
  items: z.array(aiGeneratedItemSchema).min(1, "Room must have at least one costed item"),
});

export const aiEstimateResponseSchema = z.object({
  rooms: z.array(aiGeneratedRoomSchema).min(1, "At least one valid room required"),
});

export type ValidatedAIEstimate = z.infer<typeof aiEstimateResponseSchema>;

export function safeParseEstimate(raw: unknown): ValidatedAIEstimate | null {
  const res = aiEstimateResponseSchema.safeParse(raw);
  return res.success ? res.data : null;
}
