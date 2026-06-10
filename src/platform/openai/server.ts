/**
 * Platform boundary — OpenAI (server-only).
 *
 * There is intentionally no browser entry for this vendor: the SDK and API key
 * must never reach the client bundle. Import this module only from
 * `*.server.ts` files or via dynamic `import()` inside `createServerFn`
 * handlers.
 */
import OpenAI from "openai";
import * as Sentry from "@sentry/node";

export type { OpenAI };

/**
 * Returns an instrumented OpenAI client with Sentry AI/agent monitoring enabled.
 * This creates rich gen_ai.* spans automatically for LLM calls (model, tokens, etc.).
 *
 * By default, full prompt/response content is NOT recorded (privacy).
 * Set SENTRY_AI_RECORD_DATA=true (server env) to capture inputs/outputs for AI debugging.
 */
let instrumentedClient: OpenAI | null = null;

export function getOpenAIClient(apiKey: string): OpenAI {
  if (!instrumentedClient) {
    instrumentedClient = new OpenAI({
      apiKey,
    });

    const recordAiData = process.env.SENTRY_AI_RECORD_DATA === "true";
    if (typeof Sentry.instrumentOpenAiClient === "function") {
      Sentry.instrumentOpenAiClient(instrumentedClient, {
        recordInputs: recordAiData,
        recordOutputs: recordAiData,
      });
    }
  }

  // Note: if different apiKeys are used, this simple singleton may need adjustment.
  // For this app we use a single key.
  return instrumentedClient;
}
