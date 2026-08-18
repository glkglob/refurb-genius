/**
 * Focused tests for IOS-BUILD-PROVENANCE-1 library.
 *
 * Run: node --test scripts/lib/ios-build-provenance.test.mjs
 *   or: pnpm test:ios-provenance
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BUILD_IDENTITY,
  BUILD_MODE,
  IosProvenanceError,
  ORIGIN_AUTHORITY_MODULE,
  PROVENANCE_FILE_NAME,
  SCHEMA_VERSION,
  SIDECAR_SCHEMA_VERSION,
  SUPABASE_AUTHORITY_MODULE,
  assertAuthorityChunkContainsOrigin,
  assertAuthorityChunkContainsSupabaseConfig,
  assertAuthorityChunkContainsSupabaseUrl,
  assertAuthorityChunkListedInFiles,
  assertCapacitorConfigHasNoServerUrl,
  assertValidProvenance,
  assertNoServerUrl,
  assertProvenanceHasNoSecrets,
  assertRollupMapHandoff,
  assertSafeWebDirRelativePath,
  assertSourceSha,
  assertSourceTreeClean,
  assertSpaReady,
  buildProvenanceManifest,
  classifyGitPorcelain,
  collectLocalAssetRefs,
  computeBundleFingerprint,
  createChildEnv,
  hashWebDirFiles,
  isOriginAuthorityModule,
  isSupabaseAuthorityModule,
  normalizeHttpsOrigin,
  normalizeRollupModuleId,
  resolveIosApiOrigin,
  resolveIosSupabasePublicKey,
  resolveIosSupabaseRuntimeConfig,
  resolveIosSupabaseUrl,
  serializeProvenance,
  sha256Bytes,
  verifyAppBundle,
  verifyCopiedBundle,
  writeProvenanceArtifacts,
} from "./ios-build-provenance.mjs";

const PRODUCTION = "https://www.refurbgenius.info";
const PREVIEW = "https://refurb-genius-git-fix-example.vercel.app";
const SOURCE_SHA = "487dd4d0c6298200060ef79b05fa1b0e7b5677ad";
const SUPABASE_URL = "https://ios-provenance-test.supabase.co";
const SUPABASE_ANON_KEY = "ios-anon-test-key";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ios_test_key";

function codeOf(fn) {
  try {
    fn();
    throw new Error("expected IosProvenanceError");
  } catch (err) {
    assert.ok(err instanceof IosProvenanceError, String(err));
    return err.code;
  }
}

function fixtureRoot() {
  return mkdtempSync(join(tmpdir(), "ios-provenance-"));
}

function writeTree(root, files) {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, contents);
  }
}

function bakedJs(origin, supabaseUrl = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
  return `const origin=${JSON.stringify(origin)};const supabaseUrl=${JSON.stringify(supabaseUrl)};const supabaseKey=${JSON.stringify(key)};`;
}

function supabaseIdentity(chunkRel = "assets/app.js", key = SUPABASE_ANON_KEY) {
  return {
    supabaseUrl: SUPABASE_URL,
    supabasePublicKeySha256: sha256Bytes(key),
    supabaseAuthorityChunk: chunkRel,
  };
}

function fingerprintOf(
  files,
  origin = PRODUCTION,
  chunkRel = "assets/app.js",
  key = SUPABASE_ANON_KEY,
) {
  return computeBundleFingerprint({
    sourceSha: SOURCE_SHA,
    apiOrigin: origin,
    files,
    originAuthorityChunk: chunkRel,
    ...supabaseIdentity(chunkRel, key),
  });
}

function manifestOf(
  files,
  origin = PRODUCTION,
  chunkRel = "assets/app.js",
  key = SUPABASE_ANON_KEY,
) {
  return buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: origin,
    files,
    originAuthorityChunk: chunkRel,
    ...supabaseIdentity(chunkRel, key),
  });
}

test("missing API origin fails origin_missing", () => {
  assert.equal(
    codeOf(() => resolveIosApiOrigin(undefined)),
    "origin_missing",
  );
  assert.equal(
    codeOf(() => resolveIosApiOrigin(null)),
    "origin_missing",
  );
});

test("blank and whitespace API origin fail origin_missing", () => {
  assert.equal(
    codeOf(() => resolveIosApiOrigin("")),
    "origin_missing",
  );
  assert.equal(
    codeOf(() => resolveIosApiOrigin("   ")),
    "origin_missing",
  );
});

test("malformed origin fails origin_invalid", () => {
  assert.equal(
    codeOf(() => resolveIosApiOrigin("not-a-url")),
    "origin_invalid",
  );
  assert.equal(
    codeOf(() => normalizeHttpsOrigin("https://user:pass@evil.example")),
    "origin_invalid",
  );
});

test("non-HTTPS origin fails origin_not_https", () => {
  assert.equal(
    codeOf(() => resolveIosApiOrigin("http://www.refurbgenius.info")),
    "origin_not_https",
  );
});

test("Production HTTPS origin is accepted and normalized", () => {
  assert.equal(resolveIosApiOrigin(PRODUCTION), PRODUCTION);
  assert.equal(resolveIosApiOrigin(`${PRODUCTION}/`), PRODUCTION);
  assert.equal(resolveIosApiOrigin(`${PRODUCTION}///`), PRODUCTION);
});

test("explicit HTTPS Preview origin is accepted", () => {
  assert.equal(resolveIosApiOrigin(PREVIEW), PREVIEW);
  assert.equal(resolveIosApiOrigin(`${PREVIEW}/preview-path`), PREVIEW);
});

test("missing Supabase URL fails supabase_url_missing", () => {
  assert.equal(
    codeOf(() => resolveIosSupabaseUrl(undefined)),
    "supabase_url_missing",
  );
  assert.equal(
    codeOf(() => resolveIosSupabaseUrl("")),
    "supabase_url_missing",
  );
  assert.equal(
    codeOf(() => resolveIosSupabaseUrl("   ")),
    "supabase_url_missing",
  );
});

test("invalid and non-HTTPS Supabase URL fail closed", () => {
  assert.equal(
    codeOf(() => resolveIosSupabaseUrl("not-a-url")),
    "supabase_url_invalid",
  );
  assert.equal(
    codeOf(() => resolveIosSupabaseUrl("http://ios-provenance-test.supabase.co")),
    "supabase_url_not_https",
  );
  assert.equal(
    codeOf(() => resolveIosSupabaseUrl("https://user:pass@ios-provenance-test.supabase.co")),
    "supabase_url_invalid",
  );
});

test("HTTPS Supabase URL is accepted and normalized", () => {
  assert.equal(resolveIosSupabaseUrl(SUPABASE_URL), SUPABASE_URL);
  assert.equal(resolveIosSupabaseUrl(`${SUPABASE_URL}/`), SUPABASE_URL);
});

test("missing public key fails supabase_key_missing", () => {
  assert.equal(
    codeOf(() =>
      resolveIosSupabasePublicKey({
        VITE_SUPABASE_URL: SUPABASE_URL,
      }),
    ),
    "supabase_key_missing",
  );
});

test("blank public key fails supabase_key_missing", () => {
  assert.equal(
    codeOf(() =>
      resolveIosSupabasePublicKey({
        VITE_SUPABASE_ANON_KEY: "   ",
      }),
    ),
    "supabase_key_missing",
  );
  assert.equal(
    codeOf(() =>
      resolveIosSupabasePublicKey({
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ),
    "supabase_key_missing",
  );
});

test("conflicting anon and publishable keys fail supabase_key_conflict", () => {
  assert.equal(
    codeOf(() =>
      resolveIosSupabasePublicKey({
        VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
      }),
    ),
    "supabase_key_conflict",
  );
});

test("equal anon and publishable keys are valid", () => {
  assert.equal(
    resolveIosSupabasePublicKey({
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      VITE_SUPABASE_PUBLISHABLE_KEY: `  ${SUPABASE_ANON_KEY}  `,
    }),
    SUPABASE_ANON_KEY,
  );
});

test("valid anon-key path is selected", () => {
  assert.equal(
    resolveIosSupabasePublicKey({ VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY }),
    SUPABASE_ANON_KEY,
  );
});

test("valid publishable-key path is selected", () => {
  assert.equal(
    resolveIosSupabasePublicKey({ VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY }),
    SUPABASE_PUBLISHABLE_KEY,
  );
});

test("service_role selected key is rejected", () => {
  assert.equal(
    codeOf(() =>
      resolveIosSupabasePublicKey({
        VITE_SUPABASE_ANON_KEY: "planted-service_role-marker",
      }),
    ),
    "supabase_key_forbidden",
  );
  assert.equal(
    codeOf(() =>
      resolveIosSupabasePublicKey({
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_ios_test_key",
      }),
    ),
    "supabase_key_forbidden",
  );
});

test("VITE_SUPABASE_SERVICE_ROLE_KEY is rejected and never a fallback", () => {
  assert.equal(
    codeOf(() =>
      resolveIosSupabaseRuntimeConfig({
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        VITE_SUPABASE_SERVICE_ROLE_KEY: "planted-service-role",
      }),
    ),
    "supabase_service_role_forbidden",
  );
  assert.equal(
    codeOf(() =>
      resolveIosSupabaseRuntimeConfig({
        SUPABASE_SERVICE_ROLE_KEY: "must-not-be-used",
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      }),
    ),
    "supabase_url_missing",
  );
});

test("NEXT_PUBLIC and unprefixed names are not certification authority", () => {
  assert.equal(
    codeOf(() =>
      resolveIosSupabaseRuntimeConfig({
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      }),
    ),
    "supabase_url_missing",
  );
});

test("dotenv files cannot silently supply certification authority", () => {
  const root = fixtureRoot();
  writeFileSync(
    join(root, ".env.local"),
    `VITE_SUPABASE_URL=${SUPABASE_URL}\nVITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}\n`,
  );
  assert.equal(
    codeOf(() => resolveIosSupabaseRuntimeConfig({ VITE_PUBLIC_URL: PRODUCTION })),
    "supabase_url_missing",
  );
});

test("source SHA must be a full 40-char hex", () => {
  assert.equal(assertSourceSha(SOURCE_SHA), SOURCE_SHA);
  assert.equal(
    codeOf(() => assertSourceSha("487dd4d")),
    "source_sha_invalid",
  );
  assert.equal(
    codeOf(() => assertSourceSha("")),
    "source_sha_invalid",
  );
});

test("dirty-tree: tracked modifications fail", () => {
  assert.equal(
    codeOf(() => assertSourceTreeClean(" M src/platform/http/origin.ts\n")),
    "dirty_tracked",
  );
  assert.equal(
    codeOf(() => assertSourceTreeClean("M  package.json\n")),
    "dirty_tracked",
  );
});

test("dirty-tree: non-ignored untracked source fails", () => {
  assert.equal(
    codeOf(() => assertSourceTreeClean("?? scripts/lib/ios-build-provenance.mjs\n")),
    "dirty_untracked",
  );
});

test("dirty-tree: ignored porcelain and empty status pass", () => {
  assert.doesNotThrow(() => assertSourceTreeClean(""));
  assert.doesNotThrow(() => assertSourceTreeClean("!! dist/ios/client/index.html\n"));
  const classified = classifyGitPorcelain(
    "!! dist/ios/client/index.html\n?? src/new.ts\n M a.ts\n",
  );
  assert.deepEqual(classified.untracked, ["src/new.ts"]);
  assert.deepEqual(classified.tracked, ["a.ts"]);
});

test("createChildEnv sets canonical Vite values without mutating parent", () => {
  const parent = {
    PATH: "/bin",
    VITE_PUBLIC_URL: "https://stale.example/",
    VITE_SUPABASE_URL: "https://stale.supabase.co/",
    VITE_SUPABASE_ANON_KEY: "stale-anon",
    VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_SERVICE_ROLE_KEY: "",
  };
  const child = createChildEnv(parent, PRODUCTION, {
    supabaseUrl: `${SUPABASE_URL}/`,
    supabasePublicKey: SUPABASE_ANON_KEY,
  });
  assert.equal(parent.VITE_PUBLIC_URL, "https://stale.example/");
  assert.equal(parent.VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY);
  assert.equal(child.VITE_PUBLIC_URL, PRODUCTION);
  assert.equal(child.VITE_SUPABASE_URL, SUPABASE_URL);
  assert.equal(child.VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY);
  assert.equal(child.VITE_SUPABASE_PUBLISHABLE_KEY, "");
  assert.equal(child.VITE_SUPABASE_SERVICE_ROLE_KEY, "");
  assert.equal(Object.hasOwn(child, "VITE_SUPABASE_PUBLISHABLE_KEY"), true);
  assert.equal(Object.hasOwn(child, "VITE_SUPABASE_SERVICE_ROLE_KEY"), true);
  assert.equal(child.PATH, "/bin");
  assert.notEqual(child, parent);
});

test("fingerprint is stable and excludes provenance self-hash", () => {
  const root = fixtureRoot();
  writeTree(root, {
    "index.html": "<html>shell</html>",
    "assets/app.js": "console.log(1)",
    [PROVENANCE_FILE_NAME]: '{"should":"be ignored"}',
  });
  const files = hashWebDirFiles(root);
  assert.ok(!Object.hasOwn(files, PROVENANCE_FILE_NAME));
  assert.equal(Object.keys(files).sort().join(","), "assets/app.js,index.html");
  const a = fingerprintOf(files);
  const b = fingerprintOf(files);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("fingerprint changes when a file byte or Supabase identity changes", () => {
  const filesA = { "index.html": sha256Bytes("one"), "assets/app.js": sha256Bytes("x") };
  const filesB = { "index.html": sha256Bytes("two"), "assets/app.js": sha256Bytes("x") };
  assert.notEqual(fingerprintOf(filesA), fingerprintOf(filesB));
  assert.notEqual(
    fingerprintOf(filesA),
    computeBundleFingerprint({
      sourceSha: SOURCE_SHA,
      apiOrigin: PRODUCTION,
      files: filesA,
      originAuthorityChunk: "assets/app.js",
      supabaseUrl: "https://other-ios-provenance-test.supabase.co",
      supabasePublicKeySha256: sha256Bytes(SUPABASE_ANON_KEY),
      supabaseAuthorityChunk: "assets/app.js",
    }),
  );
  assert.notEqual(
    fingerprintOf(filesA),
    computeBundleFingerprint({
      sourceSha: SOURCE_SHA,
      apiOrigin: PRODUCTION,
      files: filesA,
      originAuthorityChunk: "assets/app.js",
      supabaseUrl: SUPABASE_URL,
      supabasePublicKeySha256: sha256Bytes(SUPABASE_PUBLISHABLE_KEY),
      supabaseAuthorityChunk: "assets/app.js",
    }),
  );
});

test("golden manifest records SHA, origin, Supabase identity and has no secrets", () => {
  const files = {
    "index.html": sha256Bytes("<html/>"),
    "assets/app.js": sha256Bytes("origin"),
  };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: `${PRODUCTION}/`,
    files,
    originAuthorityChunk: "assets/app.js",
    supabaseUrl: `${SUPABASE_URL}/`,
    supabasePublicKeySha256: sha256Bytes(SUPABASE_ANON_KEY),
    supabaseAuthorityChunk: "assets/app.js",
  });
  assert.equal(manifest.sourceSha, SOURCE_SHA);
  assert.equal(manifest.apiOrigin, PRODUCTION);
  assert.equal(manifest.supabaseUrl, SUPABASE_URL);
  assert.equal(manifest.supabasePublicKeySha256, sha256Bytes(SUPABASE_ANON_KEY));
  assert.equal(manifest.buildIdentity, BUILD_IDENTITY);
  assert.equal(manifest.buildMode, BUILD_MODE);
  assert.equal(manifest.originAuthorityChunk, "assets/app.js");
  assert.equal(manifest.supabaseAuthorityChunk, "assets/app.js");
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.bundleFingerprint, fingerprintOf(files));
  assert.doesNotThrow(() => assertProvenanceHasNoSecrets(manifest));
  const json = serializeProvenance(manifest);
  assert.doesNotMatch(json, /process\.env|service_role|timestamp|createdAt/i);
  assert.doesNotMatch(json, new RegExp(SUPABASE_ANON_KEY));
  assert.doesNotMatch(json, /supabasePublicKeySource|anon|publishable/);
});

test("planted secrets in a manifest are rejected", () => {
  const files = {
    "index.html": sha256Bytes("x"),
    "assets/app.js": sha256Bytes("y"),
  };
  const manifest = manifestOf(files);
  assert.equal(
    codeOf(() => assertProvenanceHasNoSecrets({ ...manifest, OPENAI_API_KEY: "planted" })),
    "provenance_secrets",
  );
  assert.equal(
    codeOf(() => assertProvenanceHasNoSecrets({ ...manifest, token: "secret" })),
    "provenance_secrets",
  );
  assert.equal(
    codeOf(() =>
      assertProvenanceHasNoSecrets({
        ...manifest,
        apiOrigin: "https://example.invalid/?marker=service_role",
      }),
    ),
    "provenance_secrets",
  );
});

test("copied-bundle exact equality plus Capacitor extras passes without raw key env", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  const chunk = bakedJs(PRODUCTION);
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": chunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files);
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": chunk,
    "cordova.js": "/* capacitor */",
    "cordova_plugins.js": "[]",
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(
    capPath,
    JSON.stringify({ appId: "com.refurbgenius.app", webDir: "dist/ios/client" }),
  );
  const verified = verifyCopiedBundle({
    webDir,
    publicDir,
    expectedProvenancePath: expectedPath,
    capacitorConfigPath: capPath,
  });
  assert.equal(verified.bundleFingerprint, manifest.bundleFingerprint);
  assert.equal(verified.supabasePublicKeySha256, sha256Bytes(SUPABASE_ANON_KEY));
});

