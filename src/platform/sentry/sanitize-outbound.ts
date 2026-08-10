/**
 * PH-SENTRY-1C — browser Sentry outbound privacy boundary (beforeSend).
 *
 * Pure module: no Sentry.init, no import of @/lib/sentry or platform/sentry/index.
 * Fail-closed: on sanitizer failure returns null (never the original event).
 * Immutable: never mutates the input event.
 */
import { redactDynamicSegments } from "@/platform/analytics/route-template";

/** Sentinel for redacted string values (Sentry tests assert this exact casing). */
export const SENTRY_REDACTED = "[REDACTED]";

const CIRCULAR = "[Circular]";
const MAX_DEPTH = 6;
const MAX_FREEFORM_LEN = 500;

/**
 * Minimal structural shape of fields we touch. Compatible with Sentry ErrorEvent.
 * Unknown top-level keys are shallow-copied then deep-walked for privacy.
 */
export type SentryEventLike = {
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
    [key: string]: unknown;
  };
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
    category?: string;
    level?: string;
    timestamp?: number;
    type?: string;
    [key: string]: unknown;
  }>;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: unknown;
      mechanism?: unknown;
      [key: string]: unknown;
    }>;
  };
  message?: string;
  transaction?: string;
  fingerprint?: string[];
  level?: string;
  release?: string;
  environment?: string;
  event_id?: string;
  platform?: string;
  [key: string]: unknown;
};

/** User keys always dropped (id is preserved separately). */
const USER_DROP_KEYS = new Set(["email", "ip_address", "username", "name", "geo"]);

/**
 * Exact case-insensitive keys (after lowercasing) for PII, business, file/path, ids.
 * "file" / "path" / "token" handled carefully — not partial for file/path.
 */
const EXACT_REDACT_KEYS = new Set([
  // Direct PII
  "email",
  "emailaddress",
  "user_email",
  "fullname",
  "full_name",
  "address",
  "propertyaddress",
  "property_address",
  "postcode",
  "postal_code",
  "zip",
  "zipcode",
  "phone",
  "telephone",
  "mobile",
  // Business / financial (known fields only)
  "purchase_price",
  "purchaseprice",
  "gdv",
  "profit",
  "roi",
  "listing_url",
  "listingurl",
  "prompt",
  "completion",
  "response_text",
  "filter",
  // File / photo / path
  "photo",
  "photo_name",
  "photoname",
  "filename",
  "file",
  "path",
  // Identifiers not required for diagnosis
  "projectid",
  "project_id",
  "userid",
  "user_id",
  "photoid",
  "photo_id",
]);

/**
 * Secret substrings — partial match on normalized key (lowercase).
 * `token` is special-cased (whole key or `_token` suffix only).
 */
const SECRET_PARTIALS = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwd",
  "secret",
  "client_secret",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "id_token",
  "session_token",
  "bearer",
  "private_key",
  "x-api-key",
] as const;

/** Breadcrumb / object keys that hold URL-like values. */
const URL_FIELD_KEYS = new Set(["url", "uri", "href", "pathname", "referrer"]);

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-+=/]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
/** Obvious long opaque tokens (not short enums). */
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
const ABSOLUTE_URL_RE = /https?:\/\/[^\s"'<>\\]+/gi;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

/**
 * Whether a property key must have its value fully redacted.
 * Case-insensitive; secrets allow partial match; token is whole-key or `_token` suffix.
 */
export function shouldRedactSentryKey(key: string): boolean {
  const k = normalizeKey(key);

  if (EXACT_REDACT_KEYS.has(k)) return true;

  // token: whole key or ends with _token (e.g. access_token also listed explicitly)
  if (k === "token" || k.endsWith("_token")) return true;

  for (const partial of SECRET_PARTIALS) {
    if (k.includes(partial)) return true;
  }

  return false;
}

function isUrlFieldKey(key: string): boolean {
  return URL_FIELD_KEYS.has(normalizeKey(key));
}

function isPathnameKey(key: string): boolean {
  return normalizeKey(key) === "pathname";
}

/**
 * Sanitize a path-only value: strip query/hash, redact dynamic segments.
 */
export function sanitizeSentryPathname(pathname: string): string {
  if (!pathname) return pathname;

  let p = pathname.trim();

  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname || "/";
    } catch {
      p = p.replace(/^https?:\/\/[^/?#]+/i, "") || "/";
    }
  }

  p = p.split("?")[0]?.split("#")[0] ?? p;
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }

  return redactDynamicSegments(p);
}

