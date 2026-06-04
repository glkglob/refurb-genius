import "@tanstack/react-start/server-only";

import { captureAiError, addDiagnosticBreadcrumb, setConversationId } from "@/lib/sentry";
import { getOpenAIClient } from "./openai-client";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/provider-diagnostics";
import { timeoutPromise, isTimeoutError } from "@/lib/timeout";
import { getRegionalMultiplier } from "@repo/services";
import { aiEstimateResponseSchema, safeParseEstimate } from "../validation";
import { withRetry } from "../platform/retry";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface GenerateEstimateInput {
  propertyType: string;
  bedrooms: number;
  bathrooms?: number;
  region: string;
  postcode?: string;
  condition: string;
  requirements: string;
  sizeSqm?: number;
}

export interface AIGeneratedRoom {
  name: string;
  area_sqm?: number;
  items: AIGeneratedItem[];
}

export interface AIGeneratedItem {
  name: string;
  category: "materials" | "labour" | "both" | "fees";
  quantity: number;
  unit: string;
  base_unit_cost: number;
  notes?: string;
}

// ──────────────────────────────────────────────────────────────
// Validation / coercion
// ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(["materials", "labour", "both", "fees"]);

function coerceCategory(v: unknown): AIGeneratedItem["category"] {
  if (typeof v === "string" && VALID_CATEGORIES.has(v)) {
    return v as AIGeneratedItem["category"];
  }
  return "both";
}

function coerceNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function coerceRoom(raw: Record<string, unknown>): AIGeneratedRoom | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: AIGeneratedItem[] = rawItems
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "Unnamed item",
      category: coerceCategory(item.category),
      quantity: coerceNumber(item.quantity, 1),
      unit: typeof item.unit === "string" ? item.unit : "item",
      base_unit_cost: coerceNumber(item.base_unit_cost, 0),
      notes: typeof item.notes === "string" ? item.notes : undefined,
    }))
    .filter((item) => item.base_unit_cost > 0);

  if (items.length === 0) return null;

  return {
    name,
    area_sqm: typeof raw.area_sqm === "number" && raw.area_sqm > 0 ? raw.area_sqm : undefined,
    items,
  };
}

// ──────────────────────────────────────────────────────────────
// Prompt
// ──────────────────────────────────────────────────────────────

function buildSystemPrompt(input: GenerateEstimateInput): string {
  const multiplier = getRegionalMultiplier(input.region);
  const sizeHint = input.sizeSqm ? `${input.sizeSqm}m²` : "not specified";

  return `You are a senior UK quantity surveyor with 20+ years experience in residential refurbishments (2026 pricing, RICS aligned).

Property details:
- Type: ${input.propertyType}
- Bedrooms: ${input.bedrooms}
- Bathrooms: ${input.bathrooms ?? "not specified"}
- Size: ${sizeHint}
- Region: ${input.region} (output BASE costs only for East Midlands/national average — the calling app applies ×${multiplier} regional uplift)
- Condition: ${input.condition}
- Specific requirements / scope hints: ${input.requirements || "Standard good quality modern refurb for UK buy-to-let or owner-occupier"}

Step-by-step (internal):
1. Break into logical rooms + "Whole Property" for M&E.
2. List 20–45 practical line items total for a typical property. Be specific (e.g. "18mm MFC kitchen units soft-close supply & fit" not "kitchen").
3. Use realistic 2026 base unit costs (kitchen 7–11k all-in mid, bathroom 5–8.5k, rewire 2–3 bed £3.2–4.8k, etc.). Include both materials and labour.
4. Quantities realistic (e.g. 5.5 lm worktop, 12 m² tiling). Add small contingency items only if condition warrants.
5. fees category only for design/building control where major structural implied.

Rules (strict):
- Practical, no gold-plating or invented rooms.
- 2026 UK trade prices, pre-VAT, pre-regional.
- Output ONLY valid JSON exactly: { "rooms": [ { "name": "...", "area_sqm"?: number, "items": [ { "name": string, "category": "materials"|"labour"|"both"|"fees", "quantity": number, "unit": string, "base_unit_cost": number, "notes"?: string } ] } ] }
- No markdown, no extra keys, no prose.

Return ONLY the JSON object.`;
}

// ──────────────────────────────────────────────────────────────
// Mock fallback
// ──────────────────────────────────────────────────────────────

