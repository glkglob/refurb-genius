/**
 * Focused tests for the governed prepare:ios CLI and Vite runner lifecycle.
 *
 * Run: node --test scripts/prepare-ios-native-bundle.test.mjs
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  IosProvenanceError,
  ORIGIN_AUTHORITY_MODULE,
  ROLLUP_MAP_REL,
  SIDECAR_SCHEMA_VERSION,
  WEB_DIR_REL,
  assertRollupMapHandoff,
} from "./lib/ios-build-provenance.mjs";
import {
  classifyRunnerExit,
  defaultSpawnBuild,
  parseCliArgs,
  runPrepareIosNativeBundle,
} from "./prepare-ios-native-bundle.mjs";
import {
  ORIGIN_CAPTURE_PLUGIN_NAME,
  createOriginAuthorityCaptureState,
  isPackagedClientEnvironment,
  runIosViteBuild,
  selectUniqueClientAuthorityChunk,
} from "./run-ios-vite-build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/prepare-ios-native-bundle.mjs");
const RUNNER = join(ROOT, "scripts/run-ios-vite-build.mjs");
const PRODUCTION = "https://www.refurbgenius.info";
const PREVIEW = "https://refurb-genius-git-fix-example.vercel.app";
const SOURCE_SHA = "487dd4d0c6298200060ef79b05fa1b0e7b5677ad";

function runCli(env, argv = []) {
  return spawnSync(process.execPath, [SCRIPT, ...argv], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function codeOf(fn) {
  try {
    fn();
    throw new Error("expected IosProvenanceError");
  } catch (err) {
    assert.ok(err instanceof IosProvenanceError, String(err));
    return err.code;
  }
}

async function rejectedCode(fn) {
  try {
    await fn();
    throw new Error("expected IosProvenanceError");
  } catch (err) {
    assert.ok(err instanceof IosProvenanceError, String(err));
    return err.code;
  }
}

function writeReadySpa(root, origin, chunkRel = "assets/app.js") {
  const webDir = join(root, WEB_DIR_REL);
  mkdirSync(join(webDir, "assets"), { recursive: true });
  writeFileSync(
    join(webDir, "index.html"),
    `<html><script type="module" src="./${chunkRel}"></script></html>`,
  );
  writeFileSync(join(webDir, chunkRel), `export const apiOrigin=${JSON.stringify(origin)};`);
  mkdirSync(join(root, "dist/ios"), { recursive: true });
  writeFileSync(
    join(root, ROLLUP_MAP_REL),
    `${JSON.stringify({
      schemaVersion: SIDECAR_SCHEMA_VERSION,
      originModule: ORIGIN_AUTHORITY_MODULE,
      originAuthorityChunk: chunkRel,
      originFoundInChunk: true,
    })}\n`,
  );
  mkdirSync(join(root, "ios/App/App/public"), { recursive: true });
}

function copySpaToPublic(root, origin, chunkRel = "assets/app.js") {
  const pub = join(root, "ios/App/App/public");
  mkdirSync(join(pub, "assets"), { recursive: true });
  writeFileSync(
    join(pub, "index.html"),
    `<html><script type="module" src="./${chunkRel}"></script></html>`,
  );
  writeFileSync(join(pub, chunkRel), `export const apiOrigin=${JSON.stringify(origin)};`);
  writeFileSync(
    join(pub, "ios-build-provenance.json"),
    readFileSync(join(root, "dist/ios/ios-build-provenance.json")),
  );
  writeFileSync(join(root, "ios/App/App/capacitor.config.json"), JSON.stringify({}));
}

function capturePluginFromConfig(inlineConfig) {
  const plugins = inlineConfig?.plugins ?? [];
  const found = plugins.find((plugin) => plugin && plugin.name === ORIGIN_CAPTURE_PLUGIN_NAME);
  assert.ok(found, "createBuilder inlineConfig must include the origin capture plugin");
  return found;
}

function invokeGenerateBundle(plugin, environment, bundle) {
  return plugin.generateBundle.call({ environment }, {}, bundle);
}

function originChunk(fileName, moduleId, code) {
  return {
    type: "chunk",
    fileName,
    moduleIds: [moduleId],
    facadeModuleId: moduleId,
    modules: { [moduleId]: {} },
    code,
  };
}

/**
 * @param {{
 *   cwd: string,
 *   origin: string,
 *   clientChunkRel?: string,
 *   extraEnvs?: Array<{ environment: object, bundle: object }>,
 *   clientOutDir?: string,
 *   hangAfterStaleRemoved?: boolean,
 * }} opts
 */
