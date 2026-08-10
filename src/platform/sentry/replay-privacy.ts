/**
 * PH-SENTRY-1D1 / 1D1-R1 — Sentry Session Replay privacy helpers.
 *
 * Pure module: no Sentry.init, no import of @/lib/sentry.
 * Owns explicit Replay option policy + auth-callback URL sanitisation used
 * before Replay can observe window.location.
 *
 * Auth-safe bootstrap (R1):
 *   capture required query secrets → strip sensitive query from location →
 *   Sentry/Replay init → callback route consumes one-shot snapshot.
 *
 * Hash fragments used by Supabase `detectSessionInUrl` are NOT stripped at
 * pre-init (LEGACY/FALLBACK — preserve until application/Supabase session
 * detection can run). Route may strip hash after auth completion starts
 * when query-based auth material is already available.
 */
import { sanitizeSentryUrl } from "@/platform/sentry/sanitize-outbound";

/** Canonical auth callback path (TanStack route `/auth_/callback` → `/auth/callback`). */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Query keys that may carry OAuth / magic-link / session secrets on the callback.
 * Functional params (type, flow, redirect_to, error*) are intentionally retained
 * for the application callback flow after strip.
 */
export const AUTH_CALLBACK_SENSITIVE_QUERY_KEYS = [
  "code",
  "token_hash",
  "access_token",
  "refresh_token",
  "id_token",
  "provider_token",
  "provider_refresh_token",
] as const;

/** Hash fragment keys used by implicit/token-style redirects. */
export const AUTH_CALLBACK_SENSITIVE_HASH_KEYS = [
  "access_token",
  "refresh_token",
  "id_token",
  "provider_token",
  "provider_refresh_token",
  "token_type",
  "expires_in",
] as const;

const SENSITIVE_QUERY = new Set<string>(AUTH_CALLBACK_SENSITIVE_QUERY_KEYS);
const SENSITIVE_HASH = new Set<string>(AUTH_CALLBACK_SENSITIVE_HASH_KEYS);

/**
 * Short-lived in-memory snapshot of auth-callback query material required after
 * pre-init location strip. Never persisted; cleared on consume/clear.
 */
export type AuthCallbackBootstrapCapture = {
  code?: string;
  tokenHash?: string;
  type?: string;
};

/** Options for pure URL sanitisation. */
export type SanitizeAuthCallbackHrefOptions = {
  /**
   * When true (default), strip sensitive hash fragment keys.
   * Pre-init Replay prepare sets false so Supabase detectSessionInUrl can still
   * observe implicit-grant fragments after bootstrap.
   */
  stripHash?: boolean;
};

// --- one-shot bootstrap bridge (module memory only) -------------------------

/** Pending capture filled at prepare; moved to claimed on first take. */
let pendingBootstrapCapture: AuthCallbackBootstrapCapture | null = null;
/**
 * Claimed capture for the current callback page. Survives React Strict Mode
 * remounts (second take returns the same claim until clear).
 */
let claimedBootstrapCapture: AuthCallbackBootstrapCapture | null = null;
let bootstrapClaimed = false;

/**
 * Options object for `Sentry.replayIntegration(...)`.
 * Shape matches installed `@sentry-internal/replay` ReplayConfiguration.
 *
 * beforeAddRecordingEvent: defence-in-depth for custom Replay frames only
 * (performanceSpan / breadcrumb tags). Does NOT scrub initialUrl, DOM/rrweb
 * events, or all network URL surfaces.
 */
export function buildExplicitReplayPrivacyOptions() {
  return {
    maskAllText: true as const,
    maskAllInputs: true as const,
    blockAllMedia: true as const,
    // No request/response body or extra header detail capture.
    networkDetailAllowUrls: [] as (string | RegExp)[],
    networkDetailDenyUrls: [] as (string | RegExp)[],
    networkCaptureBodies: false as const,
    // Custom Replay event URL scrub only — not general Replay URL coverage.
    beforeAddRecordingEvent: scrubReplayRecordingEvent,
  };
}

export function isAuthCallbackPath(pathname: string): boolean {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === AUTH_CALLBACK_PATH;
}

/**
 * Extract auth query fields needed by completeAuthCallback from an href.
 * Pure; does not mutate storage.
 */
export function extractAuthCallbackBootstrapFromHref(
  href: string,
): AuthCallbackBootstrapCapture | null {
  if (!href) return null;

  let url: URL;
  try {
    url = new URL(href, "https://replay-privacy.invalid");
  } catch {
    return null;
  }

  if (!isAuthCallbackPath(url.pathname)) {
    return null;
  }

  const code = url.searchParams.get("code") ?? undefined;
  const tokenHash = url.searchParams.get("token_hash") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;

  if (!code && !tokenHash && !type) {
    return null;
  }

  const capture: AuthCallbackBootstrapCapture = {};
  if (code) capture.code = code;
  if (tokenHash) capture.tokenHash = tokenHash;
  if (type) capture.type = type;
  return capture;
}

