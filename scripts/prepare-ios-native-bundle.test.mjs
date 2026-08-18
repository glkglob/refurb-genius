/**
 * Focused tests for the governed prepare:ios CLI and Vite runner lifecycle.
 *
 * Run: node --test scripts/prepare-ios-native-bundle.test.mjs
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  SUPABASE_AUTHORITY_MODULE,
  WEB_DIR_REL,
  assertRollupMapHandoff,
  createChildEnv,
  sha256Bytes,
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
  selectUniqueClientSupabaseAuthorityChunk,
} from "./run-ios-vite-build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/prepare-ios-native-bundle.mjs");
const RUNNER = join(ROOT, "scripts/run-ios-vite-build.mjs");
const PRODUCTION = "https://www.refurbgenius.info";
const PREVIEW = "https://refurb-genius-git-fix-example.vercel.app";
const SOURCE_SHA = "487dd4d0c6298200060ef79b05fa1b0e7b5677ad";
const SUPABASE_URL = "https://ios-provenance-test.supabase.co";
const SUPABASE_ANON_KEY = "ios-anon-test-key";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ios_test_key";
const DOTENV_STALE_PUBLISHABLE = "stale-dotenv-publishable-ios-p0";
const DOTENV_STALE_SECRET = "sb_secret_dotenv_ios_p0";

function governedEnv(overrides = {}) {
  const env = {
    VITE_PUBLIC_URL: PRODUCTION,
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    PATH: process.env.PATH,
    ...overrides,
  };
  if (!Object.hasOwn(overrides, "VITE_SUPABASE_PUBLISHABLE_KEY")) {
    delete env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }
  delete env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  return env;
}

function bakedJs(origin, supabaseUrl = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
  return `export const apiOrigin=${JSON.stringify(origin)};const supabaseUrl=${JSON.stringify(supabaseUrl)};const supabaseKey=${JSON.stringify(key)};`;
}

function runCli(env, argv = []) {
  const merged = { ...process.env, ...env };
  if (!Object.hasOwn(env, "VITE_SUPABASE_SERVICE_ROLE_KEY")) {
    delete merged.VITE_SUPABASE_SERVICE_ROLE_KEY;
  }
  return spawnSync(process.execPath, [SCRIPT, ...argv], {
    cwd: ROOT,
    encoding: "utf8",
    env: merged,
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

function writeIsolatedDotenvTree(root) {
  const stale = [
    `VITE_SUPABASE_PUBLISHABLE_KEY=${DOTENV_STALE_PUBLISHABLE}`,
    `VITE_SUPABASE_SERVICE_ROLE_KEY=${DOTENV_STALE_SECRET}`,
    "",
  ].join("\n");
  writeFileSync(join(root, ".env"), stale);
  writeFileSync(join(root, ".env.local"), stale);
  writeFileSync(join(root, ".env.production"), stale);
  writeFileSync(join(root, ".env.production.local"), stale);
}

function loadViteEnvInChildProcess(env, envDir) {
  const script = `
    import { loadEnv } from "vite";
    const loaded = loadEnv("production", process.env.IOS_TEST_ENV_DIR, "VITE_");
    process.stdout.write(JSON.stringify({
      publishable: loaded.VITE_SUPABASE_PUBLISHABLE_KEY ?? null,
      serviceRole: loaded.VITE_SUPABASE_SERVICE_ROLE_KEY ?? null,
      anon: loaded.VITE_SUPABASE_ANON_KEY ?? null,
    }));
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...env, IOS_TEST_ENV_DIR: envDir },
  });
}

function writeIsolatedViteApp(root) {
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ type: "module" })}\n`);
  writeFileSync(
    join(root, "vite.config.mjs"),
    "export default { build: { outDir: 'dist', write: true, minify: false, emptyOutDir: true } };\n",
  );
  writeFileSync(
    join(root, "index.html"),
    `<!doctype html><script type="module" src="/main.js"></script>\n`,
  );
  writeFileSync(
    join(root, "main.js"),
    [
      "const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;",
      "const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;",
      "const serviceRole = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;",
      "document.body.textContent = [anon, publishable, serviceRole].join('|');",
      "",
    ].join("\n"),
  );
  writeIsolatedDotenvTree(root);
}

function collectJsText(dir) {
  if (!existsSync(dir)) return "";
  /** @type {string[]} */
  const texts = [];
  /**
   * @param {string} current
   */
  function walk(current) {
    for (const ent of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (ent.isFile() && (ent.name.endsWith(".js") || ent.name.endsWith(".mjs"))) {
        texts.push(readFileSync(abs, "utf8"));
      }
    }
  }
  walk(dir);
  return texts.join("\n");
}

