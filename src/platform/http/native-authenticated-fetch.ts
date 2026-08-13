/**
 * Canonical native authenticated HTTPS fetch (IOS-READINESS-2C-1).
 *
 * native Keychain session → Bearer → Production VITE_PUBLIC_URL + path
 *
 * - Absolute HTTPS only
 * - Authorization header only (never URL/query)
 * - At most one 401-triggered refresh + one retry
 * - Never logs Authorization or token values
 */
import { Capacitor } from "@capacitor/core";
import { NativeHttpError } from "./errors";
import { joinProductionApiUrl, resolveProductionApiOrigin } from "./origin";
import { tryGetNativeAccessToken } from "./native-access-token";

export type NativeAuthenticatedFetchInit = Omit<RequestInit, "body"> & {
  /** JSON body; sets Content-Type: application/json when provided. */
  json?: unknown;
  /** Raw body when not using `json`. */
  body?: BodyInit | null;
  /** Injected fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override origin resolution (tests only). */
  origin?: string;
};

function reasonToError(reason: string): NativeHttpError {
  if (reason === "signed_out") {
    return new NativeHttpError("Not authenticated", { code: "signed_out", status: 401 });
  }
  if (reason === "refresh_failed") {
    return new NativeHttpError("Session refresh failed", { code: "refresh_failed", status: 401 });
  }
  if (reason === "not_native") {
    return new NativeHttpError("Native authenticated fetch requires a native platform", {
      code: "unauthorized",
    });
  }
  return new NativeHttpError("Authentication state is indeterminate", {
    code: "indeterminate",
    status: 401,
  });
}

function buildHeaders(
  init: NativeAuthenticatedFetchInit | undefined,
  accessToken: string,
): Headers {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init?.json !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/**
 * Perform an authenticated HTTPS request to the Production mobile API surface.
 *
 * @param path - Root-relative path, e.g. `/api/mobile/v1/session/ping`
 */
export async function nativeAuthenticatedFetch(
  path: string,
  init?: NativeAuthenticatedFetchInit,
): Promise<Response> {
  if (!Capacitor.isNativePlatform()) {
    throw new NativeHttpError("Native authenticated fetch requires a native platform", {
      code: "unauthorized",
    });
  }

  const origin = init?.origin ?? resolveProductionApiOrigin();
  const url = joinProductionApiUrl(origin, path);

  // Defense: never allow token-looking query injection via path (join already rejects schemes).
  if (url.includes("access_token=") || url.includes("refresh_token=")) {
    throw new NativeHttpError("Refusing request URL that appears to embed credentials", {
      code: "origin_invalid",
    });
  }

  const fetchImpl = init?.fetchImpl ?? fetch;
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.json !== undefined ? JSON.stringify(init.json) : (init?.body ?? undefined);

  const tokenResult = await tryGetNativeAccessToken();
  if (!tokenResult.ok) {
    throw reasonToError(tokenResult.reason);
  }

  const execute = async (accessToken: string): Promise<Response> => {
    const headers = buildHeaders(init, accessToken);
    try {
      return await fetchImpl(url, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        signal: init?.signal,
        // credentials intentionally omitted (Bearer, not cookies)
      });
    } catch (cause) {
      throw new NativeHttpError("Network request failed", { code: "network", cause });
    }
  };

  let response = await execute(tokenResult.accessToken);

  if (response.status === 401) {
    // At most one refresh + one retry after 401.
    const refreshed = await tryGetNativeAccessToken({ forceRefresh: true });
    if (!refreshed.ok) {
      throw reasonToError(refreshed.reason);
    }
    response = await execute(refreshed.accessToken);
    // No further retry loop even if still 401.
  }

  return response;
}

/**
 * POST JSON helper that parses JSON and maps non-OK responses to NativeHttpError
 * without embedding Authorization material.
 */
export async function nativeAuthenticatedJson<T>(
  path: string,
  init?: Omit<NativeAuthenticatedFetchInit, "method"> & { method?: string },
): Promise<T> {
  const response = await nativeAuthenticatedFetch(path, {
    ...init,
    method: init?.method ?? "POST",
  });

  if (response.status === 401) {
    throw new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 });
  }

  if (!response.ok) {
    throw new NativeHttpError(`Request failed with status ${response.status}`, {
      code: "http_error",
      status: response.status,
    });
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new NativeHttpError("Invalid JSON response", { code: "invalid_response", cause });
  }
}