/**
 * Sanitize absolute or relative URL-like strings.
 * Origin kept for absolute URLs; query/hash stripped; dynamic path segments redacted.
 */
export function sanitizeSentryUrl(url: string): string {
  if (!url) return url;

  const trimmed = url.trim();

  if (trimmed.startsWith("/")) {
    return sanitizeSentryPathname(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    const safePath = sanitizeSentryPathname(parsed.pathname || "/");
    return `${parsed.origin}${safePath}`;
  } catch {
    const stripped = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
    return redactDynamicSegments(stripped);
  }
}

function isClearlyUrl(value: string): boolean {
  const t = value.trim();
  if (/^https?:\/\//i.test(t)) return true;
  // Path with query or hash (likely URL-ish)
  if (t.startsWith("/") && /[?#]/.test(t)) return true;
  return false;
}

function isPathLikeTransaction(value: string): boolean {
  const t = value.trim();
  return t.startsWith("/") || /^https?:\/\//i.test(t);
}

/**
 * Freeform string scrub for messages, exception values, breadcrumb messages.
 * Does not blank entire technical messages — only redacts sensitive substrings.
 */
export function scrubFreeformString(input: string): string {
  let s = input;

  // Embedded absolute URLs → sanitize in place
  s = s.replace(ABSOLUTE_URL_RE, (match) => {
    // Trim trailing punctuation commonly glued to URLs in prose
    const trailing = match.match(/[.,;:!?)]+$/);
    const core = trailing ? match.slice(0, -trailing[0].length) : match;
    const suffix = trailing ? trailing[0] : "";
    return sanitizeSentryUrl(core) + suffix;
  });

  s = s.replace(EMAIL_RE, SENTRY_REDACTED);
  s = s.replace(BEARER_RE, `Bearer ${SENTRY_REDACTED}`);
  s = s.replace(JWT_RE, SENTRY_REDACTED);
  s = s.replace(LONG_TOKEN_RE, SENTRY_REDACTED);

  if (s.length > MAX_FREEFORM_LEN) {
    s = `${s.slice(0, MAX_FREEFORM_LEN)}...`;
  }

  return s;
}

function sanitizeStringValue(key: string | undefined, value: string): string {
  if (key !== undefined && shouldRedactSentryKey(key)) {
    return SENTRY_REDACTED;
  }

  if (key !== undefined && isUrlFieldKey(key)) {
    return isPathnameKey(key) ? sanitizeSentryPathname(value) : sanitizeSentryUrl(value);
  }

  if (isClearlyUrl(value)) {
    return sanitizeSentryUrl(value);
  }

  return scrubFreeformString(value);
}

/**
 * Deep walk of arbitrary values with cycle detection and max depth.
 */
function walk(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (depth >= MAX_DEPTH) {
    return SENTRY_REDACTED;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    // Numbers/booleans preserved unless key itself is secret/PII/financial
    if (key !== undefined && shouldRedactSentryKey(key)) {
      return SENTRY_REDACTED;
    }
    return value;
  }

  if (typeof value === "string") {
    return sanitizeStringValue(key, value);
  }

  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return SENTRY_REDACTED;
  }

  if (typeof value !== "object") {
    return SENTRY_REDACTED;
  }

  if (seen.has(value)) {
    return CIRCULAR;
  }

  if (Array.isArray(value)) {
    seen.add(value);
    const out = value.map((item) => walk(item, key, seen, depth + 1));
    seen.delete(value);
    return out;
  }

  if (!isPlainObject(value)) {
    // Non-plain: String then freeform scrub, or redact on failure
    try {
      const asString = String(value);
      return scrubFreeformString(asString);
    } catch {
      return SENTRY_REDACTED;
    }
  }

  if (key !== undefined && shouldRedactSentryKey(key)) {
    return SENTRY_REDACTED;
  }

  seen.add(value);
  const out: Record<string, unknown> = {};
  for (const [childKey, childVal] of Object.entries(value)) {
    if (shouldRedactSentryKey(childKey)) {
      out[childKey] = SENTRY_REDACTED;
      continue;
    }
    out[childKey] = walk(childVal, childKey, seen, depth + 1);
  }
  seen.delete(value);
  return out;
}

function sanitizeRequest(
  request: SentryEventLike["request"],
  seen: WeakSet<object>,
  depth: number,
): SentryEventLike["request"] | undefined {
  if (request == null) return undefined;
  if (!isPlainObject(request)) {
    return undefined;
  }

  // Drop headers, cookies, data/body, query_string entirely.
  const out: NonNullable<SentryEventLike["request"]> = {};

  if (typeof request.url === "string") {
    out.url = sanitizeSentryUrl(request.url);
  } else if (request.url !== undefined) {
    out.url = walk(request.url, "url", seen, depth + 1) as string | undefined;
  }

  if (typeof request.method === "string") {
    out.method = request.method;
  }

  // Intentionally omit: headers, cookies, data, query_string, body
  // Preserve other non-sensitive request metadata via walk (rare fields)
  for (const [k, v] of Object.entries(request)) {
    if (
      k === "url" ||
      k === "method" ||
      k === "headers" ||
      k === "cookies" ||
      k === "data" ||
      k === "body" ||
      k === "query_string"
    ) {
      continue;
    }
    if (shouldRedactSentryKey(k)) {
      out[k] = SENTRY_REDACTED;
      continue;
    }
    out[k] = walk(v, k, seen, depth + 1);
  }

  return out;
}

/**
 * user.id only — drop email, ip_address, username, name, geo and all other keys.
 */
function sanitizeUser(
  user: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (user == null) return undefined;
  if (!isPlainObject(user)) return undefined;

  const out: Record<string, unknown> = {};
  if ("id" in user && user.id !== undefined) {
    // Opaque id for grouping — preserve as-is (string/number)
    const id = user.id;
    if (
      typeof id === "string" ||
      typeof id === "number" ||
      typeof id === "boolean" ||
      id === null
    ) {
      out.id = id;
    } else {
      // Non-primitive id → stringify carefully without leaking nested PII
      out.id = SENTRY_REDACTED;
    }
  }
  // Explicitly do not copy USER_DROP_KEYS or any other fields
  void USER_DROP_KEYS;
  return out;
}

/**
 * Sanitize frame.filename / frame.abs_path without destroying module-path utility.
 *
 * - http(s) and path-only → full sanitizeSentryUrl (query/hash strip + $id)
 * - app://, webpack://, file paths, etc. → strip query/hash only, then freeform scrub
 *   (avoids `new URL` rewriting non-special origins to "null/…")
 */
function sanitizeFrameLocation(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return sanitizeSentryUrl(trimmed);
  }

  // Special-scheme or relative module paths — never re-emit query/hash secrets
  const stripped = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  return scrubFreeformString(stripped);
}

/**
 * Stack frames: preserve diagnostic utility (function/lineno/colno/in_app/…)
 * while sanitizing privacy-sensitive frame strings (PH-SENTRY-1C-R1).
 *
 * - filename / abs_path → sanitizeFrameLocation
 * - context_line / pre_context / post_context → freeform scrub
 * - vars → recursive walk (unchanged)
 */
function cloneStacktrace(stacktrace: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (stacktrace == null) return stacktrace;
  if (!isPlainObject(stacktrace)) {
    return walk(stacktrace, undefined, seen, depth);
  }

  const st = stacktrace as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(st)) {
    if (k === "frames" && Array.isArray(v)) {
      out.frames = v.map((frame) => {
        if (!isPlainObject(frame)) {
          return walk(frame, undefined, seen, depth + 1);
        }
        const frameOut: Record<string, unknown> = {};
        for (const [fk, fv] of Object.entries(frame)) {
          // URL-like frame locations — strip query secrets, signed tokens, path IDs
          if ((fk === "filename" || fk === "abs_path") && typeof fv === "string") {
            frameOut[fk] = sanitizeFrameLocation(fv);
            continue;
          }

          // Source context lines — scrub freeform secrets without blanking technical text
          if (fk === "context_line" && typeof fv === "string") {
            frameOut[fk] = scrubFreeformString(fv);
            continue;
          }
          if ((fk === "pre_context" || fk === "post_context") && Array.isArray(fv)) {
            frameOut[fk] = fv.map((line) =>
              typeof line === "string"
                ? scrubFreeformString(line)
                : walk(line, fk, seen, depth + 2),
            );
            continue;
          }

          // Diagnostic metadata — preserve as-is
          if (
            fk === "function" ||
            fk === "lineno" ||
            fk === "colno" ||
            fk === "in_app" ||
            fk === "module" ||
            fk === "package" ||
            fk === "platform" ||
            fk === "instruction_addr" ||
            fk === "addr_mode" ||
            fk === "image_addr" ||
            fk === "symbol" ||
            typeof fv === "number" ||
            typeof fv === "boolean" ||
            fv === null
          ) {
            frameOut[fk] = fv;
            continue;
          }

          // vars and any residual nested fields — recursive privacy walk
          frameOut[fk] = walk(fv, fk, seen, depth + 2);
        }
        return frameOut;
      });
      continue;
    }
    out[k] = walk(v, k, seen, depth + 1);
  }

  return out;
}