test("stale copied native assets fail", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  const chunk = bakedJs(PRODUCTION);
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/new.js"></script></html>`,
    "assets/new.js": chunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files, PRODUCTION, "assets/new.js");
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/new.js"></script></html>`,
    "assets/new.js": chunk,
    "assets/old-stale.js": "old",
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(capPath, JSON.stringify({ appId: "com.refurbgenius.app" }));
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: expectedPath,
        capacitorConfigPath: capPath,
      }),
    ),
    "stale_native_assets",
  );
});

test("hash mismatch fails copied_bundle_mismatch", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": bakedJs(PRODUCTION),
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files);
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": "STALE",
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(capPath, JSON.stringify({ appId: "com.refurbgenius.app" }));
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: expectedPath,
        capacitorConfigPath: capPath,
      }),
    ),
    "copied_bundle_mismatch",
  );
});

test("missing provenance fails", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  writeTree(webDir, { "index.html": "x" });
  writeTree(publicDir, { "index.html": "x" });
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: join(root, "missing.json"),
        capacitorConfigPath: join(root, "capacitor.config.json"),
      }),
    ),
    "provenance_missing",
  );
});

test("server.url on generated Capacitor config fails", () => {
  assert.equal(
    codeOf(() => assertNoServerUrl({ server: { url: "https://www.refurbgenius.info" } }, "cfg")),
    "server_url_forbidden",
  );
  assert.equal(
    codeOf(() => assertNoServerUrl({ server: { url: "" } }, "cfg")),
    "server_url_forbidden",
  );
  assert.doesNotThrow(() => assertNoServerUrl({ appId: "com.refurbgenius.app" }, "cfg"));
  assert.doesNotThrow(() => assertNoServerUrl({ server: { iosScheme: "dark" } }, "cfg"));

  const root = fixtureRoot();
  const cfg = join(root, "capacitor.config.json");
  writeFileSync(cfg, JSON.stringify({ server: { url: "https://example.invalid" } }));
  assert.equal(
    codeOf(() => assertCapacitorConfigHasNoServerUrl(cfg, "cfg")),
    "server_url_forbidden",
  );
});

