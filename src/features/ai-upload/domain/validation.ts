/**
 * AI-upload slice — Vision output validation (Zod).
 *
 * Runtime safety on top of prompt instructions + json_object mode.
 * Scope/estimate/redesign schemas remain in `src/core/ai/validation.ts` until
 * their slices migrate.
 */
import { z } from "zod";
import {
  PHOTO_ANALYSIS_MOCK_FORBIDDEN,
  PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
  PhotoAnalysisError,
} from "./errors";
import type { RoomAnalysis } from "./types";
import { CONDITION_LEVELS, REFURB_LEVELS, ROOM_TYPES } from "./types";

export const roomTypeSchema = z.enum(ROOM_TYPES);
export const conditionLevelSchema = z.enum(CONDITION_LEVELS);
export const refurbLevelSchema = z.enum(REFURB_LEVELS);
export const analysisSourceSchema = z.enum(["ai", "mock", "fallback", "persisted"] as const);

/** Production Analysis source — mock cannot persist or travel over the mobile contract. */
export const productionAnalysisSourceSchema = z.enum(["ai", "fallback", "persisted"] as const);

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

/**
 * Complete transport-independent RoomAnalysis contract for Production Analysis.
 * Independent of the cookie serverFn transport schema.
 */
export const productionRoomAnalysisSchema = z
  .object({
    id: z.string().min(1),
    photo_id: z.string().uuid(),
    photo_url: z.string().min(1),
    photo_name: z.string().min(1),
    room_type: roomTypeSchema,
    condition_level: conditionLevelSchema,
    refurbishment_level: refurbLevelSchema,
    visible_issues: z.array(z.string()),
    recommended_works: z.array(z.string()),
    ai_summary: z.string(),
    confidence_score: z.number().min(0).max(1),
    source: productionAnalysisSourceSchema,
  })
  .strict();

export type ProductionRoomAnalysis = z.infer<typeof productionRoomAnalysisSchema>;

const FORBIDDEN_TRANSPORT_KEYS = [
  "retrievalUrl",
  "token",
  "access_token",
  "refresh_token",
  "Authorization",
  "authorization",
  "Bearer",
  "storage_path",
  "OPENAI_API_KEY",
] as const;

function isResponseLike(value: unknown): boolean {
  return typeof Response !== "undefined" && value instanceof Response;
}

function malformedAnalysisListError(): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
    "Photo analysis response was not a complete RoomAnalysis list.",
  );
}

/**
 * Validate a complete Production Analysis result set.
 * Rejects Response objects, `{ data }` wrappers, mock rows, missing durable
 * fields, credential/retrieval fields, and duplicate photo IDs.
 */
export function assertProductionRoomAnalysisList(value: unknown): RoomAnalysis[] {
  if (isResponseLike(value)) {
    throw malformedAnalysisListError();
  }
  if (value && typeof value === "object" && !Array.isArray(value) && "data" in value) {
    throw malformedAnalysisListError();
  }
  if (!Array.isArray(value)) {
    throw malformedAnalysisListError();
  }

  const out: RoomAnalysis[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      for (const key of FORBIDDEN_TRANSPORT_KEYS) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          throw malformedAnalysisListError();
        }
      }
      if (record.source === "mock") {
        throw new PhotoAnalysisError(
          PHOTO_ANALYSIS_MOCK_FORBIDDEN,
          "Mock analysis results cannot be used as production analysis.",
        );
      }
    }

    const parsed = productionRoomAnalysisSchema.safeParse(item);
    if (!parsed.success) {
      throw malformedAnalysisListError();
    }
    if (seen.has(parsed.data.photo_id)) {
      throw new PhotoAnalysisError(
        PHOTO_ANALYSIS_PROVENANCE_MISMATCH,
        "Duplicate analysis photo_id values are not allowed.",
      );
    }
    seen.add(parsed.data.photo_id);
    out.push(parsed.data);
  }

  return out;
}
