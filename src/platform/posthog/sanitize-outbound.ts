/**
 * OBS-T1-R2 — browser-wide PostHog outbound URL/path/referrer privacy boundary.
 *
 * Runs via PostHog `before_send` after the SDK attaches automatic browser
 * properties. Complements application-level sanitizeTelemetryMetadata().
 *
 * Does NOT scrub identity IDs (distinct_id, $user_id, $device_id, $session_id).
 * Does NOT mutate arbitrary string properties.
 */
import type { CaptureResult } from "posthog-js";

import { redactDynamicSegments } from "@/platform/analytics/route-template";

/**
 * Explicit inventory of automatic (or auto-like) PostHog URL/path/referrer
 * properties observed in SDK types, preview payloads, and IV evidence.
 */
export const POSTHOG_URL_PATH_PROPERTY_INVENTORY = [
  // Core browser location (IV P1)
  "$current_url",
  "$pathname",
  "$prev_pageview_pathname",
  // Session entry (preview payloads)
  "$session_entry_url",
  "$session_entry_pathname",
  "$session_entry_referrer",
  // Referrer
  "$referrer",
  // Initial / person bootstrap variants sometimes present on events
  "$initial_current_url",
  "$initial_pathname",
  "$initial_referrer",
] as const;

/** Path-only properties (no origin). */
const PATH_ONLY_PROPERTIES = new Set<string>([
  "$pathname",
  "$prev_pageview_pathname",
  "$session_entry_pathname",
  "$initial_pathname",
]);

/** Host/domain-only properties — leave values unless they look like paths with IDs. */
const HOST_DOMAIN_PROPERTIES = new Set<string>([
  "$host",
  "$session_entry_host",
  "$referring_domain",
  "$session_entry_referring_domain",
  "$initial_referring_domain",
]);

/** Identity / protocol IDs — never path-redact. */
const PRESERVE_ID_PROPERTIES = new Set<string>([
  "distinct_id",
  "token",
  "$device_id",
  "$user_id",
  "$session_id",
  "$window_id",
  "$pageview_id",
  "$insert_id",
  "$anon_distinct_id",
  "$device_type",
]);

const EXPLICIT_URL_PATH_SET = new Set<string>(POSTHOG_URL_PATH_PROPERTY_INVENTORY);

/**
 * Sanitize a path-only value for outbound analytics.
 * Strips query/hash and redacts dynamic resource segments to `$id`.
 */
export function sanitizeAnalyticsPathname(pathname: string): string {
  if (!pathname) return pathname;
  if (pathname === "$direct") return pathname;

  let p = pathname.trim();

  // If a full URL was incorrectly placed in a path field, extract pathname only.
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname || "/";
    } catch {
      p = p.replace(/^https?:\/\/[^/?#]+/i, "") || "/";
    }
  }

  // Drop query/hash if present on a path-like string.
  p = p.split("?")[0]?.split("#")[0] ?? p;
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }

  return redactDynamicSegments(p);
}

/**
 * Sanitize an absolute or relative URL for outbound analytics.
 * Keeps origin; strips query/hash; redacts dynamic path segments.
 */
export function sanitizeAnalyticsUrl(url: string): string {
  if (!url) return url;
  if (url === "$direct") return url;

  const trimmed = url.trim();

  // Path-only values
  if (trimmed.startsWith("/")) {
    return sanitizeAnalyticsPathname(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    const safePath = sanitizeAnalyticsPathname(parsed.pathname || "/");
    // Never re-attach search or hash.
    return `${parsed.origin}${safePath}`;
  } catch {
    // Malformed — strip query/hash and redact residual dynamics.
    const stripped = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
    return redactDynamicSegments(stripped);
  }
}

/**
 * Whether a property key is a known or clearly URL/path/referrer automatic field.
 * Bounded — does not match arbitrary business properties.
 */
export function isPostHogUrlPathPropertyName(key: string): boolean {
  if (PRESERVE_ID_PROPERTIES.has(key)) return false;
  if (HOST_DOMAIN_PROPERTIES.has(key)) return false;
  if (EXPLICIT_URL_PATH_SET.has(key)) return true;

  // Unknown automatic-style properties whose names clearly denote URL/path/referrer.
  if (!key.startsWith("$")) return false;
  if (/pathname/i.test(key)) return true;
  if (/prev_pageview/i.test(key)) return true;
  if (/referrer$/i.test(key) && !/domain/i.test(key)) return true;
  if (/_url$/i.test(key) || key === "$url" || /current_url/i.test(key)) return true;
  return false;
}

function sanitizePropertyValue(key: string, value: string): string {
  if (PATH_ONLY_PROPERTIES.has(key) || (/pathname/i.test(key) && key.startsWith("$"))) {
    return sanitizeAnalyticsPathname(value);
  }
  return sanitizeAnalyticsUrl(value);
}

function sanitizePropertiesRecord(
  properties: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!properties || typeof properties !== "object") return properties;

  const next: Record<string, unknown> = { ...properties };

  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== "string") continue;
    if (!isPostHogUrlPathPropertyName(key)) continue;
    next[key] = sanitizePropertyValue(key, value);
  }

  return next;
}

/**
 * Fail-closed strip of all URL/path properties (no raw values retained).
 */
function stripUrlPathProperties(
  properties: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!properties || typeof properties !== "object") return properties;
  const next: Record<string, unknown> = { ...properties };
  for (const key of Object.keys(next)) {
    if (isPostHogUrlPathPropertyName(key)) {
      delete next[key];
    }
  }
  return next;
}

/**
 * Final outbound sanitizer for PostHog `before_send`.
 * Privacy fails closed: on exception, URL/path fields are dropped (or event rejected).
 */
export function sanitizePostHogBrowserEvent(event: CaptureResult | null): CaptureResult | null {
  if (event == null) return null;

  try {
    const properties = sanitizePropertiesRecord(
      event.properties as Record<string, unknown> | undefined,
    );
    const $set = sanitizePropertiesRecord(event.$set as Record<string, unknown> | undefined);
    const $set_once = sanitizePropertiesRecord(
      event.$set_once as Record<string, unknown> | undefined,
    );

    return {
      ...event,
      properties: (properties ?? {}) as CaptureResult["properties"],
      ...($set !== undefined ? { $set: $set as CaptureResult["$set"] } : {}),
      ...($set_once !== undefined ? { $set_once: $set_once as CaptureResult["$set_once"] } : {}),
    };
  } catch {
    // Privacy fail-closed: never emit original unsanitized URL fields.
    try {
      return {
        ...event,
        properties: (stripUrlPathProperties(event.properties as Record<string, unknown>) ??
          {}) as CaptureResult["properties"],
      };
    } catch {
      return null;
    }
  }
}
