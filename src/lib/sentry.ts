// Sentry integration for production runtime error monitoring with contextual helpers.
//
// Initialises only when:
//   - Running in the browser (not SSR)
//   - VITE_SENTRY_DSN is set
//   - import.meta.env.PROD is true (production build)
//
// No performance tracing. No session replay. Minimal footprint.
// Provides categorized error capture for different failure domains.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Guard: browser + DSN present + production build.
const enabled = Boolean(dsn && import.meta.env.PROD && typeof window !== "undefined");

if (enabled) {
  Sentry.init({
    dsn,
    // Default integrations capture unhandled exceptions, unhandled promise
    // rejections (globalHandlersIntegration) and browser API errors.
    tracesSampleRate: 0, // no performance tracing
    // No replayIntegration added — session replay is disabled.
  });
}

/**
 * Report an exception to Sentry. Safe to call unconditionally — no-op when
 * Sentry is not initialised (dev, missing DSN, or SSR context).
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Capture auth-related failures (login, signup, session hydration, token refresh).
 * Provides consistent categorization for auth debugging.
 */
export function captureAuthError(
  error: unknown,
  action: "login" | "signup" | "google_signin" | "session_check" | "token_refresh" | "logout",
  metadata?: Record<string, unknown>,
): void {
  if (!enabled) return;
  Sentry.captureException(error, {
    tags: { domain: "auth", action },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

/**
 * Capture upload-related failures (file upload, metadata insertion, storage).
 * Includes file metrics for debugging.
 */
export function captureUploadError(
  error: unknown,
  metadata?: {
    projectId?: string;
    fileCount?: number;
    fileSizeMb?: number;
    stage?: "validation" | "storage" | "metadata" | "rollback";
  },
): void {
  if (!enabled) return;
  Sentry.captureException(error, {
    tags: { domain: "upload", stage: metadata?.stage ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

/**
 * Capture AI provider failures (OpenAI Vision, redesign concepts, image analysis).
 * Tracks which photos failed and why.
 */
export function captureAiError(
  error: unknown,
  metadata?: {
    provider?: "gpt-4o-vision" | "dall-e" | "gpt-4o-text" | "mock";
    projectId?: string;
    photoCount?: number;
    photoName?: string;
    reason?: "timeout" | "rate_limit" | "parse_error" | "api_error";
  },
): void {
  if (!enabled) return;
  Sentry.captureException(error, {
    tags: { domain: "ai", provider: metadata?.provider ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

/**
 * Capture API/data failures (Supabase queries, photo fetches, project loads).
 * Provides table name and operation type for debugging.
 */
export function captureApiError(
  error: unknown,
  metadata?: {
    table?: string;
    operation?: "select" | "insert" | "update" | "delete";
    filter?: string;
    context?: string;
  },
): void {
  if (!enabled) return;
  Sentry.captureException(error, {
    tags: { domain: "api", operation: metadata?.operation ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

/**
 * Add a breadcrumb for context tracking (progress events, user actions, etc).
 * Helps trace the path to failures without cluttering error reports.
 */
export function addDiagnosticBreadcrumb(message: string, metadata?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.addBreadcrumb({
    message,
    data: metadata,
    timestamp: Date.now() / 1000,
  });
}
