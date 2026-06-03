// Minimal retry + backoff for AI calls (transient errors only).
// Use for parse failures on first attempt, timeouts, 5xx.
// Do NOT retry on 429/rate limit (let caller backoff or fallback).
// Do NOT retry on auth or permanent client errors.

import { isTimeoutError } from "@/lib/timeout";
import { logger } from "@/lib/logger";

export type RetryOptions = {
  maxAttempts?: number; // default 2 (original + 1 retry)
  baseDelayMs?: number; // 400
  maxDelayMs?: number; // 2000
  shouldRetry?: (err: unknown, attempt: number) => boolean;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  opName = "ai-op",
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  const baseDelay = options.baseDelayMs ?? 400;
  const maxDelay = options.maxDelayMs ?? 2000;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);

      const willRetry =
        options.shouldRetry?.(err, attempt) ??
        (isTimeoutError(err) ||
          msg.includes("parse") ||
          msg.includes("JSON") ||
          msg.includes("Empty response") ||
          /5\d\d/.test(msg));

      if (!willRetry || attempt === maxAttempts) {
        throw err;
      }

      const delay = Math.min(baseDelay * Math.pow(1.6, attempt - 1), maxDelay);
      logger.warn(`[ai-retry] ${opName} attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: msg,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // Should not reach
  throw lastErr;
}

export function classifyError(
  err: unknown,
): "timeout" | "rate_limit" | "parse_error" | "api_error" | "other" {
  const msg = err instanceof Error ? err.message : String(err);
  if (isTimeoutError(err)) return "timeout";
  if (msg.includes("rate_limit") || msg.includes("429")) return "rate_limit";
  if (msg.includes("parse") || msg.includes("JSON") || msg.includes("Empty response"))
    return "parse_error";
  if (msg.includes("OpenAI API error")) return "api_error";
  return "other";
}
