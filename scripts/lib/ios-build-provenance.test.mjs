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
  assertAuthorityChunkContainsOrigin,
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
  normalizeHttpsOrigin,
  normalizeRollupModuleId,
  resolveIosApiOrigin,
  serializeProvenance,
  sha256Bytes,
  verifyAppBundle,
  verifyCopiedBundle,
  writeProvenanceArtifacts,
} from "./ios-build-provenance.mjs";

const PRODUCTION = "https://www.refurbgenius.info";
const PREVIEW = "https://refurb-genius-git-fix-example.vercel.app";
const SOURCE_SHA = "487dd4d0c6298200060ef79b05fa1b0e7b5677ad";

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

test("createChildEnv sets normalized origin without mutating parent", () => {
  const parent = { PATH: "/bin", VITE_PUBLIC_URL: "https://stale.example/" };
  const child = createChildEnv(parent, PRODUCTION);
  assert.equal(parent.VITE_PUBLIC_URL, "https://stale.example/");
  assert.equal(child.VITE_PUBLIC_URL, PRODUCTION);
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
  const a = computeBundleFingerprint({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
  const b = computeBundleFingerprint({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("fingerprint changes when a file byte changes", () => {
  const filesA = { "index.html": sha256Bytes("one") };
  const filesB = { "index.html": sha256Bytes("two") };
  const a = computeBundleFingerprint({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files: filesA,
    originAuthorityChunk: "assets/app.js",
  });
  const b = computeBundleFingerprint({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files: filesB,
    originAuthorityChunk: "assets/app.js",
  });
  assert.notEqual(a, b);
});

test("golden manifest records SHA, origin, identity and has no secrets", () => {
  const files = {
    "index.html": sha256Bytes("<html/>"),
    "assets/app.js": sha256Bytes("origin"),
  };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: `${PRODUCTION}/`,
    files,
    originAuthorityChunk: "assets/app.js",
  });
  assert.equal(manifest.sourceSha, SOURCE_SHA);
  assert.equal(manifest.apiOrigin, PRODUCTION);
  assert.equal(manifest.buildIdentity, BUILD_IDENTITY);
  assert.equal(manifest.buildMode, BUILD_MODE);
  assert.equal(manifest.originAuthorityChunk, "assets/app.js");
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(
    manifest.bundleFingerprint,
    computeBundleFingerprint({
      sourceSha: SOURCE_SHA,
      apiOrigin: PRODUCTION,
      files,
      originAuthorityChunk: "assets/app.js",
    }),
  );
  assert.doesNotThrow(() => assertProvenanceHasNoSecrets(manifest));
  const json = serializeProvenance(manifest);
  assert.doesNotMatch(json, /process\.env|service_role|timestamp|createdAt/i);
});

test("planted secrets in a manifest are rejected", () => {
  const files = {
    "index.html": sha256Bytes("x"),
    "assets/app.js": sha256Bytes("y"),
  };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
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

test("copied-bundle exact equality plus Capacitor extras passes", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": `const origin=${JSON.stringify(PRODUCTION)}`,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": `const origin=${JSON.stringify(PRODUCTION)}`,
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
});

test("stale copied native assets fail", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/new.js"></script></html>`,
    "assets/new.js": `const origin=${JSON.stringify(PRODUCTION)}`,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/new.js",
  });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": `<html><script src="./assets/new.js"></script></html>`,
    "assets/new.js": `const origin=${JSON.stringify(PRODUCTION)}`,
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
    "assets/app.js": `const origin=${JSON.stringify(PRODUCTION)}`,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
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
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": `const origin=${JSON.stringify(PREVIEW)}`,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PREVIEW,
    files,
    originAuthorityChunk: "assets/a.js",
  });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });

  const app = join(root, "App.app");
  writeTree(join(app, "public"), {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": `const origin=${JSON.stringify(PREVIEW)}`,
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

test("copied authority chunk missing from public fails copied_bundle_mismatch", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const publicDir = join(root, "public");
  const expectedPath = join(root, "expected.json");
  const capPath = join(root, "capacitor.config.json");
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": `const origin=${JSON.stringify(PRODUCTION)}`,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
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
  const hashedChunk = "export const other = 1";
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/app.js"></script></html>`,
    "assets/app.js": hashedChunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
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

test("App.app hashed authority chunk without apiOrigin fails origin_not_baked", () => {
  const root = fixtureRoot();
  const webDir = join(root, "web");
  const expectedPath = join(root, "expected.json");
  const hashedChunk = "export const other = 1";
  writeTree(webDir, {
    "index.html": `<html><script src="./assets/a.js"></script></html>`,
    "assets/a.js": hashedChunk,
  });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PREVIEW,
    files,
    originAuthorityChunk: "assets/a.js",
  });
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

test("tampering originAuthorityChunk to another hashed file breaks fingerprint validation", () => {
  const files = {
    "assets/app.js": sha256Bytes("x"),
    "assets/other.js": sha256Bytes("y"),
  };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
  const tampered = { ...manifest, originAuthorityChunk: "assets/other.js" };
  assert.equal(
    codeOf(() => assertValidProvenance(tampered)),
    "provenance_mismatch",
  );
});

test("schemaVersion other than 2 is provenance_invalid", () => {
  const files = {
    "index.html": sha256Bytes("<html/>"),
    "assets/app.js": sha256Bytes("origin"),
  };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files,
    originAuthorityChunk: "assets/app.js",
  });
  assert.equal(manifest.schemaVersion, SCHEMA_VERSION);
  assert.equal(
    codeOf(() => assertValidProvenance({ ...manifest, schemaVersion: 1 })),
    "provenance_invalid",
  );
  assert.equal(
    codeOf(() => assertValidProvenance({ ...manifest, schemaVersion: 3 })),
    "provenance_invalid",
  );
});

test("originAuthorityChunk must exist in the hashed files map", () => {
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
      }),
    ),
    "provenance_invalid",
  );
  const listed = {
    "index.html": sha256Bytes("<html/>"),
    "assets/app.js": sha256Bytes("origin"),
  };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files: listed,
    originAuthorityChunk: "assets/app.js",
  });
  const unlisted = {
    ...manifest,
    files: { "index.html": listed["index.html"] },
  };
  assert.equal(
    codeOf(() => assertValidProvenance(unlisted)),
    "provenance_invalid",
  );
});

