/**
 * OBS-T1 — derive safe SPA pageview route templates from TanStack Router matches.
 *
 * Never emit raw pathnames that contain resource UUIDs or opaque dynamic segments.
 */

export type RouterMatchLike = {
  /** TanStack route id (may include pathless layouts such as `/_authed`). */
  routeId?: string;
  /** Static full path template when available (e.g. `/projects/$id/estimate`). */
  fullPath?: string;
  /** Resolved pathname (may contain UUIDs) — used only as last resort with redaction. */
  pathname?: string;
  /** Status / not-found signals when present on the match. */
  status?: string;
  isNotFound?: boolean;
};

/** Non-global: safe for repeated `.test()` without lastIndex state. */
const UUID_TEST_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/** Global: used only with `.replace()` for redaction. */
const UUID_REDACT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/**
 * Normalize a TanStack fullPath / route id into a customer-facing route template.
 */
export function normalizeRouteTemplate(raw: string): string {
  let t = raw.trim();
  if (!t) return "/404";

  // Drop pathless layout segments (e.g. /_authed/dashboard → /dashboard).
  t = t.replace(/\/_[^/]+(?=\/|$)/g, "");

  // TanStack file-route ids may include trailing underscores before dynamic segments
  // (e.g. /trades_/$jobId) — strip the underscore only when before / or end.
  t = t.replace(/_(\/|$)/g, "$1");

  // Collapse accidental double slashes and trailing slash (except root).
  t = t.replace(/\/{2,}/g, "/");
  if (t.length > 1 && t.endsWith("/")) {
    t = t.slice(0, -1);
  }

  if (!t.startsWith("/")) {
    t = `/${t}`;
  }

  if (t === "" || t === "/") return "/";
  return t;
}

/**
 * Redact residual dynamic IDs if a resolved pathname leaks through.
 * Prefer fullPath templates so this is only a safety net.
 */
export function redactDynamicSegments(path: string): string {
  let t = path;
  // Reset lastIndex in case a prior consumer left a shared global mid-state.
  UUID_REDACT_RE.lastIndex = 0;
  t = t.replace(UUID_REDACT_RE, "$id");
  // Long opaque tokens (non-uuid) that look like resource ids
  t = t.replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, "/$id");
  return t;
}

/**
 * Derive the canonical route template from the current router match stack.
 */
export function deriveRouteTemplateFromMatches(
  matches: readonly RouterMatchLike[],
  options?: { isNotFound?: boolean },
): string {
  if (options?.isNotFound) {
    return "/404";
  }

  if (!matches.length) {
    return "/404";
  }

  // Prefer deepest match that is not a pathless layout-only node without fullPath.
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.isNotFound || m.status === "notFound") {
      return "/404";
    }

    const candidate = m.fullPath || m.routeId;
    if (!candidate) continue;

    // Skip pure pathless layout ids such as `/_authed` with no public path.
    if (/^\/_[^/]+$/.test(candidate) && !m.fullPath) {
      continue;
    }

    const normalized = normalizeRouteTemplate(candidate);
    // If fullPath was missing and we only have a resolved pathname-like id with UUIDs, redact.
    // UUID_TEST_RE is non-global — no lastIndex alternation across calls.
    if (UUID_TEST_RE.test(normalized)) {
      return redactDynamicSegments(normalized);
    }
    return normalized || "/404";
  }

  return "/404";
}

/**
 * Build a pageview-safe absolute URL that never embeds dynamic resource ids.
 */
export function buildSafePageviewUrl(origin: string, routeTemplate: string): string {
  const base = origin.replace(/\/$/, "");
  const path = routeTemplate.startsWith("/") ? routeTemplate : `/${routeTemplate}`;
  return `${base}${path}`;
}
