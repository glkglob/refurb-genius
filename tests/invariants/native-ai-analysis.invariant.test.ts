/**
 * NATIVE-AI-ANALYSIS-1 invariant: native Analysis uses Bearer/Keychain
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

test("NATIVE-AI-ANALYSIS-1 required files exist", () => {
  for (const rel of [
    "src/features/ai-upload/presentation/analyzePhotosForClient.ts",
    "src/features/ai-upload/presentation/mobileAnalysisRun.server.ts",
    "src/features/ai-upload/infrastructure/runAuthenticatedPhotoAnalysis.server.ts",
    "src/platform/http/mobile-analysis-run.ts",
  ]) {
    assert.equal(existsSync(join(ROOT, rel)), true, rel);
  }
});

test("native Analysis dispatch never statically uses createServerFn", () => {
  const dispatch = read("src/features/ai-upload/presentation/analyzePhotosForClient.ts");
  assert.match(dispatch, /Capacitor\.isNativePlatform/);
  assert.match(dispatch, /runPhotoAnalysisNative/);
  assert.match(dispatch, /import\(\s*["']@\/platform\/http\/mobile-analysis-run["']\s*\)/);
  assert.match(dispatch, /import\(\s*["']\.\/serverFns["']\s*\)/);
  assert.doesNotMatch(dispatch, /import\s+[^;]*from\s+["']\.\/serverFns["']/);
  assert.doesNotMatch(dispatch, /\bcreateServerFn\b/);
  assert.doesNotMatch(dispatch, /requireUser/);
  assert.doesNotMatch(dispatch, /createSupabaseServerClient/);

  const provider = read("src/features/ai-upload/presentation/photo-analysis.provider.ts");
  assert.match(provider, /analyzePhotosForClient/);
  assert.doesNotMatch(provider, /from\s+["']\.\/serverFns["']/);
  assert.doesNotMatch(provider, /runPhotoAnalysisServerFn/);

  const retry = read("src/features/ai-upload/presentation/retryWeakAnalyses.ts");
  assert.match(retry, /analyzePhotosForClient/);
  assert.match(retry, /isNativePlatform/);
  assert.doesNotMatch(retry, /from\s+["']\.\/serverFns["']/);
  assert.doesNotMatch(retry, /runPhotoAnalysisServerFn/);
});

test("web Analysis serverFn still exists and delegates to the shared runner", () => {
  const serverFns = read("src/features/ai-upload/presentation/serverFns.ts");
  assert.match(serverFns, /createServerFn/);
  assert.match(serverFns, /requireServerAuth/);
  assert.match(serverFns, /runAuthenticatedPhotoAnalysis/);
  assert.match(serverFns, /catalogueMode:\s*"requested"/);
  assert.match(serverFns, /ai-vision\.adapter\.server/);
  assert.doesNotMatch(serverFns, /checkRateLimit/);
});

test("shared runner owns one rate-limit, Analysis ceiling, and JIT batches", () => {
  const runner = read(
    "src/features/ai-upload/infrastructure/runAuthenticatedPhotoAnalysis.server.ts",
  );
  assert.match(runner, /checkRateLimit/);
  assert.match(runner, /rateLimitKeyForUser/);
  assert.match(runner, /MAX_ANALYSIS_PHOTOS = 30/);
  assert.match(runner, /MAX_PHOTOS_PER_VISION_BATCH = 10/);
  assert.doesNotMatch(runner, /MAX_PHOTOS_PER_BATCH/);
  assert.doesNotMatch(runner, /MAX_PROJECT_PHOTOS/);
  assert.match(runner, /signAuthorizedPhotoBatch/);
  assert.match(runner, /assertProductionRoomAnalysisList/);
  assert.match(runner, /assertAnalysisProvenance/);
});

test("canonical resolution is injected and does not hide a cookie client", () => {
  const resolve = read("src/features/ai-upload/infrastructure/resolveAuthorizedPhotos.server.ts");
  assert.match(resolve, /supabase: PhotoAnalysisAuthClient/);
  assert.match(resolve, /catalogueMode/);
  assert.match(resolve, /signAuthorizedPhotoBatch/);
  assert.match(resolve, /createSignedUrl/);
  assert.match(resolve, /AI_SIGNED_URL_TTL_SECONDS = 300/);
  assert.match(resolve, /PROJECT_PHOTOS_BUCKET/);
  assert.doesNotMatch(resolve, /getPublicUrl/);
  assert.doesNotMatch(resolve, /service_role/);
});

test("mobile Analysis API is Bearer-only and strict-bodied", () => {
  const api = read("src/platform/http/mobile-api.server.ts");
  assert.match(api, /MOBILE_ANALYSIS_RUN_PATHNAME/);
  assert.match(api, /handleMobileAnalysisRun/);
  assert.match(api, /features\/ai-upload\/presentation\/mobileAnalysisRun\.server/);
  assert.doesNotMatch(api, /runAuthenticatedPhotoAnalysis/);

  const handler = read("src/features/ai-upload/presentation/mobileAnalysisRun.server.ts");
  assert.match(handler, /requireMobileBearer/);
  assert.match(handler, /catalogueMode:\s*"exact"/);
  assert.match(handler, /\.strict\(\)/);
  assert.doesNotMatch(handler, /requireUser/);
  assert.doesNotMatch(handler, /createSupabaseServerClient/);
  assert.doesNotMatch(handler, /pip-auth/);
  assert.doesNotMatch(handler, /checkRateLimit/);
});

test("native persistence stays out of SELECT-only native-room-analyses", () => {
  const selectOnly = read("src/platform/supabase/native-room-analyses.ts");
  assert.doesNotMatch(selectOnly, /\.rpc\(/);

  const repo = read(
    "src/features/ai-upload/infrastructure/repositories/room-analysis.repository.ts",
  );
  assert.match(repo, /replace_project_room_analyses/);
  assert.match(repo, /getNativeSupabase/);
  assert.match(repo, /import\(["']@\/platform\/supabase\/native["']\)/);
  assert.doesNotMatch(repo, /import\s+[^;]*from\s+["']@\/platform\/supabase\/native["']/);
});

test("production RoomAnalysis validator is transport-independent", () => {
  const validation = read("src/features/ai-upload/domain/validation.ts");
  assert.match(validation, /assertProductionRoomAnalysisList/);
  assert.match(validation, /productionRoomAnalysisSchema/);
  assert.match(validation, /photo_id: z\.string\(\)\.uuid\(\)/);
  assert.match(validation, /productionAnalysisSourceSchema/);
  assert.match(validation, /retrievalUrl/);
  assert.doesNotMatch(validation, /\bcreateServerFn\b/);
  assert.doesNotMatch(validation, /from\s+["']\.\/serverFns["']/);
});

test("NATIVE-AI-ANALYSIS-1 does not mutate frozen auth/session/Redesign surfaces", () => {
  const auth = read("src/lib/auth.ts");
  assert.doesNotMatch(auth, /analyzePhotosForClient/);
  assert.doesNotMatch(auth, /MOBILE_ANALYSIS_RUN/);

  const redesign = read("src/features/ai-design/presentation/mobileRedesignGenerate.server.ts");
  assert.match(redesign, /handleMobileRedesignGenerate/);

  const nativeAnalyses = read("src/platform/supabase/native-room-analyses.ts");
  assert.match(nativeAnalyses, /listRoomAnalysesNative/);
});
