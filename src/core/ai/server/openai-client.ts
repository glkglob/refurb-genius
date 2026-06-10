/**
 * Backward compatibility shim — OpenAI client lives in the platform layer.
 * TODO(feature-slice): remove when all callers import from @/platform/openai/server.
 */
export { getOpenAIClient, type OpenAI } from "@/platform/openai/server";