/**
 * Store a one-shot bootstrap capture (in-memory only). Overwrites any pending
 * unclaimed buffer; does not clear an active claim.
 */
export function storeAuthCallbackBootstrapCapture(
  capture: AuthCallbackBootstrapCapture | null,
): void {
  if (!capture || (!capture.code && !capture.tokenHash && !capture.type)) {
    pendingBootstrapCapture = null;
    return;
  }
  pendingBootstrapCapture = { ...capture };
}

/**
 * Take bootstrap secrets for the callback route.
 *
 * First call moves pending → claimed and returns it.
 * Subsequent calls return the same claim until `clearAuthCallbackBootstrapCapture()`.
 * After clear, returns null.
 *
 * Not logged, not persisted, not exposed to Sentry/Replay metadata.
 */
export function takeAuthCallbackBootstrapCapture(): AuthCallbackBootstrapCapture | null {
  if (bootstrapClaimed) {
    return claimedBootstrapCapture ? { ...claimedBootstrapCapture } : null;
  }
  claimedBootstrapCapture = pendingBootstrapCapture ? { ...pendingBootstrapCapture } : null;
  pendingBootstrapCapture = null;
  bootstrapClaimed = true;
  return claimedBootstrapCapture ? { ...claimedBootstrapCapture } : null;
}

/**
 * Consume-once API: return current secrets and clear all buffers.
 * Prefer `take` + `clear` on the route for Strict Mode resilience.
 */
export function consumeAuthCallbackBootstrapCapture(): AuthCallbackBootstrapCapture | null {
  const value = takeAuthCallbackBootstrapCapture();
  clearAuthCallbackBootstrapCapture();
  return value;
}

/** Clear pending + claimed bootstrap secrets. Safe to call repeatedly. */
export function clearAuthCallbackBootstrapCapture(): void {
  pendingBootstrapCapture = null;
  claimedBootstrapCapture = null;
  bootstrapClaimed = false;
}

/** Test helper — inspect without mutating claim state. */
export function __peekAuthCallbackBootstrapStateForTests(): {
  pending: AuthCallbackBootstrapCapture | null;
  claimed: AuthCallbackBootstrapCapture | null;
  bootstrapClaimed: boolean;
} {
  return {
    pending: pendingBootstrapCapture ? { ...pendingBootstrapCapture } : null,
    claimed: claimedBootstrapCapture ? { ...claimedBootstrapCapture } : null,
    bootstrapClaimed,
  };
}

/**
 * Pure string transform: remove sensitive query (+ optional hash) material from
 * an auth callback URL. Non-callback URLs are returned unchanged.
 */
