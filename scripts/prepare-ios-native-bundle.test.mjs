/**
 * Focused tests for the governed prepare:ios CLI.
 *
 * Run: node --test scripts/prepare-ios-native-bundle.test.mjs
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { IosProvenanceError } from "./lib/ios-build-provenance.mjs";
import {
  parseCliArgs,
  resolveViteIosBuildStatus,
  runPrepareIosNativeBundle,
} from "./prepare-ios-native-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts/prepare-ios-native-bundle.mjs");
const PRODUCTION = "https://www.refurbgenius.info";
const PREVIEW = "https://refurb-genius-git-fix-example.vercel.app";
const SOURCE_SHA = "487dd4d0c6298200060ef79b05fa1b0e7b5677ad";

/**
 * @param {Record<string, string | undefined>} env
 * @param {string[]} argv
 */
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

/**
 * @param {() => Promise<unknown>} fn
 */
async function rejectedCode(fn) {
  try {
    await fn();
    throw new Error("expected IosProvenanceError");
  } catch (err) {
    assert.ok(err instanceof IosProvenanceError, String(err));
    return err.code;
  }
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
  const parsed = parseCliArgs(["--verify-app-bundle", "--app", "/tmp/App.app"]);
  assert.equal(parsed.mode, "verify-app-bundle");
  assert.equal(parsed.app, "/tmp/App.app");
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
  assert.doesNotMatch(missing.stderr, /vite_ios_failed|cap_copy_failed/);
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

test("idle Vite after a successful index.html emit is treated as build PASS", () => {
  assert.equal(resolveViteIosBuildStatus({ code: 0, signal: null, indexHtmlExists: true }), 0);
  assert.equal(
    resolveViteIosBuildStatus({ code: null, signal: "SIGTERM", indexHtmlExists: true }),
    0,
  );
  assert.equal(resolveViteIosBuildStatus({ code: 1, signal: null, indexHtmlExists: false }), 1);
});

test("prepare spawns build with explicit normalized child env and does not mutate parent", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-ios-"));
  mkdirSync(join(tmp, "dist/ios/client"), { recursive: true });
  writeFileSync(join(tmp, "dist/ios/client/index.html"), "<html>ok</html>");
  writeFileSync(join(tmp, "dist/ios/client/assets-app.js"), "1");
  mkdirSync(join(tmp, "ios/App/App/public"), { recursive: true });

  /** @type {NodeJS.ProcessEnv | null} */
  let buildEnv = null;
  /** @type {NodeJS.ProcessEnv | null} */
  let copyEnv = null;
  const parent = { VITE_PUBLIC_URL: `${PRODUCTION}/`, PATH: process.env.PATH };

  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: parent,
    argv: [],
    hooks: {
      readGitHead: () => SOURCE_SHA,
      readGitStatus: () => "",
      spawnBuild: ({ env }) => {
        buildEnv = env;
        return { status: 0 };
      },
      spawnCopy: ({ env }) => {
        copyEnv = env;
        writeFileSync(join(tmp, "ios/App/App/public/index.html"), "<html>ok</html>");
        writeFileSync(join(tmp, "ios/App/App/public/assets-app.js"), "1");
        writeFileSync(
          join(tmp, "ios/App/App/public/ios-build-provenance.json"),
          readFileSync(join(tmp, "dist/ios/ios-build-provenance.json")),
        );
        writeFileSync(
          join(tmp, "ios/App/App/capacitor.config.json"),
          JSON.stringify({ appId: "com.refurbgenius.app", webDir: "dist/ios/client" }),
        );
        return { status: 0 };
      },
    },
  });

  assert.equal(result.status, 0);
  assert.equal(result.manifest.apiOrigin, PRODUCTION);
  assert.equal(result.manifest.sourceSha, SOURCE_SHA);
  assert.equal(parent.VITE_PUBLIC_URL, `${PRODUCTION}/`);
  assert.equal(buildEnv?.VITE_PUBLIC_URL, PRODUCTION);
  assert.equal(copyEnv?.VITE_PUBLIC_URL, PRODUCTION);
  assert.match(result.output, /Status: PASS/);
  assert.match(result.output, /server\.url: absent/);
});

test("prepare records an explicit Preview origin on the manifest", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "prepare-ios-preview-"));
  mkdirSync(join(tmp, "dist/ios/client"), { recursive: true });
  writeFileSync(join(tmp, "dist/ios/client/index.html"), "<html>preview</html>");
  mkdirSync(join(tmp, "ios/App/App/public"), { recursive: true });

  const result = await runPrepareIosNativeBundle({
    cwd: tmp,
    env: { VITE_PUBLIC_URL: PREVIEW, PATH: process.env.PATH },
    argv: [],
    hooks: {
      readGitHead: () => SOURCE_SHA,
      readGitStatus: () => "",
      spawnBuild: () => ({ status: 0 }),
      spawnCopy: () => {
        writeFileSync(join(tmp, "ios/App/App/public/index.html"), "<html>preview</html>");
        writeFileSync(
          join(tmp, "ios/App/App/public/ios-build-provenance.json"),
          readFileSync(join(tmp, "dist/ios/ios-build-provenance.json")),
        );
        writeFileSync(join(tmp, "ios/App/App/capacitor.config.json"), JSON.stringify({}));
        return { status: 0 };
      },
    },
  });

  assert.equal(result.manifest.apiOrigin, PREVIEW);
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
          spawnCopy: () => {
            throw new Error("copy must not run");
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
