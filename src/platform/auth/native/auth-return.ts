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

/** Path for OAuth / ASWebAuthenticationSession custom-scheme return. */
export const AUTH_RETURN_CUSTOM_PATH = "/auth/callback";

/** Universal Link host (Associated Domains scaffold). */
export const AUTH_RETURN_UNIVERSAL_HOST = "www.refurbgenius.info";

/** Universal Link path for email magic-link / recovery return (2B contract). */
export const AUTH_RETURN_UNIVERSAL_PATH = "/auth/native-callback";

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

/**
 * Classify an inbound open URL as a frozen auth return surface, or null.
 * Does not read or log query/fragment contents for side effects.
 */
export function classifyAuthReturnUrl(raw: string): AuthReturnSurface | null {
  const url = tryParseUrl(raw);
  if (!url) return null;

  // Custom scheme: com.refurbgenius.app://auth/callback[?...|#...]
  // WHATWG: protocol = "com.refurbgenius.app:", hostname = "auth", pathname = "/callback"
  if (url.protocol === `${AUTH_RETURN_CUSTOM_SCHEME}:`) {
    const hostAndPath = `${url.hostname}${url.pathname}`.replace(/\/+$/, "") || url.pathname.replace(/\/+$/, "");
    const normalized =
      hostAndPath.startsWith("/") ? hostAndPath.slice(1) : hostAndPath;
    if (normalized === "auth/callback") {
      return { kind: "custom-scheme", url: raw };
    }
    return null;
  }

  // Universal Link: https://www.refurbgenius.info/auth/native-callback[?...]
  if (url.protocol === "https:" && url.hostname === AUTH_RETURN_UNIVERSAL_HOST) {
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === AUTH_RETURN_UNIVERSAL_PATH) {
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