export function sanitizeAuthCallbackHref(
  href: string,
  options: SanitizeAuthCallbackHrefOptions = {},
): string {
  const stripHash = options.stripHash !== false;
  if (!href) return href;

  let url: URL;
  try {
    url = new URL(href, "https://replay-privacy.invalid");
  } catch {
    return href;
  }

  if (!isAuthCallbackPath(url.pathname)) {
    return href;
  }

  let changed = false;

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY.has(key.toLowerCase())) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (stripHash && url.hash && url.hash.length > 1) {
    const raw = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    // Hash may be `access_token=...&...` or `/path?q=1` — treat as querystring first.
    const hashParams = new URLSearchParams(raw.includes("=") ? raw : "");
    if ([...hashParams.keys()].length > 0) {
      let hashDirty = false;
      for (const key of [...hashParams.keys()]) {
        if (SENSITIVE_HASH.has(key.toLowerCase()) || SENSITIVE_QUERY.has(key.toLowerCase())) {
          hashParams.delete(key);
          hashDirty = true;
          changed = true;
        }
      }
      if (hashDirty) {
        const nextHash = hashParams.toString();
        url.hash = nextHash ? `#${nextHash}` : "";
      }
    } else if (SENSITIVE_HASH.has(raw.split("=")[0]?.toLowerCase() ?? "")) {
      url.hash = "";
      changed = true;
    }
  }

  if (!changed) {
    return href;
  }

  // Preserve relative vs absolute form for callers that pass path-only strings.
  if (!/^https?:\/\//i.test(href.trim()) && href.includes("://") === false) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  // When base was synthetic, rebuild from original if relative-looking.
  if (href.startsWith("/")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return url.toString();
}

/**
 * Synchronously strip sensitive auth-callback material from the current browser
 * location via history.replaceState. Safe no-op off-callback / non-browser.
 *
 * @param options.stripHash — default true. Pre-init prepare uses false.
 */
export function stripSensitiveAuthCallbackLocation(
  win: Pick<Window, "location" | "history"> = typeof window !== "undefined"
    ? window
    : (undefined as unknown as Window),
  options: SanitizeAuthCallbackHrefOptions = {},
): boolean {
  if (!win?.location || !win.history?.replaceState) {
    return false;
  }

  try {
    const current = win.location.href;
    if (!isAuthCallbackPath(win.location.pathname)) {
      return false;
    }
    const next = sanitizeAuthCallbackHref(current, options);
    if (next === current) {
      return false;
    }
    // Prefer path+search+hash so we do not force absolute origin rewrites.
    const parsed = new URL(next, win.location.origin);
    const relative = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    win.history.replaceState(win.history.state, "", relative);
    return true;
  } catch {
    return false;
  }
}

/**
 * PH-SENTRY-1D1-R1 bootstrap: capture query auth secrets, then strip sensitive
 * **query** params from the browser location so Replay setInitialState cannot
 * observe OAuth/magic-link query secrets.
 *
 * Does NOT strip hash (Supabase detectSessionInUrl legacy/fallback).
 * Route-scoped: no-op off `/auth/callback` and in non-browser environments.
 *
 * Must run **before** Sentry.init / replayIntegration.
 */
export function prepareAuthCallbackLocationForReplay(
  win: Pick<Window, "location" | "history"> = typeof window !== "undefined"
    ? window
    : (undefined as unknown as Window),
): boolean {
  if (!win?.location || !win.history?.replaceState) {
    return false;
  }

  try {
    if (!isAuthCallbackPath(win.location.pathname)) {
      return false;
    }

    const capture = extractAuthCallbackBootstrapFromHref(win.location.href);
    if (capture) {
      storeAuthCallbackBootstrapCapture(capture);
    }

    // Query only — preserve hash for detectSessionInUrl.
    return stripSensitiveAuthCallbackLocation(win, { stripHash: false });
  } catch {
    return false;
  }
}

/**
 * Scrub URL-like fields on custom Replay recording events (navigation spans).
 * Returning a modified event is supported; returning null drops the frame only.
 *
 * Coverage (installed SDK): custom events with data.tag performanceSpan|breadcrumb.
 * Does NOT cover: initialUrl, DOM/rrweb snapshots, all network URL records.
 */
export function scrubReplayRecordingEvent<T extends { data?: { tag?: string; payload?: unknown } }>(
  event: T,
): T {
  try {
    const tag = event?.data?.tag;
    if (tag !== "performanceSpan" && tag !== "breadcrumb") {
      return event;
    }

    const payload = event.data?.payload;
    if (!payload || typeof payload !== "object") {
      return event;
    }

    const nextPayload = scrubPayloadUrls(payload as Record<string, unknown>);
    if (nextPayload === payload) {
      return event;
    }

    return {
      ...event,
      data: {
        ...event.data,
        payload: nextPayload,
      },
    };
  } catch {
    return event;
  }
}

function scrubPayloadUrls(payload: Record<string, unknown>): Record<string, unknown> {
  let changed = false;
  const out: Record<string, unknown> = { ...payload };

  for (const key of ["description", "name"] as const) {
    const value = out[key];
    if (typeof value === "string" && looksLikeUrl(value)) {
      const scrubbed = scrubUrlForReplay(value);
      if (scrubbed !== value) {
        out[key] = scrubbed;
        changed = true;
      }
    }
  }

  if (out.data && typeof out.data === "object" && out.data !== null) {
    const data = { ...(out.data as Record<string, unknown>) };
    let dataChanged = false;
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (typeof value === "string" && looksLikeUrl(value)) {
        const scrubbed = scrubUrlForReplay(value);
        if (scrubbed !== value) {
          data[key] = scrubbed;
          dataChanged = true;
        }
      }
    }
    if (dataChanged) {
      out.data = data;
      changed = true;
    }
  }

  return changed ? out : payload;
}

function looksLikeUrl(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith("/") && (t.includes("?") || t.includes("#") || t.includes("/projects/"))) {
    return true;
  }
  return false;
}

/**
 * Replay-facing URL scrub: strip auth secrets, then strip query/hash and redact
 * dynamic path segments (same posture as ordinary Sentry URL sanitisation).
 * Used only by beforeAddRecordingEvent custom-event path (not initialUrl).
 */
export function scrubUrlForReplay(url: string): string {
  const afterAuth = sanitizeAuthCallbackHref(url);
  return sanitizeSentryUrl(afterAuth);
}
