/**
 * PUBLIC-BETA-SECURITY-CSRF-1A — TanStack Start serverFn CSRF control.
 *
 * Custom `src/start.ts` disables automatic CSRF middleware installation.
 * This invariant locks the explicit restoration of createCsrfMiddleware
 * for serverFn handlers with strict same-origin defaults.
 *
 * Static checks: configuration contract in src/start.ts.
 * Behavioural probes: framework isCsrfRequestAllowed under the same
 * option shape used by production (no widened origins / no missing-origin allow).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isCsrfRequestAllowed } from "@tanstack/react-start";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const START_TS = join(ROOT, "src/start.ts");

const TRUSTED_ORIGIN = "https://app.refurbgenius.info";
const TRUSTED_URL = `${TRUSTED_ORIGIN}/_serverFn/example`;
const SIBLING_ORIGIN = "https://evil.refurbgenius.info";
const FOREIGN_ORIGIN = "https://attacker.example";

/** Strict options matching production: filter is configuration-only here. */
const STRICT_CSRF_OPTS = {} as const;

function readStartSource(): string {
  assert.ok(existsSync(START_TS), "src/start.ts must exist");
  return readFileSync(START_TS, "utf8");
}

function mockCtx(headers: Record<string, string | null>, url = TRUSTED_URL) {
  return {
    request: new Request(url, {
      method: "POST",
      headers: Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => entry[1] != null),
      ),
    }),
    handlerType: "serverFn" as const,
  };
}

// ---------------------------------------------------------------------------
// Static configuration contract
// ---------------------------------------------------------------------------

test("start-csrf — createCsrfMiddleware is imported from @tanstack/react-start", () => {
  const source = readStartSource();
  assert.match(
    source,
    /import\s*\{[^}]*\bcreateCsrfMiddleware\b[^}]*\}\s*from\s*["']@tanstack\/react-start["']/,
    "createCsrfMiddleware must be imported from @tanstack/react-start",
  );
});

test("start-csrf — csrf middleware filters to serverFn only", () => {
  const source = readStartSource();
  assert.match(
    source,
    /createCsrfMiddleware\s*\(\s*\{[\s\S]*?filter\s*:\s*\([^)]*\)\s*=>\s*[^}]*handlerType\s*===\s*["']serverFn["']/,
    "createCsrfMiddleware must use filter handlerType === 'serverFn'",
  );
});

test("start-csrf — CSRF precedes errorMiddleware in requestMiddleware", () => {
  const source = readStartSource();
  const middlewareArray = source.match(/requestMiddleware\s*:\s*\[([^\]]+)\]/);
  assert.ok(middlewareArray, "requestMiddleware array must be present");
  const list = middlewareArray[1];
  const csrfIdx = list.indexOf("csrfMiddleware");
  const errorIdx = list.indexOf("errorMiddleware");
  assert.ok(csrfIdx >= 0, "csrfMiddleware must appear in requestMiddleware");
  assert.ok(errorIdx >= 0, "errorMiddleware must appear in requestMiddleware");
  assert.ok(
    csrfIdx < errorIdx,
    "csrfMiddleware must precede errorMiddleware so 403s are not reclassified as 500s",
  );
});

test("start-csrf — errorMiddleware / Sentry capture behaviour is preserved", () => {
  const source = readStartSource();
  assert.match(source, /captureServerException/, "Sentry capture must remain in errorMiddleware");
  assert.match(source, /renderErrorPage/, "branded error page must remain");
  assert.match(source, /start-middleware/, "Sentry source tag must remain");
  assert.match(
    source,
    /statusCode/,
    "statusCode rethrow path must remain so HTTP errors are not swallowed",
  );
});

