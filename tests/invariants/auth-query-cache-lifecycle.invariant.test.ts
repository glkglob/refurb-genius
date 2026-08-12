/**
 * C4c-4 — Auth / React Query cache lifecycle invariant.
 *
 * Structural enforcement that the root auth bridge owns identity-boundary
 * isolation via the per-QueryClient controller + applyAuthQueryCacheTransition,
 * and that unrestricted queryClient.clear() is not introduced as an ad-hoc logout path.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const USE_AUTH = "src/hooks/useAuth.ts";
const LIFECYCLE = "src/lib/auth-query-lifecycle.ts";

function readSrc(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return readFileSync(full, "utf8");
}

test("auth lifecycle — canonical AUTH_USER_QUERY_KEY and lifecycle module exist", () => {
  const useAuth = readSrc(USE_AUTH);
  const lifecycle = readSrc(LIFECYCLE);

  assert.match(
    useAuth,
    /export\s+const\s+AUTH_USER_QUERY_KEY\s*=\s*\[\s*["']auth["']\s*,\s*["']currentUser["']\s*\]/,
    'useAuth must export exact AUTH_USER_QUERY_KEY = ["auth", "currentUser"]',
  );
  assert.match(
    lifecycle,
    /export\s+(async\s+)?function\s+applyAuthQueryCacheTransition/,
    "lifecycle module must export applyAuthQueryCacheTransition",
  );
  assert.match(lifecycle, /function\s+isAuthUserQueryKey/, "must export isAuthUserQueryKey");
  assert.match(lifecycle, /UNRESOLVED_AUTH_IDENTITY/, "must define unresolved sentinel");
  assert.match(lifecycle, /cancelQueries/, "lifecycle must cancel non-auth queries on boundary");
  assert.match(lifecycle, /removeQueries/, "lifecycle must remove non-auth queries on boundary");
  assert.match(
    lifecycle,
    /getAuthIdentityTransitionController/,
    "lifecycle must export per-QueryClient controller factory",
  );
  // Must not use unrestricted clear as primary strategy
  assert.equal(
    /queryClient\.clear\s*\(/.test(lifecycle),
    false,
    "lifecycle must not call queryClient.clear()",
  );
});

test("auth lifecycle — single root bridge in AuthProvider (not every useAuth)", () => {
  const useAuth = readSrc(USE_AUTH);

  assert.match(
    useAuth,
    /from\s+["']@\/lib\/auth-query-lifecycle["']/,
    "useAuth module must import lifecycle helpers from @/lib/auth-query-lifecycle",
  );
  assert.match(
    useAuth,
    /getAuthIdentityTransitionController/,
    "module must use per-QueryClient controller",
  );
  assert.match(useAuth, /auth\.onChange/, "module must install auth.onChange root bridge");
  assert.match(
    useAuth,
    /function\s+useAuthQueryCacheLifecycleBridge/,
    "lifecycle bridge must be a dedicated hook (single coordinator)",
  );

  // Bridge must be mounted from AuthProvider, not from the public useAuth body.
  const providerMatch = useAuth.match(
    /export\s+function\s+AuthProvider\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(providerMatch, "expected AuthProvider body");
  const providerBody = providerMatch[1] ?? "";
  assert.match(providerBody, /useAuth\s*\(\s*\)/, "AuthProvider must prime useAuth()");
  assert.match(
    providerBody,
    /useAuthQueryCacheLifecycleBridge\s*\(\s*\)/,
    "AuthProvider must mount the single lifecycle bridge",
  );

  // Exactly one auth.onChange registration, inside the dedicated bridge hook.
  // Strip comments — docs may mention auth.onChange by name.
  const useAuthCode = useAuth
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const onChangeMatches = useAuthCode.match(/auth\.onChange/g) ?? [];
  assert.equal(
    onChangeMatches.length,
    1,
    "exactly one auth.onChange registration must exist (single coordinator)",
  );
  const bridgeMatch = useAuth.match(
    /function\s+useAuthQueryCacheLifecycleBridge\s*\(\s*\)\s*:\s*void\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(bridgeMatch, "expected useAuthQueryCacheLifecycleBridge body");
  assert.match(
    bridgeMatch[1] ?? "",
    /auth\.onChange/,
    "auth.onChange must live inside useAuthQueryCacheLifecycleBridge",
  );
  assert.match(
    bridgeMatch[1] ?? "",
    /commitKnown/,
    "web onChange must publish via controller.commitKnown",
  );

  // signOut must not bare-set AUTH null
  const signOutMatch = useAuth.match(
    /const\s+signOut\s*=\s*async\s*\(\s*\)\s*:\s*Promise<void>\s*=>\s*\{([\s\S]*?)\n\s*\};/,
  );
  assert.ok(signOutMatch, "expected signOut implementation");
  const signOutBody = signOutMatch[1] ?? "";
  assert.match(signOutBody, /auth\.signOut|signOutNativeAuthIdentity/, "signOut must clear session");
  assert.equal(
    /setQueryData\s*\(\s*AUTH_USER_QUERY_KEY\s*,\s*null\s*\)/.test(signOutBody),
    false,
    "signOut must not only write AUTH null (isolation owned by root coordinator)",
  );
});

test("auth lifecycle — no ad-hoc queryClient.clear in auth hook or routes auth entry", () => {
  const useAuth = readSrc(USE_AUTH);
  assert.equal(
    /queryClient\.clear\s*\(/.test(useAuth),
    false,
    "useAuth must not call queryClient.clear()",
  );

  // Spot-check common auth surfaces do not introduce clear()
  for (const rel of [
    "src/features/auth/presentation/AuthExperience.tsx",
    "src/routes/auth_.callback.tsx",
    "src/components/Sidebar.tsx",
  ]) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, "utf8");
    assert.equal(
      /queryClient\.clear\s*\(/.test(text),
      false,
      `${rel} must not introduce queryClient.clear()`,
    );
  }
});