function mockCreateBuilder(opts) {
  return async (inlineConfig) => {
    const plugin = capturePluginFromConfig(inlineConfig);
    const clientDir = opts.clientOutDir ?? resolve(opts.cwd, WEB_DIR_REL);
    const clientEnv = {
      config: {
        consumer: "client",
        build: { outDir: clientDir },
      },
    };
    return {
      async buildApp() {
        if (opts.hangAfterStaleRemoved) {
          throw new Error("simulated hang after stale dist removal");
        }
        const chunkRel = opts.clientChunkRel ?? "assets/origin-auth.js";
        mkdirSync(join(clientDir, "assets"), { recursive: true });
        writeFileSync(join(clientDir, chunkRel), `const o=${JSON.stringify(opts.origin)}`);
        writeFileSync(
          join(clientDir, "index.html"),
          `<html><script src="./${chunkRel}"></script></html>`,
        );
        invokeGenerateBundle(plugin, clientEnv, {
          [chunkRel]: originChunk(
            chunkRel,
            join(opts.cwd, "src/platform/http/origin.ts"),
            `const o=${JSON.stringify(opts.origin)}`,
          ),
        });
        for (const extra of opts.extraEnvs ?? []) {
          invokeGenerateBundle(plugin, extra.environment, extra.bundle);
        }
      },
    };
  };
}

test("CLI rejects --verify-installed", () => {
  assert.equal(
    codeOf(() => parseCliArgs(["--verify-installed"])),
    "usage",
  );
});

test("CLI requires --app for --verify-app-bundle", async () => {
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: ROOT,
        env: process.env,
        argv: ["--verify-app-bundle"],
      }),
    ),
    "usage",
  );
});

test("CLI missing VITE_PUBLIC_URL fails before build", () => {
  const missing = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: Object.fromEntries(
      Object.entries({ ...process.env }).filter(([key]) => key !== "VITE_PUBLIC_URL"),
    ),
  });
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stderr, /origin_missing/);
});

test("CLI blank VITE_PUBLIC_URL fails origin_missing", () => {
  const res = runCli({ VITE_PUBLIC_URL: "  " });
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /origin_missing/);
});

test("CLI malformed VITE_PUBLIC_URL fails origin_invalid", () => {
  const res = runCli({ VITE_PUBLIC_URL: "not-a-url" });
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /origin_invalid/);
});

test("CLI HTTP VITE_PUBLIC_URL fails origin_not_https", () => {
  const res = runCli({ VITE_PUBLIC_URL: "http://www.refurbgenius.info" });
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /origin_not_https/);
});

test("classifyRunnerExit never treats a signal or timeout as success", () => {
  assert.deepEqual(classifyRunnerExit({ code: 0, signal: null }), {
    ok: true,
    state: "succeeded",
  });
  assert.deepEqual(classifyRunnerExit({ code: 1, signal: null }), {
    ok: false,
    state: "failed_nonzero",
  });
  assert.deepEqual(classifyRunnerExit({ code: null, signal: "SIGTERM" }), {
    ok: false,
    state: "failed_signal",
  });
  assert.deepEqual(classifyRunnerExit({ code: null, signal: "SIGKILL" }), {
    ok: false,
    state: "failed_signal",
  });
  assert.deepEqual(classifyRunnerExit({ code: null, signal: null }), {
    ok: false,
    state: "failed_crash",
  });
  assert.deepEqual(classifyRunnerExit({ code: 0, signal: null, timedOut: true }), {
    ok: false,
    state: "failed_timeout",
  });
  assert.deepEqual(classifyRunnerExit({ code: null, signal: "SIGKILL", timedOut: true }), {
    ok: false,
    state: "failed_timeout",
  });
});