test("sidecar handoff requires schema v1, origin module, baked flag, and safe chunk", () => {
  const root = fixtureRoot();
  writeTree(root, {
    "assets/app.js": `const origin=${JSON.stringify(PRODUCTION)}`,
  });
  const valid = {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    originModule: ORIGIN_AUTHORITY_MODULE,
    originAuthorityChunk: "assets/app.js",
    originFoundInChunk: true,
  };
  assert.equal(assertRollupMapHandoff(valid, root, PRODUCTION), "assets/app.js");

  assert.equal(
    codeOf(() => assertRollupMapHandoff({ ...valid, schemaVersion: 2 }, root, PRODUCTION)),
    "origin_module_unmapped",
  );
  assert.equal(
    codeOf(() => assertRollupMapHandoff({ ...valid, schemaVersion: undefined }, root, PRODUCTION)),
    "origin_module_unmapped",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff({ ...valid, originModule: "src/routes/__root.tsx" }, root, PRODUCTION),
    ),
    "origin_module_unmapped",
  );
  assert.equal(
    codeOf(() => assertRollupMapHandoff({ ...valid, originFoundInChunk: false }, root, PRODUCTION)),
    "origin_not_baked",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff({ ...valid, originFoundInChunk: "true" }, root, PRODUCTION),
    ),
    "origin_not_baked",
  );
  assert.equal(
    codeOf(() =>
      assertRollupMapHandoff({ ...valid, originAuthorityChunk: "../secret.js" }, root, PRODUCTION),
    ),
    "origin_authority_chunk_invalid",
  );
});

test("Rollup module IDs are normalized before origin.ts matching", () => {
  assert.equal(isOriginAuthorityModule("/repo/src/platform/http/origin.ts"), true);
  assert.equal(isOriginAuthorityModule("file:///repo/src/platform/http/origin.ts?v=1"), true);
  assert.equal(isOriginAuthorityModule("/repo/src/routes/__root.tsx"), false);
  assert.match(
    normalizeRollupModuleId("file:///tmp/src/platform/http/origin.ts?query=1"),
    /origin\.ts$/,
  );
});
