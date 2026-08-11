/**
 * PH-SENTRY-1B1 — server-only Sentry capture helpers.
 *
 * Server AI adapters and Nitro entry use this module instead of @/lib/sentry
 * (browser-owned @sentry/react). Safe no-ops when server Sentry is disabled.
 */
import "@tanstack/react-start/server-only";

import * as Sentry from "@sentry/node";

import {
  canServerSentryCapture,
  initServerSentry,
  isServerSentryInitialized,
} from "@/platform/sentry/server.init";

/**
 * Ensure init has been attempted when capture is gated on.
 * Idempotent; safe if bootstrap already ran from src/server.ts.
 */
function ensureInit(): boolean {
  if (!canServerSentryCapture()) {
    return false;
  }
  if (!isServerSentryInitialized()) {
    initServerSentry();
  }
  return canServerSentryCapture() && isServerSentryInitialized();
}

/** Low-risk server exception capture (outer fetch / SSR catastrophic paths). */
export function captureServerException(
  error: unknown,
  metadata?: { source?: string; [key: string]: unknown },
): void {
  if (!ensureInit()) return;

  const source = metadata && typeof metadata.source === "string" ? metadata.source : "server";

  // Only allow low-risk scalar metadata through as tags/extra
  const safeExtra: Record<string, unknown> = { source };
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      if (k === "source") continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        // Skip obvious secret-shaped keys; full sanitizer still runs in beforeSend
        const lk = k.toLowerCase();
        if (
          lk.includes("authorization") ||
          lk.includes("cookie") ||
          lk.includes("token") ||
          lk.includes("secret") ||
          lk.includes("password") ||
          lk.includes("prompt") ||
          lk.includes("body")
        ) {
          continue;
        }
        safeExtra[k] = v;
      }
    }
  }

  Sentry.captureException(error, {
    tags: { domain: "server", source },
    extra: safeExtra,
  });
}

/**
 * AI adapter error capture — mirrors browser captureAiError tags shape
 * without importing @sentry/react.
 */
export function captureAiError(error: unknown, context?: Record<string, unknown>): void {
  if (!ensureInit()) return;

  const tags: Record<string, string> = { type: "ai" };
  const extra: Record<string, unknown> = {};

  if (context) {
    for (const [k, v] of Object.entries(context)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        const lk = k.toLowerCase();
        if (
          lk.includes("prompt") ||
          lk.includes("completion") ||
          lk.includes("message") ||
          lk.includes("authorization") ||
          lk.includes("cookie") ||
          lk.includes("token") ||
          lk.includes("secret") ||
          lk.includes("password") ||
          lk.includes("body") ||
          lk.includes("address") ||
          lk.includes("postcode") ||
          lk.includes("purchase")
        ) {
          continue;
        }
        if (k === "provider" || k === "reason") {
          tags[k] = String(v);
        } else {
          extra[k] = v;
        }
      }
    }
  }

  Sentry.captureException(error, {
    tags,
    extra: Object.keys(extra).length > 0 ? extra : undefined,
  });
}

/** Diagnostic breadcrumbs for AI adapters (gated). */
export function addDiagnosticBreadcrumb(message: string, metadata?: Record<string, unknown>): void {
  if (!ensureInit()) return;

  const data: Record<string, unknown> | undefined = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([k, v]) => {
          if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
            return false;
          }
          const lk = k.toLowerCase();
          if (
            lk.includes("prompt") ||
            lk.includes("completion") ||
            lk.includes("authorization") ||
            lk.includes("cookie") ||
            lk.includes("token") ||
            lk.includes("secret") ||
            lk.includes("password") ||
            lk.includes("body") ||
            lk.includes("address") ||
            lk.includes("postcode")
          ) {
            return false;
          }
          return true;
        }),
      )
    : undefined;

  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Opaque technical conversation id for AI correlation.
 * Callers must not pass email, address, postcode, or freeform user text.
 */
export function setConversationId(id: string): void {
  if (!ensureInit()) return;
  if (typeof id !== "string" || id.trim().length === 0) return;
  // Hard cap + reject obvious email-shaped values
  if (id.includes("@") || id.length > 200) return;
  Sentry.setConversationId(id);
}
