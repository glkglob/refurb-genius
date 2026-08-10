/**
 * PH-SENTRY-1E1 — browser Sentry tracing / span privacy boundary.
 *
 * Pure module: no Sentry.init, no browser globals, no React, no network.
 * Wired from src/lib/sentry.ts via beforeSendTransaction / beforeSendSpan.
 *
 * Separates tracing privacy from PH-SENTRY-1C error-event sanitisation
 * (beforeSend) while reusing shared URL/path primitives.
 *
 * Fail-closed:
 * - transaction sanitizer throws → null (drop transaction)
 * - span sanitizer throws / unexpected input → safe fallback span
 *   (never the original raw span; beforeSendSpan cannot drop via null)
 *
 * Immutable: never mutates SDK-owned input objects.
 */
import {
  SENTRY_REDACTED,
  sanitizeSentryPathname,
  sanitizeSentryUrl,
  scrubFreeformString,
} from "@/platform/sentry/sanitize-outbound";

// ---------------------------------------------------------------------------
// Structural shapes matching installed @sentry/core 10.53.1
// SpanJSON / TransactionEvent — no runtime @sentry/* import.
// ---------------------------------------------------------------------------

/** Span attribute values as emitted on SpanJSON.data (installed SpanAttributes). */
export type SentrySpanAttributeValue =
  | string
  | number
  | boolean
  | Array<null | undefined | string>
  | Array<null | undefined | number>
  | Array<null | undefined | boolean>
  | undefined;

/**
 * Minimal SpanJSON-compatible shape for beforeSendSpan (static lifecycle).
 * Matches installed `SpanJSON`: `data`, `description`, `op`, ids, timestamps.
 */
export type SentrySpanJsonLike = {
  data: Record<string, SentrySpanAttributeValue>;
  description?: string;
  op?: string;
  parent_span_id?: string;
  span_id: string;
  start_timestamp: number;
  status?: string;
  timestamp?: number;
  trace_id: string;
  origin?: string;
  profile_id?: string;
  exclusive_time?: number;
  measurements?: Record<string, unknown>;
  is_segment?: boolean;
  segment_id?: string;
  links?: unknown[];
  [key: string]: unknown;
};

/**
 * Transaction event shape for beforeSendTransaction.
 * Matches installed `TransactionEvent` (Event & { type: 'transaction' }).
 */
export type SentryTransactionEventLike = {
  type: "transaction";
  transaction?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
    [key: string]: unknown;
  };
  spans?: SentrySpanJsonLike[];
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  user?: Record<string, unknown>;
  breadcrumbs?: unknown[];
  measurements?: Record<string, unknown>;
  transaction_info?: { source?: string; [key: string]: unknown };
  event_id?: string;
  level?: string;
  platform?: string;
  release?: string;
  environment?: string;
  dist?: string;
  sdk?: unknown;
  start_timestamp?: number;
  timestamp?: number;
  fingerprint?: string[];
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Attribute key sets — proven/emitted by installed browserTracing + fetch
// ---------------------------------------------------------------------------

/** Standalone query/fragment attrs: remove (do not preserve raw values). */
const QUERY_FRAGMENT_ATTR_KEYS = new Set([
  "http.query",
  "url.query",
  "http.fragment",
  "url.fragment",
]);

/** Full URL-like attribute keys → sanitizeSentryUrl. */
const URL_ATTR_KEYS = new Set(["http.url", "url", "url.full", "lcp.url"]);

/** Path-like attribute keys → sanitizeSentryPathname. */
const PATH_ATTR_KEYS = new Set(["http.path", "url.path", "pathname"]);

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "CONNECT",
  "TRACE",
]);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPathLikeName(value: string): boolean {
  const t = value.trim();
  return t.startsWith("/") || /^https?:\/\//i.test(t);
}

/**
 * Sanitize a span description / transaction name when clearly URL or path-like.
 * Preserves HTTP method prefixes (e.g. "GET https://host/path").
 */
export function sanitizeSpanDescription(description: string): string {
  if (!description) return description;

  const trimmed = description.trim();
  const methodMatch = /^([A-Za-z]+)\s+(.+)$/.exec(trimmed);
  if (methodMatch) {
    const method = methodMatch[1] ?? "";
    const rest = methodMatch[2] ?? "";
    if (HTTP_METHODS.has(method.toUpperCase()) && rest) {
      if (isPathLikeName(rest) || rest.startsWith("data:")) {
        return `${method.toUpperCase()} ${sanitizeSentryUrl(rest)}`;
      }
      // METHOD + opaque technical name — freeform scrub only
      return `${method.toUpperCase()} ${scrubFreeformString(rest)}`;
    }
  }

  if (isPathLikeName(trimmed)) {
    return sanitizeSentryUrl(trimmed);
  }

  // resource.* and other technical descriptions: freeform scrub (URLs embedded)
  if (trimmed.startsWith("resource.") || /https?:\/\//i.test(trimmed)) {
    return scrubFreeformString(trimmed);
  }

  return scrubFreeformString(trimmed);
}