function buildMockRooms(input: GenerateEstimateInput): AIGeneratedRoom[] {
  const rooms: AIGeneratedRoom[] = [
    {
      name: "Kitchen",
      area_sqm: 12,
      items: [
        {
          name: "Kitchen units supply & fit",
          category: "both",
          quantity: 1,
          unit: "kitchen",
          base_unit_cost: 8500,
          notes: "Mid-range units with soft close",
        },
        {
          name: "Worktops (laminate)",
          category: "materials",
          quantity: 4,
          unit: "lm",
          base_unit_cost: 120,
        },
        {
          name: "Tiling splashback",
          category: "both",
          quantity: 6,
          unit: "sqm",
          base_unit_cost: 65,
        },
        {
          name: "Plumbing first fix",
          category: "labour",
          quantity: 1,
          unit: "item",
          base_unit_cost: 850,
        },
        {
          name: "Electrical first fix",
          category: "labour",
          quantity: 1,
          unit: "item",
          base_unit_cost: 650,
        },
      ],
    },
    {
      name: "Bathroom",
      area_sqm: 5,
      items: [
        {
          name: "Bathroom suite (bath, basin, WC)",
          category: "materials",
          quantity: 1,
          unit: "suite",
          base_unit_cost: 1200,
        },
        {
          name: "Bathroom fit-out labour",
          category: "labour",
          quantity: 1,
          unit: "item",
          base_unit_cost: 2800,
        },
        {
          name: "Wall & floor tiling",
          category: "both",
          quantity: 14,
          unit: "sqm",
          base_unit_cost: 75,
        },
      ],
    },
  ];

  // Add bedrooms
  for (let i = 1; i <= Math.min(input.bedrooms, 5); i++) {
    rooms.push({
      name: `Bedroom ${i}`,
      items: [
        {
          name: "Decoration (walls & ceiling)",
          category: "both",
          quantity: 1,
          unit: "room",
          base_unit_cost: 650,
        },
        { name: "Flooring (LVT)", category: "both", quantity: 12, unit: "sqm", base_unit_cost: 45 },
      ],
    });
  }

  rooms.push({
    name: "Whole Property",
    items: [
      { name: "Full rewire", category: "labour", quantity: 1, unit: "item", base_unit_cost: 4200 },
      {
        name: "Consumer unit upgrade",
        category: "both",
        quantity: 1,
        unit: "item",
        base_unit_cost: 650,
      },
      {
        name: "Combi boiler replacement",
        category: "both",
        quantity: 1,
        unit: "item",
        base_unit_cost: 3200,
      },
      {
        name: "Radiators (supply & fit)",
        category: "both",
        quantity: 8,
        unit: "each",
        base_unit_cost: 280,
      },
      {
        name: "Skip hire & waste disposal",
        category: "fees",
        quantity: 2,
        unit: "skip",
        base_unit_cost: 350,
      },
    ],
  });

  return rooms;
}

// ──────────────────────────────────────────────────────────────
// OpenAI call
// ──────────────────────────────────────────────────────────────

const ESTIMATE_TIMEOUT_MS = 45_000;

function parseGptJson(text: string): unknown {
  const trimmed = text.trim();
  const inner = trimmed.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(inner);
}

export async function runSecureEstimateGeneration(
  input: GenerateEstimateInput,
): Promise<AIGeneratedRoom[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("OPENAI_API_KEY is not configured");
      captureAiError(err, { provider: "gpt-4o-estimate", reason: "api_error" });
      throw err;
    }
    incrementCounter("estimate_fallback_used");
    return buildMockRooms(input);
  }

  const systemPrompt = buildSystemPrompt(input);

  // Group this estimate + related AI calls under one conversation for Sentry agent monitoring
  setConversationId(`estimate-${input.region}-${input.bedrooms}beds-${input.condition}`);

  addDiagnosticBreadcrumb("ai:gpt4o:estimate:start", {
    region: input.region,
    propertyType: input.propertyType,
    bedrooms: input.bedrooms,
    timeout: ESTIMATE_TIMEOUT_MS,
  });

  try {
    const openai = getOpenAIClient(apiKey);

    const completion = await withRetry(
      async () =>
        timeoutPromise(
          openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 4096,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content:
                  'Generate the refurbishment estimate now. Return the JSON array inside a top-level { "rooms": [...] } wrapper.',
              },
            ],
          }),
          ESTIMATE_TIMEOUT_MS,
          "GPT-4o estimate generation",
        ),
      { maxAttempts: 2, baseDelayMs: 400 },
      "estimate-generation",
    );

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Empty response from OpenAI");

    const parsed: unknown = parseGptJson(raw);

    // Phase 1: Zod first for structured reliability
    const zodEst = safeParseEstimate(parsed);
    let rooms: AIGeneratedRoom[] = [];
    if (zodEst) {
      rooms = zodEst.rooms
        .map((r) => ({
          name: r.name,
          area_sqm: r.area_sqm,
          items: r.items.map((it) => ({
            name: it.name,
            category: it.category,
            quantity: it.quantity,
            unit: it.unit,
            base_unit_cost: it.base_unit_cost,
            notes: it.notes,
          })),
        }))
        .filter((r) => Array.isArray(r.items) && r.items.length > 0) as AIGeneratedRoom[];
    } else {
      // Accept { rooms: [...] } or a raw array (legacy path)
      const rawRooms = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" &&
            parsed !== null &&
            "rooms" in parsed &&
            Array.isArray((parsed as Record<string, unknown>).rooms)
          ? ((parsed as Record<string, unknown>).rooms as unknown[])
          : null;
      if (rawRooms) {
        rooms = rawRooms
          .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
          .map(coerceRoom)
          .filter((r): r is AIGeneratedRoom => r !== null);
      }
    }

    if (rooms.length === 0) {
      throw new Error("AI returned zero valid rooms — falling back to mock");
    }

    incrementCounter("estimate_ai_success");

    addDiagnosticBreadcrumb("ai:gpt4o:estimate:success", {
      roomCount: rooms.length,
      itemCount: rooms.reduce((s, r) => s + r.items.length, 0),
    });

    return rooms;
  } catch (err) {
    let reason: "timeout" | "rate_limit" | "parse_error" | "api_error" = "api_error";
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (isTimeoutError(err)) {
      reason = "timeout";
      incrementCounter("estimate_timeout");
    } else if (errorMsg.includes("rate_limit") || errorMsg.includes("429")) {
      reason = "rate_limit";
      incrementCounter("estimate_rate_limit");
    } else if (errorMsg.includes("parse") || errorMsg.includes("JSON")) {
      reason = "parse_error";
      incrementCounter("estimate_parse_failure");
    }

    incrementCounter("estimate_fallback_used");

    logger.warn("[ai-server] Estimate generation failed, using fallback", {
      reason,
      error: errorMsg,
    });

    captureAiError(err, {
      provider: "gpt-4o-estimate",
      reason,
    });

    addDiagnosticBreadcrumb("ai:gpt4o:estimate:fallback", { reason });

    return buildMockRooms(input);
  }
}
