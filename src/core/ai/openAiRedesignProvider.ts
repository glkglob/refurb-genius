// Real OpenAI redesign provider.
//
// Phase 1 — GPT-4o: generates property-specific concept text (tagline,
// palette, flooring, lighting, furniture) for each requested style using
// the cached room analyses as context.
//
// Phase 2 — DALL-E 3: generates an actual "after" render image per concept.
// Falls back to the static afterGradient if image generation fails.
//
// AI only touches language and visuals. Pricing and ROI stay in their engines.
import OpenAI from "openai";
import { analysisStore } from "@/lib/analysis";
import type { RoomAnalysis } from "@/lib/analysis";
import { REDESIGN_CONCEPTS, REDESIGN_STYLES } from "@/lib/redesign";
import type { RedesignConcept, RedesignStyle } from "@/lib/redesign";
import type { RedesignInput, RedesignProvider } from "./redesignConcepts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });
}

function staticFallback(style: RedesignStyle): RedesignConcept {
  return REDESIGN_CONCEPTS.find((c) => c.style === style) ?? REDESIGN_CONCEPTS[0];
}

function buildAnalysisContext(analyses: RoomAnalysis[]): string {
  if (!analyses.length) return "No specific room analyses available.";
  return analyses
    .slice(0, 4) // limit tokens
    .map(
      (a) =>
        `${a.room_type}: condition=${a.condition_level}, refurb=${a.refurbishment_level}, issues=${a.visible_issues.slice(0, 2).join("; ")}`,
    )
    .join("\n");
}

// ─── GPT-4o text generation ─────────────────────────────────────────────────

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

async function generateConceptText(
  client: OpenAI,
  style: RedesignStyle,
  analyses: RoomAnalysis[],
): Promise<Omit<RedesignConcept, "style" | "afterGradient" | "afterImageUrl">> {
  const context = buildAnalysisContext(analyses);
  const response = await client.chat.completions.create({
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
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  const fallback = staticFallback(style);
  return {
    tagline: typeof parsed.tagline === "string" ? parsed.tagline : fallback.tagline,
    palette: Array.isArray(parsed.palette) ? parsed.palette : fallback.palette,
    flooring: typeof parsed.flooring === "string" ? parsed.flooring : fallback.flooring,
    lighting: typeof parsed.lighting === "string" ? parsed.lighting : fallback.lighting,
    furniture: typeof parsed.furniture === "string" ? parsed.furniture : fallback.furniture,
  };
}

// ─── DALL-E 3 image generation ───────────────────────────────────────────────

function buildImagePrompt(
  style: RedesignStyle,
  concept: Omit<RedesignConcept, "style" | "afterGradient" | "afterImageUrl">,
): string {
  const colors = concept.palette.map((p) => p.name).join(", ");
  return (
    `Photorealistic interior design render of a UK residential property room refurbished in ${style} style. ` +
    `Colour palette: ${colors}. Flooring: ${concept.flooring} Lighting: ${concept.lighting} ` +
    `Furniture: ${concept.furniture} ` +
    `Magazine-quality architectural visualisation. Clean, aspirational, no people. Natural daylight.`
  );
}

async function generateConceptImage(
  client: OpenAI,
  style: RedesignStyle,
  concept: Omit<RedesignConcept, "style" | "afterGradient" | "afterImageUrl">,
): Promise<string | undefined> {
  try {
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: buildImagePrompt(style, concept),
      n: 1,
      size: "1024x1792",
      quality: "standard",
    });
    return response.data?.[0]?.url;
  } catch (err) {
    console.warn("[openAiRedesignProvider] DALL-E image failed for", style, err);
    return undefined;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

const cache = new Map<string, RedesignConcept[]>();

async function buildConcepts(input: RedesignInput): Promise<RedesignConcept[]> {
  const client = getClient();
  const styles: RedesignStyle[] = input.styles?.length ? input.styles : [...REDESIGN_STYLES];

  const analyses = analysisStore.get(input.projectId) ?? [];

  const concepts = await Promise.all(
    styles.map(async (style): Promise<RedesignConcept> => {
      const fallback = staticFallback(style);

      let textFields: Omit<RedesignConcept, "style" | "afterGradient" | "afterImageUrl">;

      try {
        textFields = await generateConceptText(client, style, analyses);
      } catch (err) {
        console.warn("[openAiRedesignProvider] GPT-4o text failed for", style, err);
        textFields = {
          tagline: fallback.tagline,
          palette: fallback.palette,
          flooring: fallback.flooring,
          lighting: fallback.lighting,
          furniture: fallback.furniture,
        };
      }

      const afterImageUrl = await generateConceptImage(client, style, textFields);

      return {
        style,
        afterGradient: fallback.afterGradient,
        afterImageUrl,
        ...textFields,
      };
    }),
  );

  cache.set(input.projectId, concepts);
  return concepts;
}

export const openAiRedesignProvider: RedesignProvider = {
  list(input = {} as RedesignInput) {
    const cached = cache.get(input.projectId ?? "");
    if (cached) {
      const styles = input.styles?.length ? new Set(input.styles) : null;
      return styles ? cached.filter((c) => styles.has(c.style)) : cached;
    }
    // Fall through to static while async generate is pending.
    const fallbackProvider = {
      list: (i?: RedesignInput) => {
        if (!i?.styles?.length) return REDESIGN_CONCEPTS;
        const s = new Set(i.styles);
        return REDESIGN_CONCEPTS.filter((c) => s.has(c.style));
      },
    };
    return fallbackProvider.list(input);
  },

  async generate(input) {
    const cached = cache.get(input.projectId);
    if (cached) return cached;
    return buildConcepts(input);
  },
};
