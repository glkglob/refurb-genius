/**
 * AI-upload slice — Hugging Face Vision adapter (server-only).
 *
 * Alternative to OpenAI Vision adapter. Uses HF Inference API or self-hosted TGI/vLLM.
 * Reach this only via dynamic `import()` inside serverFn handlers.
 *
 * Supported models (via VISION_MODELS):
 * - meta-llama/Llama-3.2-11B-Vision-Instruct (default, good balance)
 * - meta-llama/Llama-3.2-90B-Vision-Instruct (best quality)
 * - Qwen/Qwen2-VL-7B-Instruct (strong multilingual)
 * - mistralai/Pixtral-12B-2409 (strong vision)
 * - HuggingFaceTB/SmolVLM-Instruct (lightweight, fast)
 */
import "@tanstack/react-start/server-only";

import type {
  AnalysisPhotoSource,
  ConditionLevel,
  RefurbLevel,
  RoomAnalysis,
  RoomType,
} from "../../domain";
import { buildMockRoomAnalyses } from "../../domain";
import { safeParseRoomAnalysis } from "../../domain/validation";
import { captureAiError, addDiagnosticBreadcrumb, setConversationId } from "@/lib/sentry";
import {
  getHuggingFaceConfig,
  hfVisionChatCompletion,
  isHuggingFaceConfigured,
  VISION_MODELS,
} from "@/platform/huggingface/server";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/provider-diagnostics";
import { timeoutPromise, isTimeoutError } from "@/lib/timeout";
import { withRetry } from "@/core/ai/platform/retry";

const AI_ANALYSIS_TIMEOUT_MS = 60_000;

const VALID_ROOM_TYPES: RoomType[] = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Hallway",
  "Exterior",
  "Garden",
  "Other",
];
const VALID_CONDITION_LEVELS: ConditionLevel[] = [
  "Modern",
  "Average",
  "Dated",
  "Poor",
  "Full Renovation Needed",
];
const VALID_REFURB_LEVELS: RefurbLevel[] = ["Light", "Medium", "Heavy", "Full"];

function coerceRoomType(v: unknown): RoomType {
  if (typeof v === "string" && (VALID_ROOM_TYPES as string[]).includes(v)) return v as RoomType;
  return "Other";
}

function coerceConditionLevel(v: unknown): ConditionLevel {
  if (typeof v === "string" && (VALID_CONDITION_LEVELS as string[]).includes(v)) {
    return v as ConditionLevel;
  }
  return "Average";
}

function coerceRefurbLevel(v: unknown): RefurbLevel {
  if (typeof v === "string" && (VALID_REFURB_LEVELS as string[]).includes(v)) {
    return v as RefurbLevel;
  }
  return "Medium";
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").slice(0, 6);
}

function coerceScore(v: unknown): number {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
  return 0.75;
}

/**
 * System prompt for HF vision models.
 * Slightly adapted from OpenAI version - some HF models prefer different formatting.
 */
const SYSTEM_PROMPT = `You are an expert UK property refurbishment surveyor (20+ years, RICS-aware).
Analyse the photo and return ONLY a JSON object with EXACTLY these fields (no markdown, no extra text):

{
  "room_type": one of ["Kitchen","Bathroom","Bedroom","Living Room","Hallway","Exterior","Garden","Other"],
  "condition_level": one of ["Modern","Average","Dated","Poor","Full Renovation Needed"],
  "refurbishment_level": one of ["Light","Medium","Heavy","Full"],
  "visible_issues": [1-5 concise strings of visible defects/concerns only],
  "recommended_works": [1-5 concise practical refurbishment recommendations],
  "ai_summary": "1-2 sentence professional assessment using UK terminology",
  "confidence_score": number 0-1
}

UK spelling. Only describe what is clearly visible. Return pure JSON.`;

function buildFallback(photo: AnalysisPhotoSource): RoomAnalysis {
  return {
    id: photo.id,
    photo_url: photo.url,
    photo_name: photo.name,
    room_type: "Other",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: ["Analysis unavailable for this image"],
    recommended_works: ["Manual inspection recommended"],
    ai_summary: "AI analysis could not be completed for this photo.",
    confidence_score: 0,
    source: "fallback",
  };
}

function parseGptJson(text: string): unknown {
  const trimmed = text.trim();
  // Handle both markdown code fences and raw JSON
  const inner = trimmed.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(inner);
}

