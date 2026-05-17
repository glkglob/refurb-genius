// Real OpenAI Vision provider for photo analysis.
//
// Uses GPT-4o vision model via direct fetch to OpenAI API.
// Falls back gracefully per-photo if parsing fails.
// No OpenAI SDK — direct fetch calls only.
import { photoStore } from "@/lib/photos";
import type { ProjectPhoto } from "@/lib/photos";
import type { RoomAnalysis, RoomType, ConditionLevel, RefurbLevel } from "@/lib/analysis";
import type { PhotoAnalysisInput, PhotoAnalysisProvider } from "./photoAnalysis";
import { captureAiError, addDiagnosticBreadcrumb } from "@/lib/sentry";
import { logger } from "@/lib/logger";

// Timeout configuration: 60s per photo analysis (OpenAI can take 30-45s for complex images)
const AI_ANALYSIS_TIMEOUT_MS = 60_000;

// Valid enum values — duplicated here to avoid importing from lib/analysis at runtime.
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
  if (typeof v === "string" && (VALID_CONDITION_LEVELS as string[]).includes(v))
    return v as ConditionLevel;
  return "Average";
}
function coerceRefurbLevel(v: unknown): RefurbLevel {
  if (typeof v === "string" && (VALID_REFURB_LEVELS as string[]).includes(v))
    return v as RefurbLevel;
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

const SYSTEM_PROMPT = `You are an expert UK property refurbishment surveyor with 20 years of experience.
Analyse the provided property photo and return a JSON object with EXACTLY these fields:

{
  "room_type": one of ${JSON.stringify(VALID_ROOM_TYPES)},
  "condition_level": one of ${JSON.stringify(VALID_CONDITION_LEVELS)},
  "refurbishment_level": one of ${JSON.stringify(VALID_REFURB_LEVELS)},
  "visible_issues": [up to 5 short strings describing visible defects or concerns],
  "recommended_works": [up to 5 short strings describing recommended refurbishment works],
  "ai_summary": "1–2 sentence professional assessment of the room/area",
  "confidence_score": number between 0 and 1 indicating your confidence in this analysis
}

Use UK spelling and terminology. Be concise. Return ONLY the JSON object — no markdown, no explanation.`;

function buildFallback(photo: ProjectPhoto): RoomAnalysis {
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseGptJson(text: string): any {
  const trimmed = text.trim();
  // Strip possible markdown code fences.
  const inner = trimmed.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(inner);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms),
    ),
  ]);
}

async function analysePhoto(apiKey: string, photo: ProjectPhoto): Promise<RoomAnalysis> {
  try {
    addDiagnosticBreadcrumb("ai:gpt4o:analyze:start", {
      photo: photo.name,
      size: photo.size,
      timeout: AI_ANALYSIS_TIMEOUT_MS,
    });

    const response = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 512,
          response_format: { type: "json_object" },
          messages: [
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
          ],
        }),
      }),
      AI_ANALYSIS_TIMEOUT_MS,
      `GPT-4o analysis for ${photo.name}`,
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Empty response from OpenAI");

    const parsed = parseGptJson(raw);

    addDiagnosticBreadcrumb("ai:gpt4o:analyze:success", {
      photo: photo.name,
      confidence: parsed.confidence_score,
    });

    return {
      id: photo.id,
      photo_url: photo.url,
      photo_name: photo.name,
      room_type: coerceRoomType(parsed.room_type),
      condition_level: coerceConditionLevel(parsed.condition_level),
      refurbishment_level: coerceRefurbLevel(parsed.refurbishment_level),
      visible_issues: coerceStringArray(parsed.visible_issues),
      recommended_works: coerceStringArray(parsed.recommended_works),
      ai_summary: typeof parsed.ai_summary === "string" ? parsed.ai_summary : "",
      confidence_score: coerceScore(parsed.confidence_score),
    };
  } catch (err) {
    let reason: "timeout" | "rate_limit" | "parse_error" | "api_error" = "api_error";
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (errorMsg.includes("Timeout")) {
      reason = "timeout";
    } else if (errorMsg.includes("rate_limit") || errorMsg.includes("429")) {
      reason = "rate_limit";
    } else if (errorMsg.includes("parse") || errorMsg.includes("JSON")) {
      reason = "parse_error";
    }

    logger.warn("[openAiVisionProvider] Failed to analyse photo", {
      photo: photo.name,
      reason,
      error: errorMsg,
    });

    captureAiError(err, {
      provider: "gpt-4o-vision",
      photoName: photo.name,
      reason,
    });

    addDiagnosticBreadcrumb("ai:gpt4o:analyze:fallback", {
      photo: photo.name,
      reason,
    });

    return buildFallback(photo);
  }
}

const cache = new Map<string, RoomAnalysis[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const openAiVisionPhotoAnalysisProvider: PhotoAnalysisProvider = {
  get(projectId) {
    return cache.get(projectId);
  },

  async run({ projectId }: PhotoAnalysisInput) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key not configured. Set VITE_OPENAI_API_KEY environment variable.",
      );
    }

    const photos = photoStore.list(projectId);
    if (photos.length === 0) {
      cache.set(projectId, []);
      notify();
      return [];
    }

    const startTime = Date.now();
    addDiagnosticBreadcrumb("ai:gpt4o:batch:start", {
      projectId,
      photoCount: photos.length,
      timeoutPerPhotoMs: AI_ANALYSIS_TIMEOUT_MS,
    });

    try {
      const results = await Promise.all(photos.map((photo) => analysePhoto(apiKey, photo)));

      const successCount = results.filter((r) => r.confidence_score > 0).length;
      const fallbackCount = results.filter((r) => r.confidence_score === 0).length;
      const durationMs = Date.now() - startTime;

      addDiagnosticBreadcrumb("ai:gpt4o:batch:complete", {
        projectId,
        photoCount: photos.length,
        successCount,
        fallbackCount,
        durationMs,
        avgPerPhotoMs: Math.round(durationMs / photos.length),
      });

      cache.set(projectId, results);
      notify();
      return results;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logger.error("[openAiVisionProvider] batch analysis failed", {
        projectId,
        photoCount: photos.length,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      });

      captureAiError(err, {
        provider: "gpt-4o-vision",
        projectId,
        photoCount: photos.length,
        reason: "api_error",
      });

      addDiagnosticBreadcrumb("ai:gpt4o:batch:error", {
        projectId,
        photoCount: photos.length,
        durationMs,
      });

      throw err;
    }
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