function sanitizeException(
  exception: SentryEventLike["exception"],
  seen: WeakSet<object>,
  depth: number,
): SentryEventLike["exception"] | undefined {
  if (exception == null) return undefined;
  if (!isPlainObject(exception)) return undefined;

  const out: NonNullable<SentryEventLike["exception"]> = {};
  const values = exception.values;

  if (Array.isArray(values)) {
    out.values = values.map((item) => {
      if (!isPlainObject(item)) {
        return walk(item, undefined, seen, depth + 1) as (typeof values)[number];
      }
      const vOut: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item)) {
        if (k === "type") {
          // Preserve exception type
          vOut.type = v;
          continue;
        }
        if (k === "value" && typeof v === "string") {
          vOut.value = scrubFreeformString(v);
          continue;
        }
        if (k === "stacktrace") {
          vOut.stacktrace = cloneStacktrace(v, seen, depth + 1);
          continue;
        }
        if (shouldRedactSentryKey(k)) {
          vOut[k] = SENTRY_REDACTED;
          continue;
        }
        vOut[k] = walk(v, k, seen, depth + 1);
      }
      return vOut;
    });
  }

  for (const [k, v] of Object.entries(exception)) {
    if (k === "values") continue;
    if (shouldRedactSentryKey(k)) {
      (out as Record<string, unknown>)[k] = SENTRY_REDACTED;
      continue;
    }
    (out as Record<string, unknown>)[k] = walk(v, k, seen, depth + 1);
  }

  return out;
}

