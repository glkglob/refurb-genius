// Sentry integration for production error monitoring + AI/agent observability (safer defaults).
//
// - Server: @sentry/node (OpenAI client instrumentation, gen_ai spans).
// - Client: @sentry/react (errors + replay).
//
// Only initializes in production when VITE_SENTRY_DSN is present.
//
// Features:
// - streamGenAiSpans + instrumentOpenAiClient for LLM/agent monitoring.
// - setConversationId() for grouping related calls (e.g. per project).
//
// Privacy & cost conscious:
// - sendDefaultPii: false
// - AI input/output recording disabled by default (opt-in via SENTRY_AI_RECORD_DATA=true).
// - tracesSampleRate: 0.2 (adjust as needed).
//
// See openai-client.ts and .env.example for AI data capture controls.
// Build source maps via vite plugin. Never hardcode DSN.
import * as SentryReact from "@sentry/react";
import * as SentryNode from "@sentry/node";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isServer = typeof window === "undefined";

// Choose the appropriate Sentry SDK based on environment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sentry: any = isServer ? SentryNode : SentryReact;

if (import.meta.env.PROD && dsn) {
  const baseConfig = {
    dsn,
    environment: import.meta.env.MODE,
    // Balanced sampling for production (not 1.0 to control volume/cost).
    tracesSampleRate: 0.2,
    // Enables gen_ai.* spans for LLM/agent calls (works with our instrumented OpenAI client).
    streamGenAiSpans: true,
    // Privacy: do not send default PII (IP, etc.). AI data is controlled separately below.
    sendDefaultPii: false,
  };

  if (isServer) {
    SentryNode.init(baseConfig);
  } else {
    SentryReact.init({
      ...baseConfig,
      integrations: [SentryReact.browserTracingIntegration(), SentryReact.replayIntegration()],
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      tracePropagationTargets: ["localhost", /^https:\/\/.*\.refurbgenius\.info/],
    });
  }
}

// Lightweight AI/auth error helpers (used alongside richer ones below for compatibility).
export const captureAiError = (error: unknown, context?: Record<string, unknown>) => {
  Sentry.captureException(error, { tags: { type: "ai" }, ...context });
};

export const captureAuthError = (error: unknown) => {
  Sentry.captureException(error, { tags: { type: "auth" } });
};

// Existing detailed helpers (kept for compatibility with current call sites)
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureUploadError(
  error: unknown,
  metadata?: {
    projectId?: string;
    fileCount?: number;
    fileSizeMb?: number;
    stage?: "validation" | "storage" | "metadata" | "rollback";
  },
): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.captureException(error, {
    tags: { domain: "upload", stage: metadata?.stage ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

export function captureApiError(
  error: unknown,
  metadata?: {
    table?: string;
    operation?: "select" | "insert" | "update" | "delete";
    filter?: string;
    context?: string;
  },
): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.captureException(error, {
    tags: { domain: "api", operation: metadata?.operation ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

export function capturePdfError(
  error: unknown,
  metadata?: {
    filename?: string;
    stage?: "loading-libs" | "rendering-canvas" | "generating-pdf";
    durationMs?: number;
    memoryMbEstimate?: number;
  },
): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.captureException(error, {
    tags: { domain: "pdf", stage: metadata?.stage ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

export function captureImageDiagnostic(message: string, metadata?: Record<string, unknown>): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.addBreadcrumb({
    message: `[image] ${message}`,
    data: metadata,
    timestamp: Date.now() / 1000,
    level: "info",
  });
}

export function captureRouteLoadDiagnostic(
  routePath: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.addBreadcrumb({
    message: `[route] ${routePath}: ${message}`,
    data: metadata,
    timestamp: Date.now() / 1000,
    level: "info",
  });
}

export function addDiagnosticBreadcrumb(message: string, metadata?: Record<string, unknown>): void {
  if (!import.meta.env.PROD || !dsn) return;
  Sentry.addBreadcrumb({
    message,
    data: metadata,
    timestamp: Date.now() / 1000,
  });
}

export { Sentry };
export default Sentry;

/**
 * Set a conversation ID to group related LLM/agent calls (vision, scope, estimate, redesign)
 * into one thread in Sentry's AI monitoring dashboard.
 *
 * Call early in analysis flows (per projectId is ideal).
 *
 * To see full LLM prompts/responses in spans:
 *   Set SENTRY_AI_RECORD_DATA=true (server env var).
 * This keeps production data collection targeted and privacy-safe by default.
 */
export function setConversationId(id: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (Sentry as any).setConversationId === "function") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Sentry as any).setConversationId(id);
  }
}
