/**
 * Deal Copilot — OpenAI chat adapter (server-only).
 *
 * Reach this only via dynamic `import()` inside a `createServerFn` handler
 * (see `src/serverFns/dealChat.ts`). Uses gpt-4o in conversation mode with
 * opportunity context injected as the system prompt.
 *
 * OpenAI streaming is used internally for faster time-to-first-token on the
 * server side. The complete response is accumulated and returned — TanStack
 * serverFns don't support HTTP streaming to the client.
 *
 * Chat financial fields are user-provided context, not deterministic-engine
 * output: purchasePrice is a user-provided financial input; estimatedGdv is a
 * user-provided estimate; userRefurbBudgetAssumption is a user-provided
 * underwriting assumption. userRefurbBudgetAssumption is never
 * pricing.mid_total and never deterministic-engine output.
 */
import "@tanstack/react-start/server-only";

import { getOpenAIClient } from "@/platform/openai/server";
import { logger } from "@/lib/logger";
import { captureAiError, addDiagnosticBreadcrumb } from "@/platform/sentry/server-capture";
import { timeoutPromise } from "@/lib/timeout";

const CHAT_TIMEOUT_MS = 45_000;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DealChatContext = {
  opportunityTitle: string;
  opportunityStatus: string;
  postcode?: string;
  propertyType?: string;
  bedrooms?: number;
  purchasePrice?: number;
  estimatedGdv?: number;
  /** User-provided underwriting assumption. NEVER treat as pricing.mid_total. */
  userRefurbBudgetAssumption?: number;
};

function formatGbp(n: number | undefined): string {
  return n != null ? `£${n.toLocaleString("en-GB")}` : "not provided";
}

export function buildSystemPrompt(ctx: DealChatContext): string {
  const lines = [
    "You are Deal Copilot, a conservative UK property investment assistant embedded in Refurb Genius.",
    "You help investors think through refurbishment opportunities — risks, scope, market reality, next steps.",
    "",
    "Opportunity facts (user-recorded metadata — not deterministic engine output):",
    `  Title: ${ctx.opportunityTitle}`,
    `  Status: ${ctx.opportunityStatus}`,
    `  Postcode: ${ctx.postcode ?? "not provided"}`,
    `  Property type: ${ctx.propertyType ?? "not provided"}`,
    `  Bedrooms: ${ctx.bedrooms ?? "not provided"}`,
    "",
    "User-provided financial context:",
    `  Purchase price (user-provided financial input): ${formatGbp(ctx.purchasePrice)}`,
    `  Estimated GDV (user-provided estimate): ${formatGbp(ctx.estimatedGdv)}`,
    `  Refurb budget (user-provided underwriting assumption): ${formatGbp(ctx.userRefurbBudgetAssumption)}`,
    "",
    "These user-provided values are context, not deterministic-engine outputs.",
    "Deterministic pricing and ROI results are not present in this chat context. Do not invent them.",
    "",
    "Rules:",
    "- Be concise. 2-4 sentences per response unless asked for more.",
    "- You remain advisory.",
    "- You may discuss, challenge, or stress-test user-provided assumptions and estimates, and identify risks.",
    "- Do not relabel user-provided inputs, estimates, or assumptions as deterministic engine outputs.",
    "- Do not present a substitute refurb cost, ROI, or GDV as system or engine authority.",
    "- Do not represent the user's refurb budget assumption as pricing.mid_total.",
    "- Flag risks, recommend next steps, and reason about UK market realities.",
    "- If you reference comparable values or yields, be explicit that they are estimates.",
    "- Decline off-topic requests politely and stay focused on this deal.",
  ];
  return lines.join("\n");
}

/** Dev/offline fallback. */
function buildMockReply(userMessage: string, ctx: DealChatContext): string {
  return (
    `[Offline] I don't have an OpenAI API key configured, so I can't give you a live answer about "${ctx.opportunityTitle}". ` +
    `You asked: "${userMessage.slice(0, 80)}${userMessage.length > 80 ? "…" : ""}". ` +
    "Set OPENAI_API_KEY to enable real AI responses."
  );
}

export async function runDealChat(
  userMessage: string,
  history: ChatMessage[],
  ctx: DealChatContext,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("OPENAI_API_KEY is not configured");
      captureAiError(err, { provider: "gpt-4o-deal-chat", reason: "api_error" });
      throw err;
    }
    return buildMockReply(userMessage, ctx);
  }

  addDiagnosticBreadcrumb("ai:gpt4o:deal-chat:start", {
    historyLength: history.length,
    opportunityStatus: ctx.opportunityStatus,
  });

  try {
    const openai = getOpenAIClient(apiKey);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildSystemPrompt(ctx) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    let fullText = "";
    const stream = await timeoutPromise(
      openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 800,
        temperature: 0.4,
        stream: true,
        messages,
      }),
      CHAT_TIMEOUT_MS,
      "GPT-4o deal chat",
    );

    for await (const chunk of stream) {
      fullText += chunk.choices[0]?.delta?.content ?? "";
    }

    if (!fullText.trim()) throw new Error("Empty response from OpenAI");

    addDiagnosticBreadcrumb("ai:gpt4o:deal-chat:success", { chars: fullText.length });
    return fullText;
  } catch (err) {
    logger.error("[deal-chat] generation failed", { error: String(err) });
    captureAiError(err, { provider: "gpt-4o-deal-chat", reason: "api_error" });
    throw err;
  }
}