test("verify-app-bundle accepts a local App.app and rejects server.url / missing provenance", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const expectedPath = join(root, "expected.json");
  const chunk = bakedJs(PREVIEW);
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": chunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files, PREVIEW, "assets/a.js");
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });

  const app = join(root, "App.app");
  writeTree(join(app, "public"), {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": chunk,
    "cordova.js": "/* cap */",
  });
  writeFileSync(join(app, "public", PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(
    join(app, "capacitor.config.json"),
    JSON.stringify({ appId: "com.refurbgenius.app" }),
  );

  const verified = verifyAppBundle({ appPath: app, expectedProvenancePath: expectedPath });
  assert.equal(verified.apiOrigin, PREVIEW);
  assert.equal(verified.sourceSha, SOURCE_SHA);
  assert.equal(verified.supabaseUrl, SUPABASE_URL);

  writeFileSync(
    join(app, "capacitor.config.json"),
    JSON.stringify({ server: { url: "https://www.refurbgenius.info" } }),
  );
  assert.equal(
    codeOf(() => verifyAppBundle({ appPath: app, expectedProvenancePath: expectedPath })),
    "server_url_forbidden",
  );

  const bare = join(root, "Bare.app");
  mkdirSync(join(bare, "public"), { recursive: true });
  writeFileSync(join(bare, "capacitor.config.json"), JSON.stringify({}));
  assert.equal(
    codeOf(() => verifyAppBundle({ appPath: bare, expectedProvenancePath: expectedPath })),
    "app_bundle_provenance_missing",
  );
});

