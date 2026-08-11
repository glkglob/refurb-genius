/**
 * PH-SENTRY-1B1 — server Sentry outbound privacy boundary (beforeSend).
 *
 * Pure module: no Sentry.init, no @sentry/node, no browser globals.
 * Reuses PH-SENTRY-1C browser event scrubbing, then applies server-specific
 * request stripping and nested/provider key coverage.
 *
 * Fail-closed: on sanitizer failure returns null (never the original event).
 * Immutable: never mutates the input event.
 */
import {
  SENTRY_REDACTED,
  sanitizeSentryEvent,
  type SentryEventLike,
  shouldRedactSentryKey,
  scrubFreeformString,
} from "@/platform/sentry/sanitize-outbound";

export { SENTRY_REDACTED };

/**
 * Additional exact keys observed or likely on server capture contexts
 * (provider errors, serverFn metadata, nested causes) beyond 1C coverage.
 * Keys already covered by shouldRedactSentryKey / SECRET_PARTIALS are omitted.
 */
const SERVER_EXTRA_EXACT_KEYS = new Set([
  "messages",
  "content",
  "body",
  "request_body",
  "response_body",
  "requestbody",
  "responsebody",
  "input",
  "output",
  "requirements",
  "jwt",
  "authorization",
  "cookie",
  "set-cookie",
  "set_cookie",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "purchase_price",
  "purchaseprice",
  "address",
  "postcode",
  "postal_code",
]);

/** Max depth for server-specific deep walk (nested provider causes). */
const SERVER_MAX_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function shouldRedactServerKey(key: string): boolean {
  if (shouldRedactSentryKey(key)) return true;
  const k = key.toLowerCase();
  if (SERVER_EXTRA_EXACT_KEYS.has(k)) return true;
  // Nested provider / HTTP residual shapes
  if (k === "headers" || k === "cookies" || k === "cookie" || k === "set-cookie") {
    return true;
  }
  return false;
}

/**
 * PH-SENTRY-1B2B — stack frame location keys.
 * Base 1C sanitizer already stripped query/hash and dynamic IDs from these.
 * Server deep-walk must not blank them to [REDACTED] solely because
 * shouldRedactSentryKey("filename") is true for freeform object bags.
 */
function isStackFrameLocationKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === "filename" || k === "abs_path";
}

/**
 * Deep-walk values for server-specific sensitive keys after the 1C base pass.
 * Preserves structure; redacts values for sensitive keys; freeform-scrubs strings.
 */
function walkServer(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (depth >= SERVER_MAX_DEPTH) {
    return SENTRY_REDACTED;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    if (key !== undefined && shouldRedactServerKey(key)) {
      return SENTRY_REDACTED;
    }
    return value;
  }

  if (typeof value === "string") {
    if (key !== undefined && shouldRedactServerKey(key)) {
      // Stack frame locations: 1C already ran sanitizeFrameLocation. Preserve the
      // safe diagnostic path; do not replace with blanket [REDACTED].
      // Re-scrub freeform secrets as defence-in-depth.
      if (isStackFrameLocationKey(key)) {
        return scrubFreeformString(value);
      }
      return SENTRY_REDACTED;
    }
    return scrubFreeformString(value);
  }

  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return SENTRY_REDACTED;
  }

  if (typeof value !== "object") {
    return SENTRY_REDACTED;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (Array.isArray(value)) {
    seen.add(value);
    const out = value.map((item) => walkServer(item, key, seen, depth + 1));
    seen.delete(value);
    return out;
  }

  if (!isPlainObject(value)) {
    try {
      return scrubFreeformString(String(value));
    } catch {
      return SENTRY_REDACTED;
    }
  }

  if (key !== undefined && shouldRedactServerKey(key)) {
    return SENTRY_REDACTED;
  }

  seen.add(value);
  const out: Record<string, unknown> = {};
  for (const [childKey, childVal] of Object.entries(value)) {
    if (shouldRedactServerKey(childKey)) {
      if (isStackFrameLocationKey(childKey) && typeof childVal === "string") {
        out[childKey] = scrubFreeformString(childVal);
        continue;
      }
      out[childKey] = SENTRY_REDACTED;
      continue;
    }
    out[childKey] = walkServer(childVal, childKey, seen, depth + 1);
  }
  seen.delete(value);
  return out;
}

/**
 * Enforce server request privacy: no headers/cookies/body/query on the wire.
 * Base 1C already drops these; re-assert after any residual merge.
 */
function hardenServerRequest(
  request: SentryEventLike["request"] | undefined,
): SentryEventLike["request"] | undefined {
  if (request == null) return undefined;
  if (!isPlainObject(request)) return undefined;

  const out: NonNullable<SentryEventLike["request"]> = {};

  // URL already sanitized by 1C (query/hash stripped, dynamic IDs redacted)
  if (typeof request.url === "string") {
    out.url = request.url;
  }
  if (typeof request.method === "string") {
    out.method = request.method;
  }

  // Explicitly never re-emit these
  // headers, cookies, data, body, query_string — omitted

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Strip user email/IP/username (1C already keeps id only); drop user entirely
 * if only residual empty object after 1C — reassert id-only policy.
 */
function hardenServerUser(
  user: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (user == null) return undefined;
  if (!isPlainObject(user)) return undefined;
  if (!("id" in user) || user.id === undefined) {
    return undefined;
  }
  const id = user.id;
  if (typeof id === "string" || typeof id === "number" || typeof id === "boolean" || id === null) {
    return { id };
  }
  return undefined;
}

/**
 * Apply server-specific tightening after 1C sanitizeSentryEvent.
 */
function applyServerHardening(event: SentryEventLike): SentryEventLike {
  const seen = new WeakSet<object>();
  const out: SentryEventLike = { ...event };

  out.request = hardenServerRequest(event.request);
  out.user = hardenServerUser(event.user as Record<string, unknown> | undefined);

  // Deep re-walk nested bags where provider/server causes commonly land
  if (event.extra !== undefined) {
    out.extra = walkServer(event.extra, "extra", seen, 0) as Record<string, unknown>;
  }
  if (event.contexts !== undefined) {
    out.contexts = walkServer(event.contexts, "contexts", seen, 0) as Record<string, unknown>;
  }
  if (event.tags !== undefined) {
    out.tags = walkServer(event.tags, "tags", seen, 0) as Record<string, unknown>;
  }
  if (event.breadcrumbs !== undefined && Array.isArray(event.breadcrumbs)) {
    out.breadcrumbs = walkServer(
      event.breadcrumbs,
      "breadcrumbs",
      seen,
      0,
    ) as SentryEventLike["breadcrumbs"];
  }
  if (event.exception !== undefined) {
    out.exception = walkServer(
      event.exception,
      "exception",
      seen,
      0,
    ) as SentryEventLike["exception"];
  }

  // Drop any residual request-like top-level fields
  const residual = out as Record<string, unknown>;
  for (const key of ["headers", "cookies", "query_string", "body", "data"] as const) {
    if (key in residual) {
      delete residual[key];
    }
  }

  return out;
}

/**
 * Final outbound sanitizer for server Sentry `beforeSend`.
 * Privacy fails closed: on any exception returns null (event dropped).
 * Never returns the original unsanitized event reference.
 */
export function sanitizeServerSentryEvent(
  event: SentryEventLike | null | undefined | unknown,
): SentryEventLike | null {
  if (event == null) return null;
  if (typeof event !== "object") return null;

  try {
    const base = sanitizeSentryEvent(event);
    if (base == null) return null;
    return applyServerHardening(base);
  } catch {
    return null;
  }
}