test("timeout kills the runner exactly once and is never success", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-timeout-"));
  writeReadySpa(tmp, PRODUCTION);
  let killCount = 0;
  const fake = new EventEmitter();
  fake.kill = () => {
    killCount += 1;
    fake.exitCode = null;
    fake.signalCode = "SIGKILL";
    queueMicrotask(() => fake.emit("exit", null, "SIGKILL"));
  };
  fake.exitCode = null;
  fake.signalCode = null;

  const result = await defaultSpawnBuild({
    cwd: tmp,
    env: { VITE_PUBLIC_URL: PRODUCTION },
    timeoutMs: 20,
    spawnImpl: () => fake,
  });
  assert.equal(result.state, "failed_timeout");
  assert.equal(result.status, 1);
  assert.equal(killCount, 1);
  assert.equal(result.killCount, 1);
  const after = result.killCount;
  fake.emit("exit", null, "SIGKILL");
  assert.equal(result.killCount, after);
  assert.equal(killCount, 1);
});

test("unexpected SIGTERM without timeout is failed_signal", async () => {
  const fake = new EventEmitter();
  fake.kill = () => {
    throw new Error("must not kill after unexpected signal path unless timeout");
  };
  fake.exitCode = null;
  fake.signalCode = null;
  const pending = defaultSpawnBuild({
    cwd: ROOT,
    env: { VITE_PUBLIC_URL: PRODUCTION },
    timeoutMs: 60_000,
    spawnImpl: () => fake,
  });
  queueMicrotask(() => fake.emit("exit", null, "SIGTERM"));
  const result = await pending;
  assert.equal(result.state, "failed_signal");
  assert.equal(result.status, 1);
});

test("stale dist/ios is removed before a governed Vite run and hang cannot certify leftovers", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-stale-"));
  mkdirSync(join(tmp, "dist/ios/client/assets"), { recursive: true });
  writeFileSync(join(tmp, "dist/ios/client/index.html"), "<html>STALE</html>");
  writeFileSync(join(tmp, "dist/ios/client/assets/stale.js"), "stale");
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        createBuilderImpl: mockCreateBuilder({
          cwd: tmp,
          origin: PRODUCTION,
          hangAfterStaleRemoved: true,
        }),
      }),
    ),
    "vite_ios_failed",
  );
  assert.equal(existsSync(join(tmp, "dist/ios")), false);
  assert.equal(existsSync(join(tmp, "dist/ios/client/index.html")), false);
});

test("buildApp rejection fails the runner", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "vite-reject-"));
  await assert.rejects(
    () =>
      runIosViteBuild({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        createBuilderImpl: async () => ({
          async buildApp() {
            throw new Error("rollup failed");
          },
        }),
      }),
    (err) => err instanceof IosProvenanceError && err.code === "vite_ios_failed",
  );
});

test("unmapped origin authority module fails", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "unmapped-"));
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          const clientDir = resolve(tmp, WEB_DIR_REL);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          writeFileSync(
            join(clientDir, "assets/other.js"),
            `const o=${JSON.stringify(PRODUCTION)}`,
          );
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "client", build: { outDir: clientDir } } },
                {
                  "assets/other.js": originChunk(
                    "assets/other.js",
                    "/repo/src/routes/__root.tsx",
                    `const o=${JSON.stringify(PRODUCTION)}`,
                  ),
                },
              );
            },
          };
        },
      }),
    ),
    "origin_module_unmapped",
  );
});

test("origin only in an unrelated chunk is not a mapping", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "unrelated-"));
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          const clientDir = resolve(tmp, WEB_DIR_REL);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          writeFileSync(
            join(clientDir, "assets/root.js"),
            `const SITE=${JSON.stringify(PRODUCTION)}`,
          );
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "client", build: { outDir: clientDir } } },
                {
                  "assets/root.js": originChunk(
                    "assets/root.js",
                    "/repo/src/routes/__root.tsx",
                    `const SITE=${JSON.stringify(PRODUCTION)}`,
                  ),
                },
              );
            },
          };
        },
      }),
    ),
    "origin_module_unmapped",
  );
});

test("server-only authority cannot qualify as the packaged client chunk", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "server-only-"));
  const clientDir = resolve(tmp, WEB_DIR_REL);
  const serverDir = resolve(tmp, "dist/ios/server");
  assert.equal(
    isPackagedClientEnvironment(
      { config: { consumer: "server", build: { outDir: serverDir } } },
      clientDir,
    ),
    false,
  );
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          mkdirSync(join(serverDir), { recursive: true });
          writeFileSync(
            join(serverDir, "origin-server.js"),
            `const o=${JSON.stringify(PRODUCTION)}`,
          );
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "server", build: { outDir: serverDir } } },
                {
                  "origin-server.js": originChunk(
                    "origin-server.js",
                    join(tmp, "src/platform/http/origin.ts"),
                    `const o=${JSON.stringify(PRODUCTION)}`,
                  ),
                },
              );
            },
          };
        },
      }),
    ),
    "origin_module_unmapped",
  );
});

