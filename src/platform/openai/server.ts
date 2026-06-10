/**
 * Platform boundary — OpenAI (server-only).
 *
 * There is intentionally no browser entry for this vendor: the SDK and API key
 * must never reach the client bundle. Import this module only from
 * `*.server.ts` files or via dynamic `import()` inside `createServerFn`
 * handlers.
 */
export { getOpenAIClient } from "@/core/ai/server/openai-client";
