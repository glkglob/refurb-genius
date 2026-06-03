// Centralized output validation for AI responses.
// Uses Zod for runtime safety on top of prompt instructions + json_object.
// Coercion + safe defaults remain for defense-in-depth and fallback UX.
// These schemas are the source of truth for what constitutes a "valid" AI result.

import { z } from "zod";
import type {
  RoomType,
  ConditionLevel,
  RefurbLevel,
  RoomAnalysis,
  AnalysisSource,
} from "./mockAnalysis";

// Re-export enums for convenience (single source in mockAnalysis today)
export { ROOM_TYPES, CONDITION_LEVELS, REFURB_LEVELS } from "./mockAnalysis";

export const roomTypeSchema = z.enum([
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Hallway",
  "Exterior",
  "Garden",
  "Other",
] as const);

export const conditionLevelSchema = z.enum([
  "Modern",
  "Average",
  "Dated",
  "Poor",
  "Full Renovation Needed",
] as const);

export const refurbLevelSchema = z.enum(["Light", "Medium", "Heavy", "Full"] as const);

export const analysisSourceSchema = z.enum(["ai", "mock", "fallback", "persisted"] as const);

// Photo analysis (vision per-room)
export const roomAnalysisSchema = z.object({
  room_type: roomTypeSchema,
  condition_level: conditionLevelSchema,
  refurbishment_level: refurbLevelSchema,
  visible_issues: z.array(z.string()).max(6).default([]),
  recommended_works: z.array(z.string()).max(6).default([]),
  ai_summary: z.string().max(400).default(""),
  confidence_score: z.number().min(0).max(1).default(0.7),
});

export type ValidatedRoomAnalysisInput = z.infer<typeof roomAnalysisSchema>;

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

// Helpers: safe parse with graceful fallback to defaults (never throw to caller)
export function safeParseRoomAnalysis(raw: unknown): Partial<ValidatedRoomAnalysisInput> {
  const res = roomAnalysisSchema.safeParse(raw);
  return res.success ? res.data : {};
}

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