test("client consumer with a non-exact outDir cannot qualify", () => {
  const tmp = mkdtempSync(join(tmpdir(), "contained-"));
  const expected = resolve(tmp, WEB_DIR_REL);
  assert.equal(
    isPackagedClientEnvironment({ consumer: "client", outDir: resolve(tmp, "dist/ios") }, expected),
    false,
  );
  assert.equal(
    isPackagedClientEnvironment(
      { consumer: "client", outDir: resolve(tmp, "dist/ios/client/assets") },
      expected,
    ),
    false,
  );
  assert.equal(
    isPackagedClientEnvironment({ consumer: "client", outDir: expected }, expected),
    true,
  );
});

test("multiple distinct client authority chunks fail origin_authority_ambiguous", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "ambiguous-"));
  const clientDir = resolve(tmp, WEB_DIR_REL);
  const capture = createOriginAuthorityCaptureState();
  const env = { config: { consumer: "client", build: { outDir: clientDir } } };
  invokeGenerateBundle(capture.plugin, env, {
    "assets/a.js": originChunk(
      "assets/a.js",
      join(tmp, "src/platform/http/origin.ts"),
      `const o=${JSON.stringify(PRODUCTION)}`,
    ),
    "assets/b.js": originChunk(
      "assets/b.js",
      join(tmp, "src/platform/http/origin.ts"),
      `const o=${JSON.stringify(PRODUCTION)}`,
    ),
  });
  assert.equal(
    codeOf(() => selectUniqueClientAuthorityChunk(capture.byEnvironment, clientDir)),
    "origin_authority_ambiguous",
  );

  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          writeFileSync(join(clientDir, "assets/a.js"), `const o=${JSON.stringify(PRODUCTION)}`);
          writeFileSync(join(clientDir, "assets/b.js"), `const o=${JSON.stringify(PRODUCTION)}`);
          return {
            async buildApp() {
              invokeGenerateBundle(plugin, env, {
                "assets/a.js": originChunk(
                  "assets/a.js",
                  join(tmp, "src/platform/http/origin.ts"),
                  `const o=${JSON.stringify(PRODUCTION)}`,
                ),
                "assets/b.js": originChunk(
                  "assets/b.js",
                  join(tmp, "src/platform/http/origin.ts"),
                  `const o=${JSON.stringify(PRODUCTION)}`,
                ),
              });
            },
          };
        },
      }),
    ),
    "origin_authority_ambiguous",
  );
});

test("Preview origin correctly mapped in the authority chunk", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "preview-map-"));
  const result = await runIosViteBuild({
    cwd: tmp,
    env: { VITE_PUBLIC_URL: PREVIEW },
    createBuilderImpl: mockCreateBuilder({
      cwd: tmp,
      origin: PREVIEW,
      clientChunkRel: "assets/origin-auth.js",
    }),
  });
  assert.equal(result.originAuthorityChunk, "assets/origin-auth.js");
  assert.equal(result.apiOrigin, PREVIEW);
  const sidecar = JSON.parse(readFileSync(join(tmp, ROLLUP_MAP_REL), "utf8"));
  assert.equal(sidecar.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(sidecar.originModule, ORIGIN_AUTHORITY_MODULE);
  assert.equal(sidecar.originFoundInChunk, true);
  assert.equal(
    assertRollupMapHandoff(sidecar, join(tmp, WEB_DIR_REL), PREVIEW),
    "assets/origin-auth.js",
  );
});

test("prepare PASS after deterministic runner success plus content gates", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-pass-"));
  writeReadySpa(tmp, PRODUCTION);
  const parent = { VITE_PUBLIC_URL: `${PRODUCTION}/`, PATH: process.env.PATH };
  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: parent,
    argv: [],
    hooks: {
      readGitHead: () => SOURCE_SHA,
      readGitStatus: () => "",
      spawnBuild: ({ env }) => {
        assert.equal(env.VITE_PUBLIC_URL, PRODUCTION);
        return { status: 0, state: "succeeded" };
      },
      spawnCopy: () => {
        copySpaToPublic(tmp, PRODUCTION);
        return { status: 0 };
      },
    },
  });
  assert.equal(result.status, 0);
  assert.equal(result.manifest.apiOrigin, PRODUCTION);
  assert.equal(result.manifest.originAuthorityChunk, "assets/app.js");
  assert.equal(result.manifest.schemaVersion, 2);
  assert.equal(parent.VITE_PUBLIC_URL, `${PRODUCTION}/`);
});