/** Extract the createCsrfMiddleware({ ... }) options object body. */
function extractCsrfOptionsBody(source: string): string {
  const match = source.match(/createCsrfMiddleware\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(match, "createCsrfMiddleware({ ... }) call must be present");
  return match[1];
}

test("start-csrf — CSRF options stay filter-only (no bypass / origin widening)", () => {
  const source = readStartSource();
  const opts = extractCsrfOptionsBody(source);

  // Only the serverFn filter is authorised; every other option must remain default.
  assert.match(opts, /filter\s*:/, "filter must be configured");
  assert.ok(
    !/\ballowRequestsWithoutOriginCheck\b/.test(opts),
    "must not set allowRequestsWithoutOriginCheck",
  );
  assert.ok(!/\borigin\s*:/.test(opts), "must not override origin matcher");
  assert.ok(!/\bsecFetchSite\s*:/.test(opts), "must not widen secFetchSite");
  assert.ok(!/\breferer\s*:/.test(opts), "must not override referer policy");
  assert.ok(!/\bfailureResponse\s*:/.test(opts), "must not custom-handle failure response");
  assert.ok(!/\ballowedOrigins\b/.test(opts), "must not declare allowedOrigins");
});

test("start-csrf — no mobile WebView origin exceptions in start.ts", () => {
  const source = readStartSource();
  // Strip block comments so documentation cannot false-positive.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/capacitor/i.test(code), "must not add Capacitor CSRF exceptions");
  assert.ok(!/ionic/i.test(code), "must not add Ionic CSRF exceptions");
  assert.ok(!/capacitor:\/\//i.test(code), "must not allow capacitor:// origins");
  assert.ok(!/localhost:\d+/i.test(code), "must not hardcode localhost origin exceptions");
});

test("start-csrf — createStart still exports startInstance", () => {
  const source = readStartSource();
  assert.match(source, /export\s+const\s+startInstance\s*=\s*createStart/);
});

// ---------------------------------------------------------------------------
// Behavioural probes — framework default validation (same shape as production)
// ---------------------------------------------------------------------------

test("start-csrf probe — same-origin Sec-Fetch-Site is allowed", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ "Sec-Fetch-Site": "same-origin" }) as never,
  );
  assert.equal(allowed, true);
});

test("start-csrf probe — cross-site Sec-Fetch-Site is denied", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ "Sec-Fetch-Site": "cross-site" }) as never,
  );
  assert.equal(allowed, false);
});

test("start-csrf probe — same-site sibling Sec-Fetch-Site is denied", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ "Sec-Fetch-Site": "same-site" }) as never,
  );
  assert.equal(allowed, false);
});

test("start-csrf probe — foreign Origin is denied", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ Origin: FOREIGN_ORIGIN }) as never,
  );
  assert.equal(allowed, false);
});

test("start-csrf probe — sibling subdomain Origin is denied", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ Origin: SIBLING_ORIGIN }) as never,
  );
  assert.equal(allowed, false);
});

test("start-csrf probe — trusted Origin is allowed when Sec-Fetch-Site absent", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ Origin: TRUSTED_ORIGIN }) as never,
  );
  assert.equal(allowed, true);
});

test("start-csrf probe — foreign Referer is denied", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ Referer: `${FOREIGN_ORIGIN}/attack` }) as never,
  );
  assert.equal(allowed, false);
});

test("start-csrf probe — sibling subdomain Referer is denied", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ Referer: `${SIBLING_ORIGIN}/page` }) as never,
  );
  assert.equal(allowed, false);
});

test("start-csrf probe — trusted Referer is allowed when higher signals absent", async () => {
  const allowed = await isCsrfRequestAllowed(
    STRICT_CSRF_OPTS,
    mockCtx({ Referer: `${TRUSTED_ORIGIN}/projects` }) as never,
  );
  assert.equal(allowed, true);
});

test("start-csrf probe — missing Origin/Referer/Sec-Fetch-Site is denied", async () => {
  const allowed = await isCsrfRequestAllowed(STRICT_CSRF_OPTS, mockCtx({}) as never);
  assert.equal(allowed, false);
});

test("start-csrf probe — missing-origin bypass is not enabled by production opts", async () => {
  // Explicitly prove production-shaped opts (empty) do not admit missing metadata.
  const denied = await isCsrfRequestAllowed({}, mockCtx({}) as never);
  assert.equal(denied, false);

  // Contrast: the dangerous option would allow it — production must not use it.
  const withBypass = await isCsrfRequestAllowed(
    { allowRequestsWithoutOriginCheck: true },
    mockCtx({}) as never,
  );
  assert.equal(withBypass, true, "sanity: dangerous option would allow missing metadata");

  const opts = extractCsrfOptionsBody(readStartSource());
  assert.ok(
    !/\ballowRequestsWithoutOriginCheck\b/.test(opts),
    "production createCsrfMiddleware opts must not enable the missing-origin bypass",
  );
});
