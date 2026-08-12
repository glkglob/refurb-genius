/**
 * IOS-READINESS-2B-3/4 — native OAuth completion boundary invariants.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const extract = "src/features/auth/infrastructure/extractNativeOAuthAuthorizationCode.ts";
const exchange = "src/features/auth/infrastructure/exchangeNativeAuthCode.ts";
const complete = "src/features/auth/application/completeNativeOAuthSignIn.ts";
const mapper = "src/features/auth/application/mapNativeSupabaseUser.ts";
const failure = "src/features/auth/application/mapNativeOAuthFailure.ts";
const useOAuth = "src/features/auth/presentation/hooks/useOAuthSignIn.ts";
const useAuth = "src/hooks/useAuth.ts";
const authed = "src/routes/_authed.tsx";
const native = "src/platform/supabase/native.ts";
const capacitor = "capacitor.config.ts";
const start = "src/start.ts";
const readSession = "src/features/auth/infrastructure/readNativeAuthSession.ts";
const nativeLifecycle = "src/features/auth/presentation/nativeAuthIdentityLifecycle.ts";

test("native exchange uses getNativeSupabase only", () => {
  const src = read(exchange);
  assert.match(src, /getNativeSupabase/);
  assert.match(src, /exchangeCodeForSession/);
  assert.doesNotMatch(
    src,
    /platform\/supabase\/browser|platform\/supabase\/_client|exchangeAuthCode/,
  );
});

test("application completion is QueryClient/React free", () => {
  const src = read(complete);
  assert.doesNotMatch(src, /@tanstack\/react-query|useQueryClient|QueryClient|AUTH_USER_QUERY_KEY/);
  assert.doesNotMatch(src, /from ["']react["']|useNavigate|toast|logger|trackEvent/);
  assert.doesNotMatch(src, /completeAuthCallback|exchangeAuthCode|getBrowserAuthSession/);
});

test("native modules do not import browser/_client value authority", () => {
  for (const rel of [extract, exchange, complete, mapper, failure, useOAuth, readSession]) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /platform\/supabase\/browser|platform\/supabase\/_client|createBrowserSupabase|pip-auth/,
      rel,
    );
  }
});

test("callback parser rejects token deep-link design", () => {
  const src = read(extract);
  assert.match(src, /token_hash|access_token|refresh_token/);
  assert.match(src, /FORBIDDEN_QUERY_KEYS|searchParams/);
  assert.doesNotMatch(src, /console\.(log|info|debug)/);
});

test("native client keeps autoRefreshToken false", () => {
  const src = read(native);
  assert.match(src, /autoRefreshToken:\s*false/);
  assert.doesNotMatch(src, /autoRefreshToken:\s*true/);
});

test("shared modules do not statically import getNativeSupabase", () => {
  for (const rel of [useAuth, authed, nativeLifecycle]) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /import\s*\{[^}]*getNativeSupabase[^}]*\}\s*from\s*["']@\/platform\/supabase\/native["']/,
      rel,
    );
  }
  // Session read uses dynamic import
  assert.match(read(readSession), /import\(["']@\/platform\/supabase\/native["']\)/);
});

test("no @capacitor/browser or server.url", () => {
  const cap = read(capacitor);
  assert.doesNotMatch(cap, /server\s*:\s*\{[^}]*url/);
  assert.doesNotMatch(cap, /@capacitor\/browser/);

  for (const rel of [useOAuth, complete, exchange, useAuth, authed]) {
    const src = read(rel);
    assert.doesNotMatch(src, /@capacitor\/browser|Browser\.open/, rel);
  }
});

test("strict CSRF remains without capacitor exemption", () => {
  const src = read(start);
  assert.match(src, /createCsrfMiddleware/);
  assert.doesNotMatch(src, /capacitor:\/\//);
});

test("useOAuthSignIn publishes via lifecycle (not bare setQueryData)", () => {
  const src = read(useOAuth);
  assert.match(src, /completeAndPublishNativeOAuth/);
  assert.match(src, /native-authenticated/);
  assert.doesNotMatch(src, /setQueryData\s*\(\s*AUTH_USER_QUERY_KEY/);
  assert.doesNotMatch(src, /kind:\s*["']native-callback["']/);
});

test("useAuth native signOut uses lifecycle; web keeps onChange", () => {
  const src = read(useAuth);
  assert.match(src, /signOutNativeAuthIdentity/);
  assert.match(src, /isNativePlatform/);
  assert.match(src, /auth\.onChange/);
  assert.match(src, /enabled:\s*!isNative/);
});
