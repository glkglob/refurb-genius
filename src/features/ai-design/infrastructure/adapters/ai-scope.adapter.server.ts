/**
 * AI-design slice — OpenAI scope analysis adapter (server-only).
 * Moved from `src/core/ai/server/openAiScopeAnalysis.server.ts` (now a shim).
 */
import "@tanstack/react-start/server-only";

import type {
  ScopeAnalysisInput,
  ScopeAnalysisResult,
  ScopeIssue,
  ScopeRecommendedItem,
  ScopeRoom,
} from "../../domain";
import { buildMockScopeResult } from "../../domain/scopeMockData";
import { safeParseScopeResult } from "../../domain/validation";
import { captureAiError, addDiagnosticBreadcrumb, setConversationId } from "@/lib/sentry";
import { getOpenAIClient } from "@/platform/openai/server";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/provider-diagnostics";
import { timeoutPromise, isTimeoutError } from "@/lib/timeout";
import { withRetry } from "@/core/ai/platform/retry";

// ──────────────────────────────────────────────────────────────
// Validation / coercion
// ──────────────────────────────────────────────────────────────

const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const VALID_CATEGORIES = new Set(["materials", "labour", "both", "fees"]);

function coerceSeverity(v: unknown): ScopeIssue["severity"] {
  if (typeof v === "string" && VALID_SEVERITIES.has(v)) return v as ScopeIssue["severity"];
  return "medium";
}

function coerceCategory(v: unknown): ScopeRecommendedItem["category"] {
  if (typeof v === "string" && VALID_CATEGORIES.has(v))
    return v as ScopeRecommendedItem["category"];
  return "both";
}

function coerceNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function coerceString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function coerceIssue(raw: Record<string, unknown>): ScopeIssue {
  return {
    category: coerceString(raw.category, "General"),
    description: coerceString(raw.description, "Issue detected"),
    severity: coerceSeverity(raw.severity),
    recommended_action: coerceString(raw.recommended_action, "Inspect and address"),
  };
}

function coerceRecommendedItem(raw: Record<string, unknown>): ScopeRecommendedItem | null {
  const name = coerceString(raw.name, "");
  if (!name) return null;
  const baseCost = coerceNumber(raw.base_unit_cost, 0);
  if (baseCost <= 0) return null;

  return {
    name,
    category: coerceCategory(raw.category),
    quantity: coerceNumber(raw.quantity, 1),
    unit: coerceString(raw.unit, "item"),
    base_unit_cost: baseCost,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

function coerceRoom(raw: Record<string, unknown>): ScopeRoom | null {
  const room = coerceString(raw.room, "");
  if (!room) return null;

  const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];
  const issues = rawIssues
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map(coerceIssue);

  const rawItems = Array.isArray(raw.recommended_items) ? raw.recommended_items : [];
  const recommended_items = rawItems
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map(coerceRecommendedItem)
    .filter((i): i is ScopeRecommendedItem => i !== null);

  return {
    room,
    area_sqm: typeof raw.area_sqm === "number" && raw.area_sqm > 0 ? raw.area_sqm : undefined,
    condition_summary: coerceString(raw.condition_summary, "Condition not assessed"),
    issues,
    recommended_items,
  };
}

function coerceResult(parsed: unknown): ScopeAnalysisResult {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Response is not an object");
  }
  const obj = parsed as Record<string, unknown>;

  const rawRooms = Array.isArray(obj.rooms) ? obj.rooms : [];
  const rooms = rawRooms
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map(coerceRoom)
    .filter((r): r is ScopeRoom => r !== null);

  if (rooms.length === 0) {
    throw new Error("AI returned zero valid rooms");
  }

  const score = coerceNumber(obj.overall_score, 5);

  return {
    overall_score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)),
    summary: coerceString(obj.summary, "Property analysis complete."),
    rooms,
  };
}

// ──────────────────────────────────────────────────────────────
// Prompt
// ──────────────────────────────────────────────────────────────