test("HTML local refs must exist and ignore remote URLs", () => {
  const root = fixtureRoot();
  writeTree(root, {
    "index.html": `<html><script src="./assets/app.js"></script><link href="https://fonts.example/x.css" /></html>`,
  });
  assert.equal(
    codeOf(() => assertSpaReady(root)),
    "spa_incomplete",
  );
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "assets/app.js"), "ok");
  assert.doesNotThrow(() => assertSpaReady(root));
  assert.deepEqual(collectLocalAssetRefs(readFileSync(join(root, "index.html"), "utf8")), [
    "./assets/app.js",
  ]);
});

test("authority chunk path traversal and missing origin fail", () => {
  assert.equal(
    codeOf(() => assertSafeWebDirRelativePath("../secret.js")),
    "origin_authority_chunk_invalid",
  );
  assert.equal(
    codeOf(() => assertSafeWebDirRelativePath("/tmp/abs.js")),
    "origin_authority_chunk_invalid",
  );
  assert.equal(
    codeOf(() => assertSafeWebDirRelativePath("file:///tmp/x.js")),
    "origin_authority_chunk_invalid",
  );
  const root = fixtureRoot();
  writeTree(root, { "assets/app.js": "no origin here" });
  assert.equal(
    codeOf(() => assertAuthorityChunkContainsOrigin(root, "assets/missing.js", PRODUCTION)),
    "origin_authority_chunk_missing",
  );
  assert.equal(
    codeOf(() => assertAuthorityChunkContainsOrigin(root, "assets/app.js", PRODUCTION)),
    "origin_not_baked",
  );
});

