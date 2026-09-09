/**
 * Deal Copilot — OpenAI deal-analysis adapter (server-only).
 *
 * Reach this only via dynamic `import()` inside a `createServerFn` handler
 * (see `src/serverFns/dealAnalysis.ts`). Mirrors the estimate adapter pattern:
 * OpenAI gpt-4o + `response_format: json_object` + Zod validation, with a dev
 * fallback when no API key is configured.
 *
 * Analysis financial fields are user-provided context, not deterministic-engine
 * output: purchasePrice is a user-provided financial input; estimatedGdv is a
 * user-provided estimate; userRefurbBudgetAssumption is a user-provided
 * underwriting assumption; expectedMonthlyRent is a user-provided rental /
 * underwriting estimate. userRefurbBudgetAssumption is never
 * pricing.mid_total and never deterministic-engine output.
 * Deterministic pricing and ROI results are not present in this analysis
 * context.
 */
import "@tanstack/react-start/server-only";

import { getOpenAIClient } from "@/platform/openai/server";
import { logger } from "@/lib/logger";
import {
  captureAiError,
  addDiagnosticBreadcrumb,
  setConversationId,
} from "@/platform/sentry/server-capture";
import { timeoutPromise } from "@/lib/timeout";
import { dealAnalysisSchema, type DealAnalysis } from "../dealAnalysis";

const ANALYSIS_TIMEOUT_MS = 45_000;

export type DealAnalysisContext = {
  title: string;
  status: string;
  postcode?: string;
  propertyType?: string;
  bedrooms?: number;
  purchasePrice?: number;
  estimatedGdv?: number;
  /** User-provided underwriting assumption. NEVER treat as pricing.mid_total. */
  userRefurbBudgetAssumption?: number;
  expectedMonthlyRent?: number;
  targetExitStrategy?: string;
  promptContext?: string;
};

function formatGbp(n: number | undefined): string {
  return typeof n === "number" ? `£${n.toLocaleString("en-GB")}` : "not provided";
}

export function buildSystemPrompt(): string {
  return [
    "You are a conservative UK property refurbishment underwriting analyst.",
    "You will be given user-recorded opportunity context and user-provided financial context.",
    "Those values are user-provided context, not deterministic-engine outputs.",
    "Deterministic pricing and ROI results are not present in this analysis context. Do not invent them.",
    "",
    "You remain advisory.",
    "You may discuss, challenge, or stress-test user-provided assumptions and estimates, identify risk,",
    "and offer clearly labelled independent estimates in aiOpinion.",
    "Do not relabel user-provided values as deterministic-engine outputs.",
    "Do not represent the user's refurb budget assumption as pricing.mid_total.",
    "Do not present AI-generated refurb cost, ROI, or GDV as deterministic or system authority.",
    "",
    "Return a single JSON object with exactly these keys:",
    '- "valuationSummary": a concise paragraph (2-4 sentences) on how the deal stacks up,',
    "  grounded in the provided figures and UK market realities.",
    '- "riskFlags": an array of { "severity": "high"|"medium"|"low", "description": string,',
    '  "mitigation"?: string }. Cover refurb cost overrun, exit/market, financing, and survey risk',
    "  where relevant. Empty array if genuinely none.",
    '- "nextSteps": an array of short, actionable strings (e.g. "Commission a Level 2 survey").',
    '- "comps"?: optional array of { "address": string, "note"?: string } only if you can name',
    "  plausible comparable types for the area; otherwise omit. Never fabricate specific sold prices.",
    '- "aiOpinion"?: optional object with your OWN independent estimate, clearly understood as a',
    "  non-authoritative second opinion — not pricing, ROI, or system authority, and not a replacement",
    "  for the user's figures. Include only fields you can justify:",
    '    { "estimatedValue"?: number (GBP), "refurbCost"?: number (GBP),',
    '      "projectedRoiPercent"?: number, "rationale"?: short string }.',
    "  Omit the whole object if you have no independent basis. Be conservative; do not anchor blindly",
    "  to the user's numbers.",
    "",
    "Be precise, UK-market realistic, and conservative on costs. Output JSON only.",
  ].join("\n");
}

