/**
 * IOS-READINESS-2B-4 — native auth lifecycle structural invariants.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const lifecycle = "src/lib/auth-query-lifecycle.ts";
const useAuth = "src/hooks/useAuth.ts";
const authed = "src/routes/_authed.tsx";
const nativeLifecycle = "src/features/auth/presentation/nativeAuthIdentityLifecycle.ts";
const useOAuth = "src/features/auth/presentation/hooks/useOAuthSignIn.ts";
const useSignOut = "src/features/auth/presentation/hooks/useSignOut.ts";
const readSession = "src/features/auth/infrastructure/readNativeAuthSession.ts";
const signOutNative = "src/features/auth/infrastructure/signOutNativeSession.ts";
const nativeClient = "src/platform/supabase/native.ts";

test("per-QC controller API exists and reuses applyAuthQueryCacheTransition", () => {
  const src = read(lifecycle);
  assert.match(src, /getAuthIdentityTransitionController/);
  assert.match(src, /class AuthIdentityTransitionController/);
  assert.match(src, /observe\s*\(/);
  assert.match(src, /commitKnown\s*\(/);
  assert.match(src, /runSerialized(?:<[^>]*>)?\s*\(/);
  assert.match(src, /WeakMap/);
  assert.match(src, /applyAuthQueryCacheTransition/);
  assert.doesNotMatch(src, /getNativeSupabase|@capacitor|Keychain|supabase-js/);
});

test("native AUTH query is observer-only (enabled false)", () => {
  const src = read(useAuth);
  assert.match(src, /enabled:\s*!isNative/);
  assert.match(src, /Native auth identity must not fetch via React Query/);
  assert.match(src, /observeNativeAuthIdentity/);
  assert.match(src, /ensureNativeAuthIdentitySettled/);
  assert.match(src, /signOutNativeAuthIdentity/);
  assert.match(src, /appStateChange/);
  assert.doesNotMatch(src, /NATIVE_SIGNOUT_UNAVAILABLE|Sign out is not available in this native/);
});

test("controller is sole native AUTH publisher — no bare setQueryData in OAuth", () => {
  const oauth = read(useOAuth);
  assert.match(oauth, /completeAndPublishNativeOAuth/);
  assert.doesNotMatch(oauth, /setQueryData\s*\(\s*AUTH_USER_QUERY_KEY/);
  assert.doesNotMatch(oauth, /setQueryData\s*\(/);

  const lifecycleSrc = read(nativeLifecycle);
  assert.match(lifecycleSrc, /runSerialized|observeNativeAuthIdentity/);
  assert.match(lifecycleSrc, /ensureNativeAuthIdentitySettled/);
  assert.match(lifecycleSrc, /nativeSettlements|WeakMap/);
  assert.match(lifecycleSrc, /Native sign-out requires AuthProvider-bound QueryClient/);
  assert.doesNotMatch(lifecycleSrc, /setQueryData/);
  // Unbound path must not clear Keychain alone
  const unbound = lifecycleSrc.match(/signOutNativeAuthIdentityFromBoundClient[\s\S]*?^}/m);
  assert.ok(unbound);
  assert.doesNotMatch(unbound[0] ?? "", /signOutNativeSession\(\)/);
});

test("native gate uses observeNativeAuthIdentity with route context queryClient", () => {
  const src = read(authed);
  assert.match(src, /observeNativeAuthIdentity/);
  assert.match(src, /import\(["']@\/features\/auth["']\)/);
  assert.match(src, /context\.queryClient/);
  assert.doesNotMatch(src, /getNativeSupabase|mapNativeSupabaseUser/);
  assert.match(src, /getCurrentUserServerFn/);
});

test("infrastructure has no QueryClient; local signOut scope", () => {
  assert.match(read(readSession), /indeterminate/);
  assert.doesNotMatch(read(readSession), /from\s+["']@tanstack\/react-query["']/);
  assert.doesNotMatch(read(readSession), /setQueryData\s*\(/);
  assert.match(read(signOutNative), /scope:\s*["']local["']/);
  assert.doesNotMatch(read(signOutNative), /from\s+["']@\/lib\/auth["']/);
  assert.doesNotMatch(read(signOutNative), /from\s+["']@tanstack\/react-query["']/);
});

test("autoRefreshToken remains false; no new lib/hooks files for 2B-4", () => {
  assert.match(read(nativeClient), /autoRefreshToken:\s*false/);
  assert.equal(existsSync(join(root, "src/lib/resolve-native-auth-identity.ts")), false);
  assert.equal(existsSync(join(root, "src/hooks/useNativeAuth.ts")), false);
});

test("useSignOut converges native via lifecycle without shell edits or useQueryClient", () => {
  const src = read(useSignOut);
  assert.match(src, /signOutNativeAuthIdentityFromBoundClient/);
  assert.match(src, /signOutSession/);
  assert.match(src, /isNativePlatform/);
  // Strip comments — docstrings may mention the forbidden API by name.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /useQueryClient/);
});
