/**
 * NATIVE-SCOPE-ANALYSIS-1 invariant: native Scope uses Bearer/Keychain
 * authority; web retains cookie serverFn; private Storage stays private.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("NATIVE-SCOPE-ANALYSIS-1 required files exist", () => {
  for (const rel of [
    "src/features/ai-design/presentation/runScopeAnalysisForClient.ts",
    "src/features/ai-design/presentation/mobileScopeAnalyze.server.ts",
    "src/features/ai-design/infrastructure/runAuthenticatedScopeAnalysis.server.ts",
    "src/platform/http/mobile-scope-analyze.ts",
  ]) {
    assert.equal(existsSync(join(ROOT, rel)), true, rel);
  }
});

test("native Scope dispatch never statically uses createServerFn", () => {
  const dispatch = read("src/features/ai-design/presentation/runScopeAnalysisForClient.ts");
  assert.match(dispatch, /Capacitor\.isNativePlatform/);
  assert.match(dispatch, /runScopeAnalysisNative/);
  assert.match(dispatch, /import\(\s*["']@\/platform\/http\/mobile-scope-analyze["']\s*\)/);
  assert.match(dispatch, /import\(\s*["']\.\/serverFns["']\s*\)/);
  assert.doesNotMatch(dispatch, /import\s+[^;]*from\s+["']\.\/serverFns["']/);
  assert.doesNotMatch(dispatch, /\bcreateServerFn\b/);
  assert.doesNotMatch(dispatch, /requireUser/);
  assert.doesNotMatch(dispatch, /createSupabaseServerClient/);
  assert.doesNotMatch(dispatch, /service_role/);

  const hook = read("src/features/ai-design/presentation/hooks/useScopeAnalysis.ts");
  assert.match(hook, /runScopeAnalysisForClient/);
  assert.doesNotMatch(hook, /runScopeAnalysisServerFn/);
});

test("web Scope serverFn still exists and delegates to the shared runner", () => {
  const serverFns = read("src/features/ai-design/presentation/serverFns.ts");
  assert.match(serverFns, /createServerFn/);
  assert.match(serverFns, /requireServerAuth/);
  assert.match(serverFns, /runAuthenticatedScopeAnalysis/);
  assert.doesNotMatch(serverFns, /checkRateLimit/);
  assert.doesNotMatch(serverFns, /ai-scope\.adapter\.server/);
});

test("shared runner owns rate-limit and fail-closed rooms assert", () => {
  const runner = read(
    "src/features/ai-design/infrastructure/runAuthenticatedScopeAnalysis.server.ts",
  );
  assert.match(runner, /checkRateLimit/);
  assert.match(runner, /rateLimitKeyForUser/);
  assert.match(runner, /ai-scope/);
  assert.match(runner, /assertScopeAnalysisResult/);
  assert.match(runner, /ai-scope\.adapter\.server/);
  assert.doesNotMatch(runner, /service_role/);
  assert.doesNotMatch(runner, /getPublicUrl/);
});

test("mobile Scope API is Bearer-only and ignores body userId", () => {
  const api = read("src/platform/http/mobile-api.server.ts");
  assert.match(api, /MOBILE_SCOPE_ANALYZE_PATHNAME/);
  assert.match(api, /handleMobileScopeAnalyze/);
  assert.match(api, /features\/ai-design\/presentation\/mobileScopeAnalyze\.server/);
  assert.doesNotMatch(api, /runAuthenticatedScopeAnalysis/);

  const handler = read("src/features/ai-design/presentation/mobileScopeAnalyze.server.ts");
  assert.match(handler, /requireMobileBearer/);
  assert.match(handler, /resolveAuthoritativeUserId/);
  assert.doesNotMatch(handler, /requireUser/);
  assert.doesNotMatch(handler, /createSupabaseServerClient/);
  assert.doesNotMatch(handler, /pip-auth/);
  assert.doesNotMatch(handler, /checkRateLimit/);
  assert.doesNotMatch(handler, /service_role/);
  assert.doesNotMatch(handler, /getPublicUrl/);
});

test("scope adapter signs storage_path at TTL 300 and does not persist signed URLs", () => {
  const adapter = read("src/features/ai-design/infrastructure/adapters/ai-scope.adapter.server.ts");
  assert.match(adapter, /AI_SIGNED_URL_TTL_SECONDS = 300/);
  assert.match(adapter, /createSignedUrl/);
  assert.match(adapter, /storage_path/);
  assert.doesNotMatch(adapter, /getPublicUrl/);
  assert.doesNotMatch(adapter, /service_role/);
});

test("NATIVE-SCOPE-ANALYSIS-1 does not mutate account deletion or Scope save", () => {
  const deleteHandler = read(
    "src/features/account-deletion/presentation/mobileAccountDelete.server.ts",
  );
  assert.doesNotMatch(deleteHandler, /scope\/analyze/);
  assert.doesNotMatch(deleteHandler, /runScopeAnalysisForClient/);

  const persist = read("src/features/ai-design/presentation/hooks/useScopeAnalysisPersistence.ts");
  assert.doesNotMatch(persist, /runScopeAnalysisForClient/);
  assert.doesNotMatch(persist, /MOBILE_SCOPE_ANALYZE/);
});