test("origin only in an unrelated Production literal is not authority proof", () => {
  const root = fixtureRoot();
  writeTree(root, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": "export const other = 1",
    "assets/root.js": `const SITE=${JSON.stringify(PRODUCTION)}`,
  });
  assert.equal(
    codeOf(() => assertAuthorityChunkContainsOrigin(root, "assets/app.js", PRODUCTION)),
    "origin_not_baked",
  );
});

test("prepare-time Supabase bake proof requires URL and exact selected key", () => {
  const root = fixtureRoot();
  writeTree(root, {
    "assets/app.js": `const supabaseUrl=${JSON.stringify(SUPABASE_URL)};`,
  });
  assert.equal(
    codeOf(() =>
      assertAuthorityChunkContainsSupabaseConfig(
        root,
        "assets/app.js",
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      ),
    ),
    "supabase_key_not_baked",
  );
  writeFileSync(join(root, "assets/app.js"), bakedJs(PRODUCTION, SUPABASE_URL, SUPABASE_ANON_KEY));
  assert.doesNotThrow(() =>
    assertAuthorityChunkContainsSupabaseConfig(
      root,
      "assets/app.js",
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    ),
  );
  assert.equal(
    codeOf(() =>
      assertAuthorityChunkContainsSupabaseConfig(
        root,
        "assets/app.js",
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
      ),
    ),
    "supabase_key_not_baked",
  );
});