function writeReadySpa(root, origin, chunkRel = "assets/app.js") {
  const webDir = join(root, WEB_DIR_REL);
  mkdirSync(join(webDir, "assets"), { recursive: true });
  writeFileSync(
    join(webDir, "index.html"),
    `<html><script type="module" src="./${chunkRel}"></script></html>`,
  );
  writeFileSync(join(webDir, chunkRel), bakedJs(origin));
  mkdirSync(join(root, "dist/ios"), { recursive: true });
  writeFileSync(
    join(root, ROLLUP_MAP_REL),
    `${JSON.stringify({
      schemaVersion: SIDECAR_SCHEMA_VERSION,
      originModule: ORIGIN_AUTHORITY_MODULE,
      originAuthorityChunk: chunkRel,
      originFoundInChunk: true,
      supabaseModule: SUPABASE_AUTHORITY_MODULE,
      supabaseAuthorityChunk: chunkRel,
      supabaseUrlFoundInChunk: true,
      supabasePublicKeyFoundInChunk: true,
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
  writeFileSync(join(pub, chunkRel), bakedJs(origin));
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

function originChunk(fileName, moduleIds, code) {
  const ids = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  return {
    type: "chunk",
    fileName,
    moduleIds: ids,
    facadeModuleId: ids[0],
    modules: Object.fromEntries(ids.map((id) => [id, {}])),
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
 *   mapSupabase?: boolean,
 *   supabaseUrl?: string,
 *   supabaseKey?: string,
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
        const supabaseUrl = opts.supabaseUrl ?? SUPABASE_URL;
        const supabaseKey = opts.supabaseKey ?? SUPABASE_ANON_KEY;
        const code = `const o=${JSON.stringify(opts.origin)};const u=${JSON.stringify(supabaseUrl)};const k=${JSON.stringify(supabaseKey)}`;
        mkdirSync(join(clientDir, "assets"), { recursive: true });
        writeFileSync(join(clientDir, chunkRel), code);
        writeFileSync(
          join(clientDir, "index.html"),
          `<html><script src="./${chunkRel}"></script></html>`,
        );
        const moduleIds = [join(opts.cwd, "src/platform/http/origin.ts")];
        if (opts.mapSupabase !== false) {
          moduleIds.push(join(opts.cwd, "packages/supabase/src/env.ts"));
        }
        invokeGenerateBundle(plugin, clientEnv, {
          [chunkRel]: originChunk(chunkRel, moduleIds, code),
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

test("CLI ignores a leftover bare -- from pnpm", () => {
  assert.deepEqual(parseCliArgs(["--", "--verify-app-bundle", "--app", "/tmp/App.app"]), {
    mode: "verify-app-bundle",
    app: "/tmp/App.app",
    expected: null,
  });
  assert.deepEqual(parseCliArgs(["--verify-app-bundle", "--", "--app", "/tmp/Other.app"]), {
    mode: "verify-app-bundle",
    app: "/tmp/Other.app",
    expected: null,
  });
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

test("CLI missing VITE_SUPABASE_URL fails before build", () => {
  const missing = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: Object.fromEntries(
      Object.entries({
        ...process.env,
        VITE_PUBLIC_URL: PRODUCTION,
        VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      }).filter(
        ([key]) =>
          key !== "VITE_SUPABASE_URL" &&
          key !== "VITE_SUPABASE_PUBLISHABLE_KEY" &&
          key !== "VITE_SUPABASE_SERVICE_ROLE_KEY",
      ),
    ),
  });
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stderr, /supabase_url_missing/);
});

test("CLI invalid Supabase URL fails supabase_url_not_https", () => {
  const res = runCli(
    governedEnv({
      VITE_SUPABASE_URL: "http://ios-provenance-test.supabase.co",
    }),
  );
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /supabase_url_not_https/);
});

test("CLI missing public key fails supabase_key_missing", () => {
  const missing = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: Object.fromEntries(
      Object.entries({
        ...process.env,
        VITE_PUBLIC_URL: PRODUCTION,
        VITE_SUPABASE_URL: SUPABASE_URL,
      }).filter(
        ([key]) =>
          key !== "VITE_SUPABASE_ANON_KEY" &&
          key !== "VITE_SUPABASE_PUBLISHABLE_KEY" &&
          key !== "VITE_SUPABASE_SERVICE_ROLE_KEY",
      ),
    ),
  });
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stderr, /supabase_key_missing/);
});

test("CLI conflicting public keys fail supabase_key_conflict", () => {
  const res = runCli(
    governedEnv({
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
    }),
  );
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /supabase_key_conflict/);
});

test("CLI service_role key fails supabase_key_forbidden", () => {
  const res = runCli(
    governedEnv({
      VITE_SUPABASE_ANON_KEY: "planted-service_role-marker",
    }),
  );
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stderr, /supabase_key_forbidden/);
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
    env: governedEnv(),
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
    env: governedEnv(),
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
        env: governedEnv(),
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
        env: governedEnv(),
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
        env: governedEnv(),
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          const clientDir = resolve(tmp, WEB_DIR_REL);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          writeFileSync(join(clientDir, "assets/other.js"), bakedJs(PRODUCTION));
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "client", build: { outDir: clientDir } } },
                {
                  "assets/other.js": originChunk(
                    "assets/other.js",
                    "/repo/src/routes/__root.tsx",
                    bakedJs(PRODUCTION),
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

test("unmapped Supabase authority module fails", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "unmapped-sb-"));
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: governedEnv(),
        createBuilderImpl: mockCreateBuilder({
          cwd: tmp,
          origin: PRODUCTION,
          mapSupabase: false,
        }),
      }),
    ),
    "supabase_module_unmapped",
  );
});

test("origin only in an unrelated chunk is not a mapping", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "unrelated-"));
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: governedEnv(),
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
        env: governedEnv(),
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          mkdirSync(join(serverDir), { recursive: true });
          writeFileSync(join(serverDir, "origin-server.js"), bakedJs(PRODUCTION));
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "server", build: { outDir: serverDir } } },
                {
                  "origin-server.js": originChunk(
                    "origin-server.js",
                    [
                      join(tmp, "src/platform/http/origin.ts"),
                      join(tmp, "packages/supabase/src/env.ts"),
                    ],
                    bakedJs(PRODUCTION),
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
      bakedJs(PRODUCTION),
    ),
    "assets/b.js": originChunk(
      "assets/b.js",
      join(tmp, "src/platform/http/origin.ts"),
      bakedJs(PRODUCTION),
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
        env: governedEnv(),
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          writeFileSync(join(clientDir, "assets/a.js"), bakedJs(PRODUCTION));
          writeFileSync(join(clientDir, "assets/b.js"), bakedJs(PRODUCTION));
          return {
            async buildApp() {
              invokeGenerateBundle(plugin, env, {
                "assets/a.js": originChunk(
                  "assets/a.js",
                  join(tmp, "src/platform/http/origin.ts"),
                  bakedJs(PRODUCTION),
                ),
                "assets/b.js": originChunk(
                  "assets/b.js",
                  join(tmp, "src/platform/http/origin.ts"),
                  bakedJs(PRODUCTION),
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

test("multiple distinct Supabase authority chunks fail supabase_authority_ambiguous", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "ambiguous-sb-"));
  const clientDir = resolve(tmp, WEB_DIR_REL);
  const capture = createOriginAuthorityCaptureState();
  const env = { config: { consumer: "client", build: { outDir: clientDir } } };
  invokeGenerateBundle(capture.plugin, env, {
    "assets/a.js": originChunk(
      "assets/a.js",
      join(tmp, "packages/supabase/src/env.ts"),
      bakedJs(PRODUCTION),
    ),
    "assets/b.js": originChunk(
      "assets/b.js",
      join(tmp, "packages/supabase/src/env.ts"),
      bakedJs(PRODUCTION),
    ),
  });
  assert.equal(
    codeOf(() => selectUniqueClientSupabaseAuthorityChunk(capture.byEnvironment, clientDir)),
    "supabase_authority_ambiguous",
  );
});

test("Preview origin correctly mapped in the authority chunk", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "preview-map-"));
  const result = await runIosViteBuild({
    cwd: tmp,
    env: governedEnv({ VITE_PUBLIC_URL: PREVIEW }),
    createBuilderImpl: mockCreateBuilder({
      cwd: tmp,
      origin: PREVIEW,
      clientChunkRel: "assets/origin-auth.js",
    }),
  });
  assert.equal(result.originAuthorityChunk, "assets/origin-auth.js");
  assert.equal(result.supabaseAuthorityChunk, "assets/origin-auth.js");
  assert.equal(result.apiOrigin, PREVIEW);
  assert.equal(result.supabaseUrl, SUPABASE_URL);
  const sidecar = JSON.parse(readFileSync(join(tmp, ROLLUP_MAP_REL), "utf8"));
  assert.equal(sidecar.schemaVersion, SIDECAR_SCHEMA_VERSION);
  assert.equal(sidecar.originModule, ORIGIN_AUTHORITY_MODULE);
  assert.equal(sidecar.supabaseModule, SUPABASE_AUTHORITY_MODULE);
  assert.equal(sidecar.originFoundInChunk, true);
  assert.equal(sidecar.supabaseUrlFoundInChunk, true);
  assert.equal(sidecar.supabasePublicKeyFoundInChunk, true);
  assert.equal(JSON.stringify(sidecar).includes(SUPABASE_ANON_KEY), false);
  assert.deepEqual(assertRollupMapHandoff(sidecar, join(tmp, WEB_DIR_REL), PREVIEW, SUPABASE_URL), {
    originAuthorityChunk: "assets/origin-auth.js",
    supabaseAuthorityChunk: "assets/origin-auth.js",
  });
});

test("runner fails when selected public key is not baked", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "key-not-baked-"));
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: governedEnv(),
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          const clientDir = resolve(tmp, WEB_DIR_REL);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          const code = `const o=${JSON.stringify(PRODUCTION)};const u=${JSON.stringify(SUPABASE_URL)};`;
          writeFileSync(join(clientDir, "assets/app.js"), code);
          writeFileSync(
            join(clientDir, "index.html"),
            `<html><script src="./assets/app.js"></script></html>`,
          );
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "client", build: { outDir: clientDir } } },
                {
                  "assets/app.js": originChunk(
                    "assets/app.js",
                    [
                      join(tmp, "src/platform/http/origin.ts"),
                      join(tmp, "packages/supabase/src/env.ts"),
                    ],
                    code,
                  ),
                },
              );
            },
          };
        },
      }),
    ),
    "supabase_key_not_baked",
  );
});

test("runner fails when Supabase URL is not baked", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "url-not-baked-"));
  assert.equal(
    await rejectedCode(() =>
      runIosViteBuild({
        cwd: tmp,
        env: governedEnv(),
        createBuilderImpl: async (inlineConfig) => {
          const plugin = capturePluginFromConfig(inlineConfig);
          const clientDir = resolve(tmp, WEB_DIR_REL);
          mkdirSync(join(clientDir, "assets"), { recursive: true });
          const code = `const o=${JSON.stringify(PRODUCTION)};const k=${JSON.stringify(SUPABASE_ANON_KEY)};`;
          writeFileSync(join(clientDir, "assets/app.js"), code);
          writeFileSync(
            join(clientDir, "index.html"),
            `<html><script src="./assets/app.js"></script></html>`,
          );
          return {
            async buildApp() {
              invokeGenerateBundle(
                plugin,
                { config: { consumer: "client", build: { outDir: clientDir } } },
                {
                  "assets/app.js": originChunk(
                    "assets/app.js",
                    [
                      join(tmp, "src/platform/http/origin.ts"),
                      join(tmp, "packages/supabase/src/env.ts"),
                    ],
                    code,
                  ),
                },
              );
            },
          };
        },
      }),
    ),
    "supabase_url_not_baked",
  );
});

test("prepare PASS after deterministic runner success plus content gates", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-pass-"));
  writeReadySpa(tmp, PRODUCTION);
  const parent = governedEnv({ VITE_PUBLIC_URL: `${PRODUCTION}/` });
  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: parent,
    argv: [],
    hooks: {
      readGitHead: () => SOURCE_SHA,
      readGitStatus: () => "",
      spawnBuild: ({ env }) => {
        assert.equal(env.VITE_PUBLIC_URL, PRODUCTION);
        assert.equal(env.VITE_SUPABASE_URL, SUPABASE_URL);
        assert.equal(env.VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY);
        assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, "");
        assert.equal(env.VITE_SUPABASE_SERVICE_ROLE_KEY, "");
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
  assert.equal(result.manifest.supabaseAuthorityChunk, "assets/app.js");
  assert.equal(result.manifest.supabaseUrl, SUPABASE_URL);
  assert.equal(result.manifest.supabasePublicKeySha256, sha256Bytes(SUPABASE_ANON_KEY));
  assert.equal(result.manifest.schemaVersion, 3);
  assert.equal(parent.VITE_PUBLIC_URL, `${PRODUCTION}/`);
  assert.doesNotMatch(JSON.stringify(result.manifest), new RegExp(SUPABASE_ANON_KEY));
});

test("prepare records publishable-key path as canonical child anon key", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-publishable-"));
  const webDir = join(tmp, WEB_DIR_REL);
  mkdirSync(join(webDir, "assets"), { recursive: true });
  writeFileSync(
    join(webDir, "index.html"),
    `<html><script type="module" src="./assets/app.js"></script></html>`,
  );
  writeFileSync(
    join(webDir, "assets/app.js"),
    bakedJs(PRODUCTION, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
  );
  mkdirSync(join(tmp, "dist/ios"), { recursive: true });
  writeFileSync(
    join(tmp, ROLLUP_MAP_REL),
    `${JSON.stringify({
      schemaVersion: SIDECAR_SCHEMA_VERSION,
      originModule: ORIGIN_AUTHORITY_MODULE,
      originAuthorityChunk: "assets/app.js",
      originFoundInChunk: true,
      supabaseModule: SUPABASE_AUTHORITY_MODULE,
      supabaseAuthorityChunk: "assets/app.js",
      supabaseUrlFoundInChunk: true,
      supabasePublicKeyFoundInChunk: true,
    })}\n`,
  );
  const parent = {
    VITE_PUBLIC_URL: PRODUCTION,
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
    PATH: process.env.PATH,
  };
  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: parent,
    argv: [],
    hooks: {
      readGitHead: () => SOURCE_SHA,
      readGitStatus: () => "",
      spawnBuild: ({ env }) => {
        assert.equal(env.VITE_SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY);
        assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, "");
        assert.equal(env.VITE_SUPABASE_SERVICE_ROLE_KEY, "");
        return { status: 0, state: "succeeded" };
      },
      spawnCopy: () => {
        const pub = join(tmp, "ios/App/App/public");
        mkdirSync(join(pub, "assets"), { recursive: true });
        writeFileSync(
          join(pub, "index.html"),
          `<html><script type="module" src="./assets/app.js"></script></html>`,
        );
        writeFileSync(
          join(pub, "assets/app.js"),
          bakedJs(PRODUCTION, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
        );
        writeFileSync(
          join(pub, "ios-build-provenance.json"),
          readFileSync(join(tmp, "dist/ios/ios-build-provenance.json")),
        );
        writeFileSync(join(tmp, "ios/App/App/capacitor.config.json"), JSON.stringify({}));
        return { status: 0 };
      },
    },
  });
  assert.equal(result.manifest.supabasePublicKeySha256, sha256Bytes(SUPABASE_PUBLISHABLE_KEY));
  assert.equal(parent.VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY);
});

test("Vite loadEnv cannot refill child tombstones from isolated dotenv files", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ios-dotenv-loadenv-"));
  try {
    writeIsolatedDotenvTree(tmp);
    const parent = {
      PATH: process.env.PATH,
      VITE_PUBLIC_URL: `${PRODUCTION}/`,
      VITE_SUPABASE_URL: `${SUPABASE_URL}/`,
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      VITE_SUPABASE_PUBLISHABLE_KEY: "parent-publishable-must-not-leak",
    };
    const child = createChildEnv(parent, PRODUCTION, {
      supabaseUrl: SUPABASE_URL,
      supabasePublicKey: SUPABASE_ANON_KEY,
    });
    assert.equal(child.VITE_SUPABASE_PUBLISHABLE_KEY, "");
    assert.equal(child.VITE_SUPABASE_SERVICE_ROLE_KEY, "");
    assert.equal(parent.VITE_SUPABASE_PUBLISHABLE_KEY, "parent-publishable-must-not-leak");
    assert.equal(Object.hasOwn(parent, "VITE_SUPABASE_SERVICE_ROLE_KEY"), false);

    const suppressed = loadViteEnvInChildProcess(child, tmp);
    assert.equal(suppressed.status, 0, suppressed.stderr);
    const suppressedLoaded = JSON.parse(suppressed.stdout);
    assert.equal(suppressedLoaded.anon, SUPABASE_ANON_KEY);
    assert.equal(suppressedLoaded.publishable, "");
    assert.equal(suppressedLoaded.serviceRole, "");

    const leakEnv = { ...child };
    delete leakEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
    delete leakEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const leaked = loadViteEnvInChildProcess(leakEnv, tmp);
    assert.equal(leaked.status, 0, leaked.stderr);
    const leakedLoaded = JSON.parse(leaked.stdout);
    assert.equal(leakedLoaded.publishable, DOTENV_STALE_PUBLISHABLE);
    assert.equal(leakedLoaded.serviceRole, DOTENV_STALE_SECRET);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("isolated Vite build cannot emit dotenv secret after child tombstones", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ios-dotenv-vite-"));
  const viteBin = join(ROOT, "node_modules/vite/bin/vite.js");
  try {
    writeIsolatedViteApp(tmp);
    const child = createChildEnv(
      {
        PATH: process.env.PATH,
        VITE_PUBLIC_URL: PRODUCTION,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      },
      PRODUCTION,
      { supabaseUrl: SUPABASE_URL, supabasePublicKey: SUPABASE_ANON_KEY },
    );
    const built = spawnSync(process.execPath, [viteBin, "build"], {
      cwd: tmp,
      encoding: "utf8",
      env: { ...process.env, ...child },
    });
    assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
    const emitted = collectJsText(join(tmp, "dist"));
    assert.equal(emitted.includes(SUPABASE_ANON_KEY), true);
    assert.equal(emitted.includes(DOTENV_STALE_PUBLISHABLE), false);
    assert.equal(emitted.includes(DOTENV_STALE_SECRET), false);
    assert.equal(emitted.includes("sb_secret_"), false);

    const leakEnv = { ...process.env, ...child };
    delete leakEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
    delete leakEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const leaked = spawnSync(process.execPath, [viteBin, "build"], {
      cwd: tmp,
      encoding: "utf8",
      env: leakEnv,
    });
    assert.equal(leaked.status, 0, `${leaked.stdout}\n${leaked.stderr}`);
    const leakedJs = collectJsText(join(tmp, "dist"));
    assert.equal(leakedJs.includes(DOTENV_STALE_PUBLISHABLE), true);
    assert.equal(leakedJs.includes(DOTENV_STALE_SECRET), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("dotenv cannot silently supply prepare certification authority", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-dotenv-"));
  writeReadySpa(tmp, PRODUCTION);
  writeFileSync(
    join(tmp, ".env.local"),
    `VITE_SUPABASE_URL=${SUPABASE_URL}\nVITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}\n`,
  );
  assert.equal(
    await rejectedCode(() =>
      runPrepareIosNativeBundle({
        cwd: tmp,
        env: { VITE_PUBLIC_URL: PRODUCTION, PATH: process.env.PATH },
        argv: [],
        hooks: {
          readGitHead: () => SOURCE_SHA,
          readGitStatus: () => "",
          spawnBuild: () => {
            throw new Error("build must not run");
          },
        },
      }),
    ),
    "supabase_url_missing",
  );
});

test("prepare records an explicit Preview origin from the authority chunk", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-ios-preview-"));
  writeReadySpa(tmp, PREVIEW);
  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: governedEnv({ VITE_PUBLIC_URL: PREVIEW }),
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
        env: governedEnv(),
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
        env: governedEnv(),
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
        env: governedEnv(),
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
        env: governedEnv(),
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
        env: governedEnv(),
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
        env: governedEnv(),
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
  "real Vite TanStack buildApp emits client index.html and baked origin plus Supabase authority",
  { timeout: 600_000 },
  () => {
    const env = createChildEnv(
      {
        ...process.env,
        VITE_PUBLIC_URL: PRODUCTION,
        VITE_SUPABASE_URL: SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
      },
      PRODUCTION,
      { supabaseUrl: SUPABASE_URL, supabasePublicKey: SUPABASE_ANON_KEY },
    );
    assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, "");
    assert.equal(env.VITE_SUPABASE_SERVICE_ROLE_KEY, "");
    const res = spawnSync(process.execPath, [RUNNER], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 540_000,
      env,
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
    assert.equal(sidecar.supabaseModule, SUPABASE_AUTHORITY_MODULE);
    assert.equal(sidecar.originFoundInChunk, true);
    assert.equal(sidecar.supabaseUrlFoundInChunk, true);
    assert.equal(sidecar.supabasePublicKeyFoundInChunk, true);
    assert.equal(JSON.stringify(sidecar).includes(SUPABASE_ANON_KEY), false);
    const handoff = assertRollupMapHandoff(
      sidecar,
      join(ROOT, WEB_DIR_REL),
      PRODUCTION,
      SUPABASE_URL,
    );
    const originText = readFileSync(join(ROOT, WEB_DIR_REL, handoff.originAuthorityChunk), "utf8");
    const supabaseText = readFileSync(
      join(ROOT, WEB_DIR_REL, handoff.supabaseAuthorityChunk),
      "utf8",
    );
    assert.equal(originText.includes(PRODUCTION), true);
    assert.equal(supabaseText.includes(SUPABASE_URL), true);
    assert.equal(supabaseText.includes(SUPABASE_ANON_KEY), true);
    const packagedClient = collectJsText(join(ROOT, WEB_DIR_REL));
    assert.equal(packagedClient.includes(SUPABASE_ANON_KEY), true);
    assert.equal(packagedClient.includes(DOTENV_STALE_PUBLISHABLE), false);
    assert.equal(packagedClient.includes(DOTENV_STALE_SECRET), false);
    assert.doesNotMatch(handoff.originAuthorityChunk, /\.\./);
    assert.doesNotMatch(handoff.supabaseAuthorityChunk, /\.\./);
  },
);
