/**
 * Sentry integration for Refurb Genius (browser SDK via @sentry/react).
 *
 * Ownership (PH-SENTRY-1A):
 * - Sentry: engineering exception diagnosis — stack traces, releases, source maps.
 * - PostHog: product analytics / behavioural context. PostHog may also
 *   autocapture browser exceptions (`capture_exceptions`) independently; that
 *   stream is intentional product telemetry and is not managed here.
 *
 * Server: this module is the shared capture surface used from some server
 * adapters. There is no full Node/Nitro Sentry.init in this slice — unconfigured
 * or non-production calls are safe no-ops via canCapture().
 *
 * Privacy: sendDefaultPii must remain false. Privacy beforeSend (PH-SENTRY-1C)
 * is implemented via sanitizeSentryEvent from the platform sanitizer.
 *
 * Replay (PH-SENTRY-1D1 / 1D1-R1): explicit mask/block/network privacy options;
 * capture required auth-callback query secrets then strip them from location
 * before init so Replay setInitialState cannot observe OAuth/magic-link query
 * secrets, while the one-shot bootstrap bridge supplies complete().
 */
import * as Sentry from "@sentry/react";

import {
  buildExplicitReplayPrivacyOptions,
  prepareAuthCallbackLocationForReplay,
} from "@/platform/sentry/replay-privacy";
import { sanitizeSentryEvent } from "@/platform/sentry/sanitize-outbound";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** Test override — null means use production + DSN env gate. */
let captureEnabledOverride: boolean | null = null;

/**
 * Pure gate for whether a Sentry capture helper may emit.
 * Production environment AND a non-empty DSN are required.
 */
export function isSentryCaptureEnabled(
  prod: boolean,
  sentryDsn: string | undefined | null,
): boolean {
  return Boolean(prod && sentryDsn && String(sentryDsn).trim().length > 0);
}

/**
 * Canonical capture decision for all public helpers in this module.
 * When false, helpers must be safe no-ops (no throw, no network).
 */
function canCapture(): boolean {
  if (captureEnabledOverride !== null) {
    return captureEnabledOverride;
  }
  return isSentryCaptureEnabled(import.meta.env.PROD, dsn);
}

/** Test helper — force capture gate (does not init/teardown the SDK). */
export function __setSentryCaptureEnabledForTests(value: boolean | null): void {
  captureEnabledOverride = value;
}

// PH-SENTRY-1D1-R1: capture then strip auth-callback query secrets before
// Sentry.init so Replay setInitialState sees a clean query string. Hash is
// preserved for Supabase detectSessionInUrl. Route consumes the one-shot
// snapshot when Route.useSearch() no longer has code/token_hash.
if (typeof window !== "undefined") {
  prepareAuthCallbackLocationForReplay();
}

if (import.meta.env.PROD && dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      // PH-SENTRY-1D1: pin Replay privacy (do not rely on implicit SDK defaults)
      Sentry.replayIntegration(buildExplicitReplayPrivacyOptions()),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    sendDefaultPii: false, // Privacy safe - do not change without review
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.refurbgenius\.info/],
    // PH-SENTRY-1C: fail-closed outbound scrubbing (never emit unsanitized events)
    // Note: beforeSend does NOT scrub Replay recording payloads (1D audit).
    beforeSend: (event) => sanitizeSentryEvent(event) as typeof event | null,
  });
}

// Helper functions
export const captureAiError = (error: unknown, context?: Record<string, unknown>) => {
  if (!canCapture()) return;
  Sentry.captureException(error, { tags: { type: "ai" }, ...context });
};

export const captureAuthError = (error: unknown) => {
  if (!canCapture()) return;
  Sentry.captureException(error, { tags: { type: "auth" } });
};

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!canCapture()) return;
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
  if (!canCapture()) return;
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
  if (!canCapture()) return;
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
  if (!canCapture()) return;
  Sentry.captureException(error, {
    tags: { domain: "pdf", stage: metadata?.stage ?? "unknown" },
    extra: { ...metadata, timestamp: new Date().toISOString() },
  });
}

export function captureImageDiagnostic(message: string, metadata?: Record<string, unknown>): void {
  if (!canCapture()) return;
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
  if (!canCapture()) return;
  Sentry.addBreadcrumb({
    message: `[route] ${routePath}: ${message}`,
    data: metadata,
    timestamp: Date.now() / 1000,
    level: "info",
  });
}

export function addDiagnosticBreadcrumb(message: string, metadata?: Record<string, unknown>): void {
  if (!canCapture()) return;
  Sentry.addBreadcrumb({
    message,
    data: metadata,
    timestamp: Date.now() / 1000,
  });
}

type SentryWithConversationId = typeof Sentry & {
  setConversationId?: (id: string) => void;
};

export function setConversationId(id: string): void {
  if (!canCapture()) return;
  const sentryWithConversationId = Sentry as SentryWithConversationId;

  if (typeof sentryWithConversationId.setConversationId === "function") {
    sentryWithConversationId.setConversationId(id);
  }
}

export { Sentry };
export default Sentry;