test("copied authority chunk missing from public fails copied_bundle_mismatch", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": bakedJs(PRODUCTION),
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files);
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(capPath, JSON.stringify({ appId: "com.refurbgenius.app" }));
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: expectedPath,
        capacitorConfigPath: capPath,
      }),
    ),
    "copied_bundle_mismatch",
  );
});

test("copied hashed authority chunk without apiOrigin fails origin_not_baked", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  const hashedChunk = `export const other = 1;const supabaseUrl=${JSON.stringify(SUPABASE_URL)};`;
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": hashedChunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files);
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": hashedChunk,
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(capPath, JSON.stringify({ appId: "com.refurbgenius.app" }));
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: expectedPath,
        capacitorConfigPath: capPath,
      }),
    ),
    "origin_not_baked",
  );
});

test("copied hashed authority chunk without supabaseUrl fails supabase_url_not_baked", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  const hashedChunk = `const origin=${JSON.stringify(PRODUCTION)};`;
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": hashedChunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files);
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": hashedChunk,
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(capPath, JSON.stringify({ appId: "com.refurbgenius.app" }));
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: expectedPath,
        capacitorConfigPath: capPath,
      }),
    ),
    "supabase_url_not_baked",
  );
});

test("App.app hashed authority chunk without apiOrigin fails origin_not_baked", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const expectedPath = join(root, "expected.json");
  const hashedChunk = `export const other = 1;const supabaseUrl=${JSON.stringify(SUPABASE_URL)};`;
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": hashedChunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files, PREVIEW, "assets/a.js");
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  const app = join(root, "App.app");
  writeTree(join(app, "public"), {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": hashedChunk,
  });
  writeFileSync(join(app, "public", PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(join(app, "capacitor.config.json"), JSON.stringify({}));
  assert.equal(
    codeOf(() => verifyAppBundle({ appPath: app, expectedProvenancePath: expectedPath })),
    "origin_not_baked",
  );
});

test("App.app hashed authority chunk without supabaseUrl fails supabase_url_not_baked", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const expectedPath = join(root, "expected.json");
  const hashedChunk = `const origin=${JSON.stringify(PREVIEW)};`;
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": hashedChunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files, PREVIEW, "assets/a.js");
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  const app = join(root, "App.app");
  writeTree(join(app, "public"), {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": hashedChunk,
  });
  writeFileSync(join(app, "public", PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(join(app, "capacitor.config.json"), JSON.stringify({}));
  assert.equal(
    codeOf(() => verifyAppBundle({ appPath: app, expectedProvenancePath: expectedPath })),
    "supabase_url_not_baked",
  );
});

test("copied supabase authority tamper fails copied_bundle_mismatch via certified bytes", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  const chunk = bakedJs(PRODUCTION);
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": chunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = manifestOf(files);
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": bakedJs(PRODUCTION, SUPABASE_URL, "tampered-ios-anon-test-key"),
  });
  writeFileSync(join(publicDir, PROVENANCE_FILE_NAME), serializeProvenance(manifest));
  writeFileSync(capPath, JSON.stringify({ appId: "com.refurbgenius.app" }));
  assert.equal(
    codeOf(() =>
      verifyCopiedBundle({
        webDir,
        publicDir,
        expectedProvenancePath: expectedPath,
        capacitorConfigPath: capPath,
      }),
    ),
    "copied_bundle_mismatch",
  );
});

