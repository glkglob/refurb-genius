/**
 * AI provider configuration and safety checks
 */

export function isOpenAiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
}

export function getOpenAiApiKey(): string | undefined {
  return import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
}
