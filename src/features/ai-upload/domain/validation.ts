/**
 * AI-upload slice — Vision output validation (Zod).
 *
 * Runtime safety on top of prompt instructions + json_object mode.
 * Scope/estimate/redesign schemas remain in `src/core/ai/validation.ts` until
 * their slices migrate.
 */
import { z } from "zod";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "./types";

export const roomTypeSchema = z.enum(ROOM_TYPES);
export const conditionLevelSchema = z.enum(CONDITION_LEVELS);
export const refurbLevelSchema = z.enum(REFURB_LEVELS);
export const analysisSourceSchema = z.enum(["ai", "mock", "fallback", "persisted"] as const);

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

export function safeParseRoomAnalysis(raw: unknown): Partial<ValidatedRoomAnalysisInput> {
  const res = roomAnalysisSchema.safeParse(raw);
  return res.success ? res.data : {};
}
