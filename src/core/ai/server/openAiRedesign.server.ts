import "@tanstack/react-start/server-only";

import type { RoomAnalysis } from "../mockAnalysis";
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "@/lib/redesign";
import { captureAiError, addDiagnosticBreadcrumb } from "@/lib/sentry";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/provider-diagnostics";
import { timeoutPromise, isTimeoutError } from "@/lib/timeout";
import { safeParseRedesignText } from "../validation";

const TEXT_GENERATION_TIMEOUT_MS = 30_000;

function staticFallback(style: RedesignStyle): RedesignConcept {
  return REDESIGN_CONCEPTS.find((c) => c.style === style) ?? REDESIGN_CONCEPTS[0];
}

function buildStaticConcepts(styles?: RedesignStyle[]): RedesignConcept[] {
  if (!styles?.length) return REDESIGN_CONCEPTS;
  const requested = new Set(styles);
  return REDESIGN_CONCEPTS.filter((concept) => requested.has(concept.style));
}

function buildAnalysisContext(analyses: RoomAnalysis[]): string {
  if (!analyses.length) return "No specific room analyses available.";
  return analyses
    .slice(0, 4)
    .map(
      (a) =>
        `${a.room_type}: condition=${a.condition_level}, refurb=${a.refurbishment_level}, issues=${a.visible_issues.slice(0, 2).join("; ")}`,
    )
    .join("\n");
}

const TEXT_SYSTEM_PROMPT = `You are a senior UK interior design consultant specialising in property refurbishment for investors and landlords (2026).
Given a property condition summary and requested design style, produce a practical, tenant/buyer-appealing redesign concept.
Think step-by-step about durability, light, flow and low maintenance for UK homes. Return ONLY a JSON object with these exact fields (no extra keys, no prose outside JSON):

{
  "tagline": "1 short punchy sentence (max 10 words) summarising the style direction",
  "palette": [
    { "name": "Colour name", "hex": "#RRGGBB" },
    { "name": "Colour name", "hex": "#RRGGBB" },
    { "name": "Colour name", "hex": "#RRGGBB" },
    { "name": "Colour name", "hex": "#RRGGBB" }
  ],
  "flooring": "One sentence: material, finish, why suitable (e.g. 'Engineered oak, brushed, durable for family rental')",
  "lighting": "One sentence: approach + fittings (e.g. 'Layered: recessed downlights + statement pendants over dining')",
  "furniture": "One sentence: key pieces and materials that elevate without high cost",
  "estimatedCostUplift": { "low": <int GBP>, "mid": <int GBP>, "high": <int GBP>, "note": "<short realistic reason vs standard refurb>" }
}

Uplift is the additional cost vs a standard modern refurb baseline for this property type (2026 UK residential). Be specific, professional, UK English. Return ONLY the JSON.`;

function parseGptJson(text: string): unknown {
  const trimmed = text.trim();
  const inner = trimmed.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(inner);
}

async function generateConceptText(
  apiKey: string,
  style: RedesignStyle,
  analyses: RoomAnalysis[],
): Promise<Omit<RedesignConcept, "style" | "afterGradient" | "afterImageUrl"> | null> {
  try {
    const context = buildAnalysisContext(analyses);

    const response = await timeoutPromise(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: TEXT_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Design style: ${style}\n\nProperty condition summary:\n${context}`,
            },
          ],
        }),
      }),
      TEXT_GENERATION_TIMEOUT_MS,
      `GPT-4o redesign concept for ${style}`,
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

    const parsed = parseGptJson(raw) as Record<string, unknown>;
    const fallback = staticFallback(style);

    // Phase 1: Zod validation for redesign text fields
    const zodText = safeParseRedesignText(parsed);

    incrementCounter("redesign_success");

    return {
      tagline:
        zodText?.tagline ??
        (typeof parsed.tagline === "string" ? parsed.tagline : fallback.tagline),
      palette:
        zodText?.palette && zodText.palette.length > 0
          ? zodText.palette
          : Array.isArray(parsed.palette) && parsed.palette.length > 0
            ? (parsed.palette as RedesignConcept["palette"])
            : fallback.palette,
      flooring:
        zodText?.flooring ??
        (typeof parsed.flooring === "string" ? parsed.flooring : fallback.flooring),
      lighting:
        zodText?.lighting ??
        (typeof parsed.lighting === "string" ? parsed.lighting : fallback.lighting),
      furniture:
        zodText?.furniture ??
        (typeof parsed.furniture === "string" ? parsed.furniture : fallback.furniture),
      estimatedCostUplift: (parsed as Record<string, unknown>).estimatedCostUplift
        ? (() => {
            const u = (parsed as Record<string, unknown>).estimatedCostUplift as Record<
              string,
              unknown
            >;
            return {
              low: Math.max(0, Math.round(Number(u.low) || 0)),
              mid: Math.max(0, Math.round(Number(u.mid) || Number(u.low) || 0)),
              high: Math.max(0, Math.round(Number(u.high) || Number(u.mid) || 0)),
              note: typeof u.note === "string" ? u.note : undefined,
            };
          })()
        : fallback.estimatedCostUplift,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (isTimeoutError(err)) {
      incrementCounter("redesign_timeout");
    } else if (errorMsg.includes("parse") || errorMsg.includes("JSON")) {
      incrementCounter("redesign_parse_failure");
    }

    incrementCounter("redesign_fallback_used");

    logger.warn("[ai-server] GPT-4o redesign generation failed", {
      style,
      error: errorMsg,
    });

    captureAiError(err, {
      provider: "gpt-4o-text",
      reason: isTimeoutError(err) ? "timeout" : "api_error",
    });

    return null;
  }
}

export async function runSecureRedesignGeneration(input: {
  projectId: string;
  styles?: RedesignStyle[];
  analyses?: RoomAnalysis[];
}): Promise<RedesignConcept[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const styles = input.styles?.length ? input.styles : [...REDESIGN_STYLES];
  const analyses = input.analyses ?? [];

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("OPENAI_API_KEY is not configured");
      captureAiError(err, { provider: "gpt-4o-text", reason: "api_error" });
      throw err;
    }
    incrementCounter("redesign_fallback_used");
    return buildStaticConcepts(styles);
  }

  addDiagnosticBreadcrumb("ai:gpt4o:redesign:batch:start", {
    projectId: input.projectId,
    styleCount: styles.length,
  });

  const concepts = await Promise.all(
    styles.map(async (style): Promise<RedesignConcept> => {
      const fallback = staticFallback(style);
      const textFields = await generateConceptText(apiKey, style, analyses);

      return {
        style,
        afterGradient: fallback.afterGradient,
        ...(textFields || {
          tagline: fallback.tagline,
          palette: fallback.palette,
          flooring: fallback.flooring,
          lighting: fallback.lighting,
          furniture: fallback.furniture,
        }),
      };
    }),
  );

  addDiagnosticBreadcrumb("ai:gpt4o:redesign:batch:complete", {
    projectId: input.projectId,
    styleCount: styles.length,
    conceptCount: concepts.length,
  });

  return concepts;
}