test("tampering originAuthorityChunk to another hashed file breaks fingerprint validation", () => {
  const files = {
    "assets/app.js": sha256Bytes("x"),
    "assets/other.js": sha256Bytes("y"),
  };
  const manifest = manifestOf(files);
  const tampered = { ...manifest, originAuthorityChunk: "assets/other.js" };
  assert.equal(
    codeOf(() => assertValidProvenance(tampered)),
    "provenance_mismatch",
  );
});

test("tampering supabase identity fields breaks fingerprint validation", () => {
  const files = {
    "assets/app.js": sha256Bytes("x"),
    "assets/other.js": sha256Bytes("y"),
  };
  const manifest = manifestOf(files);
  assert.equal(
    codeOf(() =>
      assertValidProvenance({
        ...manifest,
        supabaseAuthorityChunk: "assets/other.js",
      }),
    ),
    "provenance_mismatch",
  );
  assert.equal(
    codeOf(() =>
      assertValidProvenance({
        ...manifest,
        supabaseUrl: "https://other-ios-provenance-test.supabase.co",
      }),
    ),
    "provenance_mismatch",
  );
  assert.equal(
    codeOf(() =>
      assertValidProvenance({
        ...manifest,
        supabasePublicKeySha256: sha256Bytes("other-ios-anon-test-key"),
      }),
    ),
    "provenance_mismatch",
  );
});

test("schemaVersion other than 3 is provenance_invalid", () => {
  const files = {
    "index.html": sha256Bytes("<html/>"),
    "assets/app.js": sha256Bytes("origin"),
  };
  const manifest = manifestOf(files);
  assert.equal(manifest.schemaVersion, SCHEMA_VERSION);
  assert.equal(
    codeOf(() => assertValidProvenance({ ...manifest, schemaVersion: 2 })),
    "provenance_invalid",
  );
  assert.equal(
    codeOf(() => assertValidProvenance({ ...manifest, schemaVersion: 4 })),
    "provenance_invalid",
  );
});

