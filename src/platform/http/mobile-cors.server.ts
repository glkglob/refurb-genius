/**
 * Narrow CORS for `/api/mobile/*` only (IOS-READINESS-2C-1).
 *
 * - Allow Origin: capacitor://localhost only (initial)
 * - Methods: OPTIONS, POST
 * - Headers: Authorization, Content-Type, Accept
 * - credentials: never
 * - Does not touch serverFn CSRF
 */

/** Allowed browser/WebView origins for mobile API CORS. */
export const MOBILE_API_ALLOWED_ORIGINS = ["capacitor://localhost"] as const;

export const MOBILE_API_ALLOWED_METHODS = "OPTIONS, POST" as const;
export const MOBILE_API_ALLOWED_HEADERS = "Authorization, Content-Type, Accept" as const;

export function isMobileApiAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  return (MOBILE_API_ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

/**
 * Build CORS headers for a mobile API response.
 * Foreign / missing origins receive **no** Access-Control-Allow-Origin.
 */
export function buildMobileCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (isMobileApiAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", MOBILE_API_ALLOWED_METHODS);
    headers.set("Access-Control-Allow-Headers", MOBILE_API_ALLOWED_HEADERS);
    headers.set("Access-Control-Max-Age", "86400");
    // Explicitly do not set Access-Control-Allow-Credentials
  }
  return headers;
}

/** Unauthenticated preflight — no private data. */
export function mobileCorsPreflightResponse(request: Request): Response {
  const headers = buildMobileCorsHeaders(request);
  headers.set("Content-Length", "0");
  // Always 204 for OPTIONS under the mobile namespace; CORS headers only when origin allowed.
  return new Response(null, { status: 204, headers });
}

export function withMobileCors(request: Request, response: Response): Response {
  const cors = buildMobileCorsHeaders(request);
  const headers = new Headers(response.headers);
  cors.forEach((value, key) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
