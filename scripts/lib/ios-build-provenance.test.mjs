/**
 * Focused tests for IOS-BUILD-PROVENANCE-1 library.
 *
 * Run: node --test scripts/lib/ios-build-provenance.test.mjs
 *   or: pnpm test:ios-provenance
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  BUILD_IDENTITY,
  BUILD_MODE,
  IosProvenanceError,
  PROVENANCE_FILE_NAME,
  assertCapacitorConfigHasNoServerUrl,
  assertNoServerUrl,
  assertProvenanceHasNoSecrets,
  assertSourceSha,
  assertSourceTreeClean,
  buildProvenanceManifest,
  classifyGitPorcelain,
  computeBundleFingerprint,
  createChildEnv,
  hashWebDirFiles,
  normalizeHttpsOrigin,
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
  const a = computeBundleFingerprint({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files });
  const b = computeBundleFingerprint({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files });
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
  });
  const b = computeBundleFingerprint({
    sourceSha: SOURCE_SHA,
    apiOrigin: PRODUCTION,
    files: filesB,
  });
  assert.notEqual(a, b);
});

test("golden manifest records SHA, origin, identity and has no secrets", () => {
  const files = { "index.html": sha256Bytes("<html/>") };
  const manifest = buildProvenanceManifest({
    sourceSha: SOURCE_SHA,
    apiOrigin: `${PRODUCTION}/`,
    files,
  });
  assert.equal(manifest.sourceSha, SOURCE_SHA);
  assert.equal(manifest.apiOrigin, PRODUCTION);
  assert.equal(manifest.buildIdentity, BUILD_IDENTITY);
  assert.equal(manifest.buildMode, BUILD_MODE);
  assert.equal(
    manifest.bundleFingerprint,
    computeBundleFingerprint({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files }),
  );
  assert.doesNotThrow(() => assertProvenanceHasNoSecrets(manifest));
  const json = serializeProvenance(manifest);
  assert.doesNotMatch(json, /process\.env|service_role|timestamp|createdAt/i);
});

test("planted secrets in a manifest are rejected", () => {
  const files = { "index.html": sha256Bytes("x") };
  const manifest = buildProvenanceManifest({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files });
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
  writeTree(webDir, { "index.html": "<html>fresh</html>", "assets/app.js": "ok" });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": "<html>fresh</html>",
    "assets/app.js": "ok",
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
  writeTree(webDir, { "index.html": "<html>fresh</html>", "assets/new.js": "new" });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, {
    "index.html": "<html>fresh</html>",
    "assets/new.js": "new",
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
  writeTree(webDir, { "index.html": "<html>fresh</html>" });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({ sourceSha: SOURCE_SHA, apiOrigin: PRODUCTION, files });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });
  writeTree(publicDir, { "index.html": "<html>STALE</html>" });
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
  writeTree(webDir, { "index.html": "<html>app</html>", "assets/a.js": "1" });
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({ sourceSha: SOURCE_SHA, apiOrigin: PREVIEW, files });
  writeProvenanceArtifacts({ webDir, expectedPath, manifest });

  const app = join(root, "App.app");
  writeTree(join(app, "public"), {
    "index.html": "<html>app</html>",
    "assets/a.js": "1",
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