test("originAuthorityChunk and supabaseAuthorityChunk must exist in the hashed files map", () => {
  const files = { "index.html": sha256Bytes("<html/>") };
  assert.equal(
    codeOf(() => assertAuthorityChunkListedInFiles("assets/app.js", files)),
    "provenance_invalid",
  );
  assert.equal(
    codeOf(() =>
      buildProvenanceManifest({
        sourceSha: SOURCE_SHA,
        apiOrigin: PRODUCTION,
        files,
        originAuthorityChunk: "assets/app.js",
        ...supabaseIdentity("assets/app.js"),
      }),
    ),
    "provenance_invalid",
  );
  const listed = {
    "index.html": sha256Bytes("<html/>"),
    "assets/app.js": sha256Bytes("origin"),
  };
  const manifest = manifestOf(listed);
  const unlisted = {
    ...manifest,
    files: { "index.html": listed["index.html"] },
  };
  assert.equal(
    codeOf(() => assertValidProvenance(unlisted)),
    "provenance_invalid",
  );
});

test("sidecar handoff requires schema v2, both modules, baked flags, and safe chunks", () => {
  const root = fixtureRoot();
  writeTree(root, {
    "assets/app.js": bakedJs(PRODUCTION),
  });
  const valid = {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    originModule: ORIGIN_AUTHORITY_MODULE,
    originAuthorityChunk: "assets/app.js",
    originFoundInChunk: true,
    supabaseModule: SUPABASE_AUTHORITY_MODULE,
    supabaseAuthorityChunk: "assets/app.js",
    supabaseUrlFoundInChunk: true,
    supabasePublicKeyFoundInChunk: true,
  };
  assert.deepEqual(assertRollupMapHandoff(valid, root, PRODUCTION, SUPABASE_URL), {
    originAuthorityChunk: "assets/app.js",
    supabaseAuthorityChunk: "assets/app.js",
  });

  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff({ ...valid, schemaVersion: 1 }, root, PRODUCTION, SUPABASE_URL),
    ),
    "origin_module_unmapped",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, schemaVersion: undefined },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "origin_module_unmapped",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, originModule: "src/routes/__root.tsx" },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "origin_module_unmapped",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, supabaseModule: "src/platform/supabase/native.ts" },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "supabase_module_unmapped",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, originFoundInChunk: false },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "origin_not_baked",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, supabaseUrlFoundInChunk: false },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "supabase_url_not_baked",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, supabasePublicKeyFoundInChunk: false },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "supabase_key_not_baked",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, originAuthorityChunk: "../secret.js" },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "origin_authority_chunk_invalid",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff(
        { ...valid, supabasePublicKey: SUPABASE_ANON_KEY },
        root,
        PRODUCTION,
        SUPABASE_URL,
      ),
    ),
    "origin_module_unmapped",
  );
});

test("Rollup module IDs are normalized before origin.ts and env.ts matching", () => {
  assert.equal(isOriginAuthorityModule("/repo/src/platform/http/origin.ts"), true);
  assert.equal(isOriginAuthorityModule("file:///repo/src/platform/http/origin.ts?v=1"), true);
  assert.equal(isOriginAuthorityModule("/repo/src/routes/__root.tsx"), false);
  assert.equal(isSupabaseAuthorityModule("/repo/packages/supabase/src/env.ts"), true);
  assert.equal(isSupabaseAuthorityModule("file:///repo/packages/supabase/src/env.ts?v=1"), true);
  assert.equal(isSupabaseAuthorityModule("/repo/src/platform/supabase/native.ts"), false);
  assert.match(
    normalizeRollupModuleId("file:///tmp/src/platform/http/origin.ts?query=1"),
    /origin\.ts$/,
  );
});

test("copied/App verification does not reverse the public-key SHA-256", () => {
  const root = fixtureRoot();
  writeTree(root, { "assets/app.js": bakedJs(PRODUCTION) });
  assert.doesNotThrow(() =>
    assertAuthorityChunkContainsSupabaseUrl(root, "assets/app.js", SUPABASE_URL),
  );
  assert.match(sha256Bytes(SUPABASE_ANON_KEY), /^[0-9a-f]{64}$/);
  assert.equal(bakedJs(PRODUCTION).includes(sha256Bytes(SUPABASE_ANON_KEY)), false);
});