export function buildUserPrompt(ctx: DealAnalysisContext): string {
  const lines = [
    "Opportunity facts (user-recorded context / metadata):",
    `  Title: ${ctx.title}`,
    `  Status: ${ctx.status}`,
    `  Postcode: ${ctx.postcode ?? "not provided"}`,
    `  Property type: ${ctx.propertyType ?? "not provided"}`,
    `  Bedrooms: ${ctx.bedrooms ?? "not provided"}`,
    `  Target exit strategy: ${ctx.targetExitStrategy ?? "not provided"}`,
    "",
    "User-provided financial context:",
    `  Purchase price (user-provided financial input): ${formatGbp(ctx.purchasePrice)}`,
    `  Estimated GDV (user-provided estimate): ${formatGbp(ctx.estimatedGdv)}`,
    `  Refurb budget (user-provided underwriting assumption): ${formatGbp(ctx.userRefurbBudgetAssumption)}`,
    `  Expected monthly rent (user-provided rental / underwriting estimate): ${formatGbp(ctx.expectedMonthlyRent)}`,
    "",
    "These are user-provided context, not deterministic pricing or ROI results.",
  ];
  if (ctx.promptContext?.trim()) {
    lines.push("", `Additional context from the user: ${ctx.promptContext.trim()}`);
  }
  lines.push("", "Analyse this deal now and return the JSON object.");
  return lines.join("\n");
}

/** Deterministic dev/offline fallback so the UI is exercisable without a key. */
function buildMockAnalysis(ctx: DealAnalysisContext): DealAnalysis {
  const spread =
    typeof ctx.estimatedGdv === "number" &&
    typeof ctx.purchasePrice === "number" &&
    typeof ctx.userRefurbBudgetAssumption === "number"
      ? ctx.estimatedGdv - ctx.purchasePrice - ctx.userRefurbBudgetAssumption
      : undefined;
  return {
    valuationSummary:
      `Offline analysis for "${ctx.title}". ` +
      (typeof spread === "number"
        ? `Gross spread after purchase and refurb is ${formatGbp(spread)} before fees and finance.`
        : "Add purchase, GDV and refurb figures for a sharper read.") +
      " (Set OPENAI_API_KEY for a live AI analysis.)",
    riskFlags: [
      {
        severity: "medium",
        description: "Refurb budget may understate UK contingency for unknowns.",
        mitigation: "Hold a 10-15% contingency and confirm scope with photos.",
      },
    ],
    nextSteps: [
      "Verify comparable GDV against recent local sales.",
      "Commission a survey appropriate to the property age.",
    ],
    aiOpinion:
      typeof ctx.estimatedGdv === "number"
        ? {
            estimatedValue: Math.round(ctx.estimatedGdv * 0.97),
            rationale: "Offline placeholder: 3% haircut on the provided GDV. Set OPENAI_API_KEY.",
          }
        : undefined,
  };
}

export async function runDealAnalysis(ctx: DealAnalysisContext): Promise<DealAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("OPENAI_API_KEY is not configured");
      captureAiError(err, { provider: "gpt-4o-deal-analysis", reason: "api_error" });
      throw err;
    }
    return buildMockAnalysis(ctx);
  }

  // Opaque technical id only — never include postcode/address (PH-SENTRY-1B1)
  setConversationId(`deal-analysis-${ctx.status}`);
  addDiagnosticBreadcrumb("ai:gpt4o:deal-analysis:start", {
    status: ctx.status,
    hasPostcode: Boolean(ctx.postcode),
  });

  try {
    const openai = getOpenAIClient(apiKey);
    const completion = await timeoutPromise(
      openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(ctx) },
        ],
      }),
      ANALYSIS_TIMEOUT_MS,
      "GPT-4o deal analysis",
    );

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Empty response from OpenAI");

    const parsed = dealAnalysisSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logger.error("[deal-analysis] schema validation failed", {
        issueCount: parsed.error.issues.length,
      });
      throw new Error("AI returned an unexpected shape for the deal analysis.");
    }

    addDiagnosticBreadcrumb("ai:gpt4o:deal-analysis:success", {
      riskCount: parsed.data.riskFlags.length,
    });
    return parsed.data;
  } catch (err) {
    logger.error("[deal-analysis] generation failed", { error: String(err) });
    captureAiError(err, { provider: "gpt-4o-deal-analysis", reason: "api_error" });
    throw err;
  }
}