async function analysePhoto(
  config: ReturnType<typeof getHuggingFaceConfig>,
  photo: AnalysisPhotoSource,
): Promise<RoomAnalysis> {
  try {
    addDiagnosticBreadcrumb("ai:hf:analyze:start", {
      photo: photo.name,
      size: photo.size,
      model: config.defaultVisionModel,
      timeout: AI_ANALYSIS_TIMEOUT_MS,
    });

    const completion = await withRetry(
      async () =>
        timeoutPromise(
          hfVisionChatCompletion(config, config.defaultVisionModel!, [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: photo.url, detail: "low" },
                },
                {
                  type: "text",
                  text: `Analyse this property photo (filename: ${photo.name}).`,
                },
              ],
            },
          ]),
          AI_ANALYSIS_TIMEOUT_MS,
          `HF vision analysis for ${photo.name}`,
        ),
      { maxAttempts: 2, baseDelayMs: 500 },
      `hf-vision:${photo.name}`,
    );

    const raw = completion;
    if (!raw) throw new Error("Empty response from HuggingFace");

    const parsed = parseGptJson(raw) as Record<string, unknown>;
    const zodValidated = safeParseRoomAnalysis(parsed);
    const validated = { ...parsed, ...zodValidated };

    addDiagnosticBreadcrumb("ai:hf:analyze:success", {
      photo: photo.name,
      model: config.defaultVisionModel,
      confidence: validated.confidence_score,
    });

    incrementCounter("hf_vision_success");

    return {
      id: photo.id,
      photo_url: photo.url,
      photo_name: photo.name,
      room_type: coerceRoomType(validated.room_type),
      condition_level: coerceConditionLevel(validated.condition_level),
      refurbishment_level: coerceRefurbLevel(validated.refurbishment_level),
      visible_issues: coerceStringArray(validated.visible_issues),
      recommended_works: coerceStringArray(validated.recommended_works),
      ai_summary: typeof validated.ai_summary === "string" ? validated.ai_summary : "",
      confidence_score: coerceScore(validated.confidence_score),
      source: "ai", // Could be "hf-ai" to distinguish
    };
  } catch (err) {
    let reason: "timeout" | "rate_limit" | "parse_error" | "api_error" | "not_configured" =
      "api_error";
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (isTimeoutError(err)) {
      reason = "timeout";
      incrementCounter("hf_vision_timeout");
    } else if (errorMsg.includes("rate_limit") || errorMsg.includes("429")) {
      reason = "rate_limit";
      incrementCounter("hf_vision_rate_limit");
    } else if (errorMsg.includes("parse") || errorMsg.includes("JSON")) {
      reason = "parse_error";
      incrementCounter("hf_vision_parse_failure");
    } else if (errorMsg.includes("not configured") || errorMsg.includes("API key")) {
      reason = "not_configured";
      incrementCounter("hf_vision_not_configured");
    }

    incrementCounter("hf_vision_fallback_used");

    logger.warn("[ai-server] Failed to analyse photo via HuggingFace", {
      photo: photo.name,
      reason,
      error: errorMsg,
    });

    captureAiError(err, {
      provider: "hf-vision",
      photoName: photo.name,
      reason,
    });

    addDiagnosticBreadcrumb("ai:hf:analyze:fallback", {
      photo: photo.name,
      reason,
    });

    return buildFallback(photo);
  }
}

export async function runSecurePhotoAnalysisHuggingFace(input: {
  projectId: string;
  photos: AnalysisPhotoSource[];
}): Promise<RoomAnalysis[]> {
  const photos = input.photos.length > 0 ? input.photos : undefined;
  const config = getHuggingFaceConfig();

  if (!isHuggingFaceConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("HUGGINGFACE_API_KEY or HUGGINGFACE_ENDPOINT_URL is not configured");
      captureAiError(err, { provider: "hf-vision", reason: "not_configured" });
      throw err;
    }
    incrementCounter("hf_vision_fallback_used");
    return buildMockRoomAnalyses(photos);
  }

  setConversationId(`project-${input.projectId}`);

  if (!photos?.length) {
    incrementCounter("hf_vision_fallback_used");
    return buildMockRoomAnalyses(photos);
  }

  const startTime = Date.now();
  addDiagnosticBreadcrumb("ai:hf:batch:start", {
    projectId: input.projectId,
    photoCount: photos.length,
    model: config.defaultVisionModel,
    timeoutPerPhotoMs: AI_ANALYSIS_TIMEOUT_MS,
  });

  const results = await Promise.all(photos.map((photo) => analysePhoto(config, photo)));

  const successCount = results.filter((r) => r.confidence_score > 0).length;
  const fallbackCount = results.filter((r) => r.confidence_score === 0).length;
  const durationMs = Date.now() - startTime;

  addDiagnosticBreadcrumb("ai:hf:batch:complete", {
    projectId: input.projectId,
    photoCount: photos.length,
    model: config.defaultVisionModel,
    successCount,
    fallbackCount,
    durationMs,
    avgPerPhotoMs: Math.round(durationMs / photos.length),
  });

  return results;
}

// Export model list for UI/config
export { VISION_MODELS } from "@/platform/huggingface/server";
export type { VisionModelId } from "@/platform/huggingface/server";