test("prepare records an explicit Preview origin from the authority chunk", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-ios-preview-"));
  writeReadySpa(tmp, PREVIEW);
  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: { VITE_PUBLIC_URL: PREVIEW, PATH: process.env.PATH },
    argv: [],
    hooks: {
      readGitHead: () => SOURCE_SHA,
      readGitStatus: () => "",
      spawnBuild: () => ({ status: 0, state: "succeeded" }),
      spawnCopy: () => {
        copySpaToPublic(tmp, PREVIEW);
        return { status: 0 };
      },
    },
  });
  assert.equal(result.manifest.apiOrigin, PREVIEW);
});

test("runner non-zero fails prepare", async () => {
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: ROOT,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => "",
          spawnBuild: () => ({ status: 1, state: "failed_nonzero" }),
        },
      }),
    ),
    "vite_ios_failed",
  );
});

test("prepare timeout is failed_timeout even if files exist", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-to-"));
  writeReadySpa(tmp, PRODUCTION);
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => "",
          spawnBuild: () => ({ status: 1, state: "failed_timeout", timedOut: true }),
        },
      }),
    ),
    "failed_timeout",
  );
});

test("prepare crash without exit code or signal is failed_crash", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-crash-"));
  writeReadySpa(tmp, PRODUCTION);
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => "",
          spawnBuild: () => ({ status: 1, state: "failed_crash", code: null, signal: null }),
        },
      }),
    ),
    "failed_crash",
  );
});

test("partial HTML refs after runner success FAIL", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-partial-"));
  writeReadySpa(tmp, PRODUCTION);
  const index = join(tmp, WEB_DIR_REL, "index.html");
  writeFileSync(
    index,
    `<html><script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/missing.css" /></html>`,
  );
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => "",
          spawnBuild: () => ({ status: 0, state: "succeeded" }),
        },
      }),
    ),
    "spa_incomplete",
  );
});

test("prepare fails dirty_untracked before Vite when source is uncommitted", async () => {
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: ROOT,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => "?? scripts/lib/ios-build-provenance.mjs\n",
          spawnBuild: () => {
            throw new Error("build must not run");
          },
        },
      }),
    ),
    "dirty_untracked",
  );
});

test("prepare fails dirty_tracked before Vite", async () => {
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: ROOT,
        env: { VITE_PUBLIC_URL: PRODUCTION },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => " M package.json\n",
          spawnBuild: () => {
            throw new Error("build must not run");
          },
        },
      }),
    ),
    "dirty_tracked",
  );
});

test(
  "real Vite TanStack buildApp emits client index.html and baked origin authority chunk",
  { timeout: 600_000 },
  () => {
    const res = spawnSync(process.execPath, [RUNNER], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 540_000,
      env: { ...process.env, VITE_PUBLIC_URL: PRODUCTION },
    });
    assert.equal(
      res.status,
      0,
      `real runner failed (signal=${res.signal} error=${res.error?.message ?? ""})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
    );
    const indexPath = join(ROOT, WEB_DIR_REL, "index.html");
    assert.equal(existsSync(indexPath), true, "dist/ios/client/index.html missing after buildApp");
    const html = readFileSync(indexPath, "utf8");
    assert.match(html, /<html/i);

    const sidecar = JSON.parse(readFileSync(join(ROOT, ROLLUP_MAP_REL), "utf8"));
    assert.equal(sidecar.schemaVersion, SIDECAR_SCHEMA_VERSION);
    assert.equal(sidecar.originModule, ORIGIN_AUTHORITY_MODULE);
    assert.equal(sidecar.originFoundInChunk, true);
    const chunkRel = assertRollupMapHandoff(sidecar, join(ROOT, WEB_DIR_REL), PRODUCTION);
    const chunkText = readFileSync(join(ROOT, WEB_DIR_REL, chunkRel), "utf8");
    assert.equal(chunkText.includes(PRODUCTION), true);
    assert.doesNotMatch(chunkRel, /\.\./);
  },
);
