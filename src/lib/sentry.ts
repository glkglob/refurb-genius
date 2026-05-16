// Minimal Sentry integration for production runtime error monitoring.
//
// Initialises only when:
//   - Running in the browser (not SSR)
//   - VITE_SENTRY_DSN is set
//   - import.meta.env.PROD is true (production build)
//
// No performance tracing. No session replay. Minimal footprint.
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