/**
 * Sanitize span attribute map: strip query/fragment keys, URL-sanitize known
 * URL fields, path-redact path fields. Does not invent body/payload fields.
 */
export function sanitizeSpanAttributes(
  data: Record<string, SentrySpanAttributeValue> | undefined | null,
): Record<string, SentrySpanAttributeValue> {
  if (data == null || !isPlainObject(data)) {
    return {};
  }

  const out: Record<string, SentrySpanAttributeValue> = {};

  for (const [key, value] of Object.entries(data)) {
    if (QUERY_FRAGMENT_ATTR_KEYS.has(key)) {
      // Preferred: omit raw query/fragment entirely
      continue;
    }

    if (value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      if (URL_ATTR_KEYS.has(key)) {
        out[key] = sanitizeSentryUrl(value);
        continue;
      }
      if (PATH_ATTR_KEYS.has(key)) {
        out[key] = sanitizeSentryPathname(value);
        continue;
      }
      // Defence-in-depth: other string attrs that look like absolute URLs
      if (/^https?:\/\//i.test(value.trim()) || value.trim().startsWith("/")) {
        // Path-only short keys (e.g. technical) vs full URL
        if (value.includes("?") || value.includes("#") || /^https?:\/\//i.test(value)) {
          out[key] = sanitizeSentryUrl(value);
          continue;
        }
        if (value.startsWith("/") && value.length > 1) {
          out[key] = sanitizeSentryPathname(value);
          continue;
        }
      }
      out[key] = value;
      continue;
    }

    // numbers, booleans, arrays — pass through (no body injection)
    out[key] = value;
  }

  return out;
}

/**
 * Safe fallback when span input is unusable or sanitizer fails.
 * Preserves low-risk technical ids; clears privacy-sensitive strings.
 * Never returns the original raw span.
 */
export function buildSafeFallbackSpan(
  span: Partial<SentrySpanJsonLike> | null | undefined,
): SentrySpanJsonLike {
  const span_id =
    typeof span?.span_id === "string" && span.span_id.length > 0
      ? span.span_id
      : "0000000000000000";
  const trace_id =
    typeof span?.trace_id === "string" && span.trace_id.length > 0
      ? span.trace_id
      : "00000000000000000000000000000000";
  const start_timestamp =
    typeof span?.start_timestamp === "number" && Number.isFinite(span.start_timestamp)
      ? span.start_timestamp
      : 0;

  const fallback: SentrySpanJsonLike = {
    data: {},
    span_id,
    trace_id,
    start_timestamp,
  };

  if (typeof span?.op === "string") {
    fallback.op = span.op;
  }
  if (typeof span?.timestamp === "number" && Number.isFinite(span.timestamp)) {
    fallback.timestamp = span.timestamp;
  }
  if (typeof span?.parent_span_id === "string") {
    fallback.parent_span_id = span.parent_span_id;
  }
  if (typeof span?.status === "string") {
    fallback.status = span.status;
  }
  if (typeof span?.origin === "string") {
    fallback.origin = span.origin;
  }
  // Explicitly no description (may have contained URLs)
  return fallback;
}

/**
 * Immutable span sanitation for beforeSendSpan.
 * On unexpected input / failure: safe fallback (never raw original).
 */
export function sanitizeSentrySpan(
  span: SentrySpanJsonLike | null | undefined | unknown,
): SentrySpanJsonLike {
  try {
    if (span == null || typeof span !== "object") {
      return buildSafeFallbackSpan(null);
    }

    const input = span as SentrySpanJsonLike;

    if (typeof input.span_id !== "string" || typeof input.trace_id !== "string") {
      return buildSafeFallbackSpan(input);
    }
    if (typeof input.start_timestamp !== "number") {
      return buildSafeFallbackSpan(input);
    }

    const out: SentrySpanJsonLike = {
      data: sanitizeSpanAttributes(
        isPlainObject(input.data) ? (input.data as Record<string, SentrySpanAttributeValue>) : {},
      ),
      span_id: input.span_id,
      trace_id: input.trace_id,
      start_timestamp: input.start_timestamp,
    };

    if (typeof input.description === "string") {
      out.description = sanitizeSpanDescription(input.description);
    } else if (input.description !== undefined) {
      // Non-string description — drop rather than leak
      out.description = SENTRY_REDACTED;
    }

    if (typeof input.op === "string") {
      out.op = input.op;
    }
    if (typeof input.parent_span_id === "string") {
      out.parent_span_id = input.parent_span_id;
    }
    if (typeof input.status === "string") {
      out.status = input.status;
    }
    if (typeof input.timestamp === "number") {
      out.timestamp = input.timestamp;
    }
    if (typeof input.origin === "string") {
      out.origin = input.origin;
    }
    if (typeof input.profile_id === "string") {
      out.profile_id = input.profile_id;
    }
    if (typeof input.exclusive_time === "number") {
      out.exclusive_time = input.exclusive_time;
    }
    if (typeof input.is_segment === "boolean") {
      out.is_segment = input.is_segment;
    }
    if (typeof input.segment_id === "string") {
      out.segment_id = input.segment_id;
    }
    // measurements: numeric web vitals — shallow copy only if plain object of numbers-ish
    if (input.measurements !== undefined && isPlainObject(input.measurements)) {
      out.measurements = { ...input.measurements };
    }
    // links: do not deep-copy potentially large structures; omit for privacy safety
    // (installed browser spans rarely set links on HTTP client spans)

    return out;
  } catch {
    try {
      return buildSafeFallbackSpan(
        span != null && typeof span === "object" ? (span as Partial<SentrySpanJsonLike>) : null,
      );
    } catch {
      return buildSafeFallbackSpan(null);
    }
  }
}

