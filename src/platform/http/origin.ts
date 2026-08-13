/**
 * Production HTTPS API origin for native privileged HTTP (IOS-READINESS-2C-1).
 *
 * Canonical source: VITE_PUBLIC_URL (public, non-secret).
 * No second backend-origin env var unless this contract is proven insufficient.
 */
import { NativeHttpError } from "./errors";

/** Normalize trailing slash; returns origin-only string (scheme + host [+ port]). */
export function normalizeHttpsOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new NativeHttpError("Production API origin is empty", { code: "origin_invalid" });
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new NativeHttpError("Production API origin is not a valid URL", {
      code: "origin_invalid",
    });
  }

  if (url.protocol !== "https:") {
    throw new NativeHttpError("Production API origin must use HTTPS", { code: "origin_not_https" });
  }

  // Reject credentials / userinfo in origin configuration.
  if (url.username || url.password) {
    throw new NativeHttpError("Production API origin must not include credentials", {
      code: "origin_invalid",
    });
  }

  return url.origin;
}

/**
 * Resolve the absolute Production API origin for native authenticated fetch.
 * Throws NativeHttpError when missing/invalid/non-HTTPS.
 */
export function resolveProductionApiOrigin(
  envValue: string | undefined = import.meta.env.VITE_PUBLIC_URL as string | undefined,
): string {
  if (typeof envValue !== "string" || envValue.trim() === "") {
    throw new NativeHttpError("VITE_PUBLIC_URL is not configured", { code: "origin_missing" });
  }
  return normalizeHttpsOrigin(envValue);
}

/**
 * Join Production origin with an absolute path (must start with `/`).
 * Never accepts query-embedded secrets; callers must not put tokens in path/query.
 */
export function joinProductionApiUrl(origin: string, path: string): string {
  if (!path.startsWith("/")) {
    throw new NativeHttpError("API path must be absolute (start with /)", {
      code: "origin_invalid",
    });
  }
  // Guard accidental full-URL injection into path.
  if (path.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    throw new NativeHttpError("API path must be a root-relative path", { code: "origin_invalid" });
  }
  return `${origin.replace(/\/+$/, "")}${path}`;
}
