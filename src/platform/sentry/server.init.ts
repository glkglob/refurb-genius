/**
 * PH-SENTRY-1B1 — Node/server Sentry initialization (server-only).
 *
 * Ownership:
 * - Browser init remains in src/lib/sentry.ts (@sentry/react).
 * - This module owns @sentry/node init only.
 * - Pure privacy helpers live in sanitize-outbound / sanitize-server.
 *
 * Gate: production runtime AND non-empty process.env.SENTRY_DSN.
 * Preview / development / test: disabled (safe no-op).
 * Tracing: intentionally off (tracesSampleRate left unset so hasSpansEnabled is false).
 * AI content recording: not enabled here (adapters use SENTRY_AI_RECORD_DATA default false).
 */
import "@tanstack/react-start/server-only";

import * as Sentry from "@sentry/node";

import { sanitizeServerSentryEvent } from "@/platform/sentry/sanitize-server";
import { logger } from "@/lib/logger";

/** Test override — null means use env gate. */
let captureEnabledOverride: boolean | null = null;

let initAttempted = false;
let initSucceeded = false;

export type ServerSentryEnv = {
  nodeEnv?: string | null;
  vercelEnv?: string | null;
  sentryDsn?: string | null;
};

/**
 * Production server runtime for Sentry capture.
 *
 * Vercel sets NODE_ENV=production for both production and preview deploys;
 * VERCEL_ENV distinguishes them. Preview and development must stay off.
 */
export function isServerSentryProductionRuntime(env: ServerSentryEnv): boolean {
  const vercelEnv = env.vercelEnv?.trim() || undefined;
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return false;
  }
  if (vercelEnv === "production") {
    return true;
  }
  // Non-Vercel (local prod-like / generic Node): NODE_ENV only
  return env.nodeEnv === "production";
}

/**
 * Pure gate: production server runtime AND non-empty SENTRY_DSN.
 */
export function isServerSentryCaptureEnabled(env: ServerSentryEnv): boolean {
  const dsn = env.sentryDsn;
  if (!dsn || String(dsn).trim().length === 0) {
    return false;
  }
  return isServerSentryProductionRuntime(env);
}

function readRuntimeEnv(): ServerSentryEnv {
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    sentryDsn: process.env.SENTRY_DSN,
  };
}

/**
 * Canonical capture decision for server helpers.
 * When false, capture helpers must be safe no-ops.
 */
export function canServerSentryCapture(): boolean {
  if (captureEnabledOverride !== null) {
    return captureEnabledOverride;
  }
  return isServerSentryCaptureEnabled(readRuntimeEnv());
}

/** Test helper — force capture gate (does not init/teardown the SDK). */
export function __setServerSentryCaptureEnabledForTests(value: boolean | null): void {
  captureEnabledOverride = value;
}

/** Test helper — reset init bookkeeping between tests. */
export function __resetServerSentryInitForTests(): void {
  initAttempted = false;
  initSucceeded = false;
  captureEnabledOverride = null;
}

export function isServerSentryInitialized(): boolean {
  return initSucceeded;
}

/**
 * Initialize @sentry/node once when the production+DSN gate passes.
 * Never throws: init failure is logged as a static message and left disabled.
 */
export function initServerSentry(): void {
  if (initAttempted) {
    return;
  }
  initAttempted = true;

  try {
    const env = readRuntimeEnv();
    if (!isServerSentryCaptureEnabled(env)) {
      return;
    }

    const dsn = String(env.sentryDsn).trim();

    Sentry.init({
      dsn,
      environment: env.vercelEnv || env.nodeEnv || "production",
      // Privacy: never send default PII (IP, cookies, etc.)
      sendDefaultPii: false,
      // Do not include local variables on stack frames
      includeLocalVariables: false,
      // Tracing intentionally unset: hasSpansEnabled requires tracesSampleRate != null
      // or tracesSampler; leaving both undefined keeps auto performance integrations off.
      // Do NOT set tracesSampleRate: 0 — that still enables hasSpansEnabled.
      // Defence-in-depth request attachment policy (beforeSend still strips).
      integrations: [
        Sentry.requestDataIntegration({
          include: {
            cookies: false,
            data: false,
            headers: false,
            ip: false,
            query_string: false,
            url: true,
          },
        }),
      ],
      // Fail-closed server privacy boundary
      beforeSend: (event) => {
        try {
          const sanitized = sanitizeServerSentryEvent(event);
          if (sanitized == null) {
            return null;
          }
          return sanitized as unknown as typeof event;
        } catch {
          // Never return the raw event
          try {
            logger.error("Sentry server event sanitizer failed; event dropped");
          } catch {
            // ignore logging failures
          }
          return null;
        }
      },
    });

    initSucceeded = true;
  } catch {
    initSucceeded = false;
    try {
      logger.error("Sentry server init failed; capture disabled");
    } catch {
      // ignore
    }
  }
}

// Side-effect bootstrap when this module is imported first from src/server.ts
// (ESM evaluates all imports before any non-import statements in the importer).
initServerSentry();
