// Centralized output validation for AI responses.
// Uses Zod for runtime safety on top of prompt instructions + json_object.
// Coercion + safe defaults remain for defense-in-depth and fallback UX.
// These schemas are the source of truth for what constitutes a "valid" AI result.

import { z } from "zod";

// Vision schemas — canonical source is the ai-upload slice domain.
export { ROOM_TYPES, CONDITION_LEVELS, REFURB_LEVELS } from "@/features/ai-upload/domain";
export {
  roomTypeSchema,
  conditionLevelSchema,
  refurbLevelSchema,
  analysisSourceSchema,
  roomAnalysisSchema,
  safeParseRoomAnalysis,
  type ValidatedRoomAnalysisInput,
} from "@/features/ai-upload/domain/validation";

// Scope analysis
export const scopeSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const scopeCategorySchema = z.enum(["materials", "labour", "both", "fees"]);

export const scopeIssueSchema = z.object({
  category: z.string().min(1).max(40).default("General"),
  description: z.string().min(1).max(200),
  severity: scopeSeveritySchema.default("medium"),
  recommended_action: z.string().min(1).max(200).default("Inspect and address"),
});

export const scopeRecommendedItemSchema = z
  .object({
    name: z.string().min(1).max(120),
    category: scopeCategorySchema.default("both"),
    quantity: z.number().min(0.01).max(10000).default(1),
    unit: z.string().min(1).max(20).default("item"),
    base_unit_cost: z.number().min(0.01).max(100000).default(100),
    notes: z.string().max(200).optional(),
  })
  .refine((item) => item.base_unit_cost > 0, "base_unit_cost must be positive");

export const scopeRoomSchema = z.object({
  room: z.string().min(1).max(60),
  area_sqm: z.number().positive().max(500).optional(),
  condition_summary: z.string().min(1).max(300).default("Condition assessed from photos."),
  issues: z.array(scopeIssueSchema).max(12).default([]),
  recommended_items: z.array(scopeRecommendedItemSchema).max(20).default([]),
});

export const scopeAnalysisResultSchema = z.object({
  overall_score: z.number().min(1).max(10),
  summary: z.string().min(1).max(600).default("Property analysis complete."),
  rooms: z.array(scopeRoomSchema).min(1, "At least one valid room required"),
});

export type ValidatedScopeAnalysisResult = z.infer<typeof scopeAnalysisResultSchema>;

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

// Redesign concept (text fields)
export const redesignPaletteItemSchema = z.object({
  name: z.string().min(1).max(30),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const redesignConceptTextSchema = z.object({
  tagline: z.string().min(3).max(80),
  palette: z.array(redesignPaletteItemSchema).min(3).max(6),
  flooring: z.string().min(5).max(200),
  lighting: z.string().min(5).max(200),
  furniture: z.string().min(5).max(200),
});

export type ValidatedRedesignConceptText = z.infer<typeof redesignConceptTextSchema>;

export function safeParseScopeResult(raw: unknown): ValidatedScopeAnalysisResult | null {
  const res = scopeAnalysisResultSchema.safeParse(raw);
  return res.success ? res.data : null;
}

export function safeParseEstimate(raw: unknown): ValidatedAIEstimate | null {
  const res = aiEstimateResponseSchema.safeParse(raw);
  return res.success ? res.data : null;
}

export function safeParseRedesignText(raw: unknown): ValidatedRedesignConceptText | null {
  const res = redesignConceptTextSchema.safeParse(raw);
  return res.success ? res.data : null;
}
