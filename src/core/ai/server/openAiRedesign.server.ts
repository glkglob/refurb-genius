import "@tanstack/react-start/server-only";

import type { RoomAnalysis } from "../mockAnalysis";
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "@/lib/redesign";
import { captureAiError, addDiagnosticBreadcrumb } from "@/lib/sentry";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/provider-diagnostics";

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

const TEXT_SYSTEM_PROMPT = `You are a senior UK interior design consultant specialising in property refurbishment for investors.
Given a property condition summary and a design style, produce a tailored redesign concept.
Return ONLY a JSON object with these exact fields:
{
  "tagline": "1 short punchy sentence (max 10 words) summarising the style direction",
  "palette": [
    { "name": "Colour name", "hex": "#RRGGBB" },
    { "name": "Colour name", "hex": "#RRGGBB" },
    { "name": "Colour name", "hex": "#RRGGBB" },
    { "name": "Colour name", "hex": "#RRGGBB" }
  ],
  "flooring": "One sentence specifying flooring material, finish and notes",
  "lighting": "One sentence specifying lighting approach and fittings",
  "furniture": "One sentence specifying key furniture pieces and materials"
}
Use UK English. Be specific and professional. Return ONLY the JSON.`;

function parseGptJson(text: string): unknown {
  const trimmed = text.trim();
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

async function generateConceptText(
  apiKey: string,
  style: RedesignStyle,
  analyses: RoomAnalysis[],
): Promise<Omit<RedesignConcept, "style" | "afterGradient" | "afterImageUrl"> | null> {
  try {
    const context = buildAnalysisContext(analyses);

    const response = await withTimeout(
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

    incrementCounter("redesign_success");

    return {
      tagline: typeof parsed.tagline === "string" ? parsed.tagline : fallback.tagline,
      palette:
        Array.isArray(parsed.palette) && parsed.palette.length > 0
          ? (parsed.palette as RedesignConcept["palette"])
          : fallback.palette,
      flooring: typeof parsed.flooring === "string" ? parsed.flooring : fallback.flooring,
      lighting: typeof parsed.lighting === "string" ? parsed.lighting : fallback.lighting,
      furniture: typeof parsed.furniture === "string" ? parsed.furniture : fallback.furniture,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (errorMsg.includes("Timeout")) {
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
      reason: errorMsg.includes("Timeout") ? "timeout" : "api_error",
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
