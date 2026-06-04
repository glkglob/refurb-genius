import OpenAI from "openai";
import * as Sentry from "@sentry/node";

/**
 * Returns an instrumented OpenAI client with Sentry AI/agent monitoring enabled.
 * This creates rich gen_ai.* spans automatically for LLM calls (model, tokens, etc.).
 *
 * By default, full prompt/response content is NOT recorded (privacy).
 * Set SENTRY_AI_RECORD_DATA=true (server env) to capture inputs/outputs for AI debugging.
 *
 * Uses the official openai package + Sentry.instrumentOpenAiClient.
 */
let instrumentedClient: OpenAI | null = null;

export function getOpenAIClient(apiKey: string): OpenAI {
  if (!instrumentedClient) {
    instrumentedClient = new OpenAI({
      apiKey,
      // timeout and other options can be set here if needed
    });

    // Enable Sentry's automatic instrumentation for OpenAI calls (agent monitoring).
    // recordInputs/Outputs control whether full prompt/response data is sent.
    // Default to false for privacy (sensitive property details, financials, images).
    // Set SENTRY_AI_RECORD_DATA=true in env to enable for debugging AI behavior.
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
