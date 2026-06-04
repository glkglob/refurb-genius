// Sentry integration for Refurb Genius
// Client-side only - privacy safe configuration
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (import.meta.env.PROD && dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    sendDefaultPii: false, // Privacy safe - do not change without review
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/.*\.refurbgenius\.info/,
    ],
  });
}

// Helper functions
export const captureAiError = (error: unknown, context?: Record<string, unknown>) => {
  Sentry.captureException(error, { tags: { type: 'ai' }, ...context });
};

export const captureAuthError = (error: unknown) => {
  Sentry.captureException(error, { tags: { type: 'auth' } });
};

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

export function setConversationId(id: string): void {
  if (typeof (Sentry as any).setConversationId === 'function') {
    (Sentry as any).setConversationId(id);
  }
}

export { Sentry };
export default Sentry;