/**
 * Sanitize transaction request: URL via sanitizeSentryUrl; drop headers,
 * cookies, body, query_string (never emit raw query).
 */
function sanitizeTransactionRequest(
  request: SentryTransactionEventLike["request"],
): SentryTransactionEventLike["request"] | undefined {
  if (request == null) return undefined;
  if (!isPlainObject(request)) return undefined;

  const out: NonNullable<SentryTransactionEventLike["request"]> = {};

  if (typeof request.url === "string") {
    out.url = sanitizeSentryUrl(request.url);
  }

  if (typeof request.method === "string") {
    out.method = request.method;
  }

  // Intentionally omit: headers (incl. Referer), cookies, data, body, query_string
  return out;
}

/**
 * Immutable transaction sanitation for beforeSendTransaction.
 * Fail-closed: on any failure returns null (never original raw event).
 */
export function sanitizeSentryTransaction(
  event: SentryTransactionEventLike | null | undefined | unknown,
): SentryTransactionEventLike | null {
  try {
    if (event == null || typeof event !== "object") {
      return null;
    }

    const input = event as SentryTransactionEventLike;

    // Require transaction type when present; missing type still scrub if transaction-shaped
    if (input.type !== undefined && input.type !== "transaction") {
      return null;
    }

    const out: SentryTransactionEventLike = {
      type: "transaction",
    };

    // Preserve low-risk identity / timing / release metadata
    if (typeof input.event_id === "string") out.event_id = input.event_id;
    if (typeof input.level === "string") out.level = input.level;
    if (typeof input.platform === "string") out.platform = input.platform;
    if (typeof input.release === "string") out.release = input.release;
    if (typeof input.environment === "string") out.environment = input.environment;
    if (typeof input.dist === "string") out.dist = input.dist;
    if (typeof input.start_timestamp === "number") {
      out.start_timestamp = input.start_timestamp;
    }
    if (typeof input.timestamp === "number") out.timestamp = input.timestamp;
    if (input.sdk !== undefined) out.sdk = input.sdk;

    // Transaction name — path/URL-like → canonical redaction ($id)
    if (typeof input.transaction === "string") {
      out.transaction = isPathLikeName(input.transaction)
        ? sanitizeSentryUrl(input.transaction)
        : scrubFreeformString(input.transaction);
    }

    // transaction_info.source must stay as-is when present (baggage semantics).
    // Do not force source: custom — preserves source === "url" DSC behavior.
    if (input.transaction_info !== undefined && isPlainObject(input.transaction_info)) {
      out.transaction_info = { ...input.transaction_info };
    }

    if (input.request !== undefined) {
      const req = sanitizeTransactionRequest(input.request);
      if (req !== undefined) {
        out.request = req;
      }
    }

    // Nested spans — defence-in-depth even if beforeSendSpan already ran
    if (Array.isArray(input.spans)) {
      out.spans = input.spans.map((s) => sanitizeSentrySpan(s));
    }

    // contexts.trace holds trace/span ids — preserve structure without URL walk
    if (input.contexts !== undefined && isPlainObject(input.contexts)) {
      const contextsOut: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input.contexts)) {
        if (k === "trace" && isPlainObject(v)) {
          // Keep technical trace context; do not copy freeform URL fields if any
          const trace: Record<string, unknown> = {};
          for (const [tk, tv] of Object.entries(v)) {
            if (tk === "data" && isPlainObject(tv)) {
              trace.data = sanitizeSpanAttributes(tv as Record<string, SentrySpanAttributeValue>);
            } else if (typeof tv === "string" && isPathLikeName(tv)) {
              trace[tk] = sanitizeSentryUrl(tv);
            } else {
              trace[tk] = tv;
            }
          }
          contextsOut.trace = trace;
        } else if (k === "response" || k === "request") {
          // Drop request/response context bags that may carry headers/URLs
          continue;
        } else {
          contextsOut[k] = v;
        }
      }
      out.contexts = contextsOut;
    }

    // tags / measurements — preserve technical; no deep freeform dump of extras
    if (input.tags !== undefined && isPlainObject(input.tags)) {
      out.tags = { ...input.tags };
    }
    if (input.measurements !== undefined && isPlainObject(input.measurements)) {
      out.measurements = { ...input.measurements };
    }
    if (Array.isArray(input.fingerprint)) {
      out.fingerprint = [...input.fingerprint];
    }

    // Do not copy: extra, user, breadcrumbs (error-path surfaces; tracing shouldn't need them)
    // If present, omit rather than risk PII on a pipeline without 1C walk.

    return out;
  } catch {
    return null;
  }
}
