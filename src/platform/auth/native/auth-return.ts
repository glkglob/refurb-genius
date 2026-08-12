/**
 * Native auth return-channel lifecycle (IOS-READINESS-2B-1).
 *
 * Inbound URL scaffolding only:
 * - listen for appUrlOpen on native platforms
 * - inspect cold-start getLaunchUrl
 * - accept only frozen auth return surfaces
 * - no code/token_hash exchange, no session write, no secret logging
 */
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/** Custom URL scheme registered in Info.plist (no `://`). */
export const AUTH_RETURN_CUSTOM_SCHEME = "com.refurbgenius.app";

/**
 * Full logical custom-scheme return surface (scheme + authority + path).
 * Frozen: `com.refurbgenius.app://auth/callback`
 */
export const AUTH_RETURN_CUSTOM_CALLBACK = "com.refurbgenius.app://auth/callback";

/** Universal Link host (Associated Domains scaffold). */
export const AUTH_RETURN_UNIVERSAL_HOST = "www.refurbgenius.info";

/** Universal Link path for email magic-link / recovery return (2B contract). */
export const AUTH_RETURN_UNIVERSAL_PATH = "/auth/native-callback";

/**
 * WHATWG host + pathname for `com.refurbgenius.app://auth/callback`.
 * Protocol host is `auth`; pathname is `/callback` (not `/auth/callback`).
 */
const AUTH_RETURN_CUSTOM_HOST = "auth";
const AUTH_RETURN_CUSTOM_PATHNAME = "/callback";

export type AuthReturnSurface =
  | { kind: "custom-scheme"; url: string }
  | { kind: "universal-link"; url: string };

export type AuthReturnHandler = (surface: AuthReturnSurface) => void;

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Reject credentials and explicit ports — never rewrite invalid variants into valid. */
function hasForbiddenAuthorityExtras(url: URL): boolean {
  if (url.username !== "" || url.password !== "") return true;
  if (url.port !== "") return true;
  return false;
}

/**
 * Reject path tricks that WHATWG URL would normalize away (e.g. `/../`, `/./`,
 * encoded dots). Inspect the pre-query raw string only — do not log secrets.
 */
function hasPathNormalizationTricks(raw: string): boolean {
  const pathAndAuthority = raw.split(/[?#]/, 1)[0] ?? raw;
  const lower = pathAndAuthority.toLowerCase();
  if (lower.includes("/../") || lower.includes("/./")) return true;
  if (lower.endsWith("/..") || lower.endsWith("/.")) return true;
  // Encoded dot-segment tricks (%2e = '.')
  if (/%2e/i.test(pathAndAuthority)) return true;
  return false;
}

/**
 * Classify an inbound open URL as a frozen auth return surface, or null.
 * Accepts only exact canonical forms (no trailing-slash or authority variants).
 * Does not read or log query/fragment contents for side effects.
 */
export function classifyAuthReturnUrl(raw: string): AuthReturnSurface | null {
  if (hasPathNormalizationTricks(raw)) return null;

  const url = tryParseUrl(raw);
  if (!url) return null;
  if (hasForbiddenAuthorityExtras(url)) return null;

  // Custom scheme exact: com.refurbgenius.app://auth/callback[?query][#frag]
  // WHATWG: protocol = "com.refurbgenius.app:", hostname = "auth", pathname = "/callback"
  if (url.protocol === `${AUTH_RETURN_CUSTOM_SCHEME}:`) {
    if (url.hostname === AUTH_RETURN_CUSTOM_HOST && url.pathname === AUTH_RETURN_CUSTOM_PATHNAME) {
      return { kind: "custom-scheme", url: raw };
    }
    return null;
  }

  // Universal Link exact: https://www.refurbgenius.info/auth/native-callback[?query][#frag]
  if (url.protocol === "https:" && url.hostname === AUTH_RETURN_UNIVERSAL_HOST) {
    if (url.pathname === AUTH_RETURN_UNIVERSAL_PATH) {
      return { kind: "universal-link", url: raw };
    }
  }

  return null;
}

/**
 * Start native inbound auth-return listeners.
 * Handler is inert by default (2B-1): later slices attach exchange/session logic.
 *
 * @returns cleanup that removes the appUrlOpen listener
 */
export async function startNativeAuthReturnLifecycle(
  onReturn: AuthReturnHandler = () => {
    // 2B-1: intentionally no-op. Exchange + session establishment are 2B-3+.
  },
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  const deliver = (raw: string | undefined | null) => {
    if (!raw) return;
    const surface = classifyAuthReturnUrl(raw);
    if (!surface) {
      // Unrelated deep link — ignore. Do not log the URL.
      return;
    }
    onReturn(surface);
  };

  try {
    const launch = await App.getLaunchUrl();
    deliver(launch?.url);
  } catch {
    // getLaunchUrl can fail when no launch URL exists; safe to ignore.
  }

  const listener = await App.addListener("appUrlOpen", (event) => {
    deliver(event.url);
  });

  return () => {
    void listener.remove();
  };
}