function buildSystemPrompt(input: ScopeAnalysisInput): string {
  const roomList = input.roomTags.length > 0 ? input.roomTags.join(", ") : "All visible rooms";

  return `You are a senior UK property surveyor and refurbishment cost consultant with 20+ years experience (2026 pricing, RICS-aligned).

Property details:
- Type: ${input.propertyType}
- Bedrooms: ${input.bedrooms}
- Bathrooms: ${input.bathrooms ?? "not specified"}
- Region: ${input.region} (output BASE costs for East Midlands / national average — the app will apply the regional multiplier)
- Rooms to focus on: ${roomList}
- Additional notes / prior vision: ${input.notes || "None"}

Analyse the property photos and produce a professional, realistic condition assessment + costed scope of works.

Step-by-step (think internally, do not output reasoning):
1. Only describe issues clearly visible in the supplied photos.
2. For each room, list 1–6 specific issues with accurate severity.
3. Recommend 3–10 practical line items per room (or whole-property for electrics/plumbing/heating). Use realistic 2026 UK costs (e.g. mid-range kitchen 6–12k, bathroom 4–9k, new consumer unit ~£650–900, etc.). Prefer metric quantities.
4. Separate materials vs labour where sensible. Include a small number of "fees" (architect, building control) only if structural changes implied.
5. Give an overall_score 1–10 (10 = move-in ready modern condition).

Rules (strict):
- Be practical, conservative and professional. No fantasy or upsell items.
- Real 2026 trade prices (base, pre-VAT, pre-regional uplift).
- Severity: low=cosmetic, medium=functional/dated, high=needs prompt repair, critical=safety or structural.
- Output ONLY the exact JSON object below. No markdown, no extra text, no explanations.

{
  "overall_score": <number 1-10>,
  "summary": "<1-2 sentence professional overview>",
  "rooms": [{
    "room": "<room name>",
    "area_sqm": <number or null>,
    "condition_summary": "<one sentence>",
    "issues": [{
      "category": "Damp|Electrical|Plumbing|Structural|Cosmetic|Heating|Roof|Other",
      "description": "<concise visible observation>",
      "severity": "low|medium|high|critical",
      "recommended_action": "<clear next step>"
    }],
    "recommended_items": [{
      "name": "<specific work/material e.g. 'Replace 3-bed mid-range kitchen units & worktops supply & fit'>",
      "category": "materials|labour|both|fees",
      "quantity": <number>,
      "unit": "sqm|lm|item|each|set|room|nr",
      "base_unit_cost": <GBP number>,
      "notes": "<optional e.g. 'soft-close, 18mm MFC'>"
    }]
  }]
}`;
}

// ──────────────────────────────────────────────────────────────
// OpenAI call
// ──────────────────────────────────────────────────────────────

const SCOPE_ANALYSIS_TIMEOUT_MS = 90_000; // Vision with multiple photos can be slow

function parseGptJson(text: string): unknown {
  const trimmed = text.trim();
  const inner = trimmed.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(inner);
}

export async function runSecureScopeAnalysis(
  input: ScopeAnalysisInput,
): Promise<ScopeAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("OPENAI_API_KEY is not configured");
      captureAiError(err, { provider: "gpt-4o-vision", reason: "api_error" });
      throw err;
    }
    incrementCounter("scope_fallback_used");
    return buildMockScopeResult(input);
  }

  // Group vision + scope + estimate calls for the same project under one conversation
  if (input.projectId) {
    setConversationId(`project-${input.projectId}`);
  }

  if (input.photos.length === 0) {
    incrementCounter("scope_fallback_used");
    return buildMockScopeResult(input);
  }

  const systemPrompt = buildSystemPrompt(input);

  addDiagnosticBreadcrumb("ai:gpt4o:scope:start", {
    projectId: input.projectId,
    photoCount: input.photos.length,
    roomTags: input.roomTags,
    timeout: SCOPE_ANALYSIS_TIMEOUT_MS,
  });

  try {
    // Build multi-image content array
    const userContent: Array<
      | { type: "image_url"; image_url: { url: string; detail: "low" } }
      | { type: "text"; text: string }
    > = [];

    for (const photo of input.photos.slice(0, 10)) {
      userContent.push({
        type: "image_url",
        image_url: { url: photo.url, detail: "low" },
      });
    }

    userContent.push({
      type: "text",
      text: `Analyse these ${input.photos.length} property photos and produce the scope analysis. Photos are named: ${input.photos.map((p) => p.name).join(", ")}.`,
    });

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
              { role: "user", content: userContent },
            ],
          }),
          SCOPE_ANALYSIS_TIMEOUT_MS,
          "GPT-4o scope analysis",
        ),
      { maxAttempts: 2, baseDelayMs: 500 },
      "scope-analysis",
    );

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Empty response from OpenAI");

    const parsed: unknown = parseGptJson(raw);

    // Phase 1: prefer Zod schema validation (stronger than manual coerce alone)
    const zodResult = safeParseScopeResult(parsed);
    const result = zodResult ?? coerceResult(parsed);

    incrementCounter("scope_ai_success");

    addDiagnosticBreadcrumb("ai:gpt4o:scope:success", {
      roomCount: result.rooms.length,
      issueCount: result.rooms.reduce((s, r) => s + r.issues.length, 0),
      itemCount: result.rooms.reduce((s, r) => s + r.recommended_items.length, 0),
      overallScore: result.overall_score,
    });

    return result;
  } catch (err) {
    let reason: "timeout" | "rate_limit" | "parse_error" | "api_error" = "api_error";
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (isTimeoutError(err)) {
      reason = "timeout";
      incrementCounter("scope_timeout");
    } else if (errorMsg.includes("rate_limit") || errorMsg.includes("429")) {
      reason = "rate_limit";
      incrementCounter("scope_rate_limit");
    } else if (errorMsg.includes("parse") || errorMsg.includes("JSON")) {
      reason = "parse_error";
      incrementCounter("scope_parse_failure");
    }

    incrementCounter("scope_fallback_used");

    logger.warn("[ai-server] Scope analysis failed, using fallback", {
      reason,
      error: errorMsg,
      photoCount: input.photos.length,
    });

    captureAiError(err, {
      provider: "gpt-4o-vision",
      projectId: input.projectId,
      photoCount: input.photos.length,
      reason,
    });

    addDiagnosticBreadcrumb("ai:gpt4o:scope:fallback", { reason });

    return buildMockScopeResult(input);
  }
}