function sanitizeBreadcrumbs(
  breadcrumbs: SentryEventLike["breadcrumbs"],
  seen: WeakSet<object>,
  depth: number,
): SentryEventLike["breadcrumbs"] | undefined {
  if (breadcrumbs == null) return undefined;
  if (!Array.isArray(breadcrumbs)) return undefined;

  return breadcrumbs.map((crumb) => {
    if (!isPlainObject(crumb)) {
      return walk(crumb, undefined, seen, depth + 1) as (typeof breadcrumbs)[number];
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(crumb)) {
      if (k === "message" && typeof v === "string") {
        out.message = scrubFreeformString(v);
        continue;
      }
      if (k === "data") {
        out.data = walk(v, "data", seen, depth + 1);
        continue;
      }
      if (shouldRedactSentryKey(k)) {
        out[k] = SENTRY_REDACTED;
        continue;
      }
      out[k] = walk(v, k, seen, depth + 1);
    }
    return out;
  }) as SentryEventLike["breadcrumbs"];
}

function sanitizeEvent(event: SentryEventLike): SentryEventLike {
  const seen = new WeakSet<object>();
  const out: SentryEventLike = {};

  // Preserve / scrub known top-level fields explicitly
  const preserveAsIs = [
    "level",
    "release",
    "environment",
    "event_id",
    "platform",
    "timestamp",
    "type",
    "logger",
    "server_name",
    "dist",
    "sdk",
  ] as const;

  const outRecord = out as Record<string, unknown>;
  for (const key of preserveAsIs) {
    if (key in event && event[key] !== undefined) {
      outRecord[key] = event[key];
    }
  }

  if (typeof event.message === "string") {
    out.message = scrubFreeformString(event.message);
  } else if (event.message !== undefined) {
    out.message = walk(event.message, "message", seen, 1) as string;
  }

  if (typeof event.transaction === "string") {
    out.transaction = isPathLikeTransaction(event.transaction)
      ? sanitizeSentryUrl(event.transaction)
      : scrubFreeformString(event.transaction);
  } else if (event.transaction !== undefined) {
    out.transaction = walk(event.transaction, "transaction", seen, 1) as string;
  }

  if (Array.isArray(event.fingerprint)) {
    out.fingerprint = event.fingerprint.map((fp) =>
      typeof fp === "string"
        ? scrubFreeformString(fp)
        : (walk(fp, "fingerprint", seen, 1) as string),
    );
  }

  if (event.request !== undefined) {
    out.request = sanitizeRequest(event.request, seen, 0);
  }

  if (event.user !== undefined) {
    out.user = sanitizeUser(event.user as Record<string, unknown>);
  }

  if (event.tags !== undefined) {
    out.tags = walk(event.tags, "tags", seen, 0) as Record<string, unknown>;
  }

  if (event.extra !== undefined) {
    out.extra = walk(event.extra, "extra", seen, 0) as Record<string, unknown>;
  }

  if (event.contexts !== undefined) {
    out.contexts = walk(event.contexts, "contexts", seen, 0) as Record<string, unknown>;
  }

  if (event.breadcrumbs !== undefined) {
    out.breadcrumbs = sanitizeBreadcrumbs(event.breadcrumbs, seen, 0);
  }

  if (event.exception !== undefined) {
    out.exception = sanitizeException(event.exception, seen, 0);
  }

  // Remaining top-level keys: deep-walk for privacy (never pass through raw)
  const handled = new Set([
    ...preserveAsIs,
    "message",
    "transaction",
    "fingerprint",
    "request",
    "user",
    "tags",
    "extra",
    "contexts",
    "breadcrumbs",
    "exception",
  ]);

  for (const [k, v] of Object.entries(event)) {
    if (handled.has(k)) continue;
    if (shouldRedactSentryKey(k)) {
      out[k] = SENTRY_REDACTED;
      continue;
    }
    out[k] = walk(v, k, seen, 0);
  }

  return out;
}

/**
 * Final outbound sanitizer for Sentry `beforeSend`.
 * Privacy fails closed: on any exception returns null (event dropped).
 * Never returns the original unsanitized event reference.
 *
 * Accepts Sentry ErrorEvent (or any structural event) without importing @sentry/*
 * at runtime. Non-object inputs are dropped.
 */
export function sanitizeSentryEvent(
  event: SentryEventLike | null | undefined | unknown,
): SentryEventLike | null {
  if (event == null) return null;
  if (typeof event !== "object") return null;

  try {
    return sanitizeEvent(event as SentryEventLike);
  } catch {
    return null;
  }
}
