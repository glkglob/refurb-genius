#!/usr/bin/env node
/**
 * IOS-BUILD-PROVENANCE-1 — governed iOS native bundle preparation.
 *
 * Atomic from the operator's perspective:
 *   validate origin → source-identity preflight → Vite iOS build (explicit
 *   child env) → provenance → `cap copy ios` → copied-bundle verify
 *   including mandatory no-server.url.
 *
 *   pnpm prepare:ios
 *   pnpm ios:verify-copied
 *   pnpm ios:verify-app-bundle -- --app /path/to/App.app
 */
import { spawn, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_PROVENANCE_REL,
  IosProvenanceError,
  NATIVE_CAPACITOR_CONFIG_REL,
  NATIVE_PUBLIC_REL,
  ROLLUP_MAP_REL,
  WEB_DIR_REL,
  assertAuthorityChunkContainsOrigin,
  assertAuthorityChunkContainsSupabaseConfig,
  assertRollupMapHandoff,
  assertSourceSha,
  assertSourceTreeClean,
  assertSpaReady,
  buildProvenanceManifest,
  createChildEnv,
  formatPrepareReport,
  hashWebDirFiles,
  readGitHead,
  readGitStatusPorcelain,
  readRollupMap,
  resolveIosApiOrigin,
  resolveIosSupabaseRuntimeConfig,
  sha256Bytes,
  verifyAppBundle,
  verifyCopiedBundle,
  writeProvenanceArtifacts,
} from "./lib/ios-build-provenance.mjs";

const RUNNER_PATH = fileURLToPath(new URL("./run-ios-vite-build.mjs", import.meta.url));
export const BUILD_HARD_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * @param {string[]} argv
 */
export function parseCliArgs(argv) {
  /** @type {{ mode: "prepare" | "verify-copied" | "verify-app-bundle", app: string | null, expected: string | null }} */
  const out = { mode: "prepare", app: null, expected: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--verify-copied") {
      out.mode = "verify-copied";
      continue;
    }
    if (arg === "--verify-app-bundle") {
      out.mode = "verify-app-bundle";
      continue;
    }
    if (arg === "--") {
      continue;
    }
    if (arg === "--verify-installed") {
      throw new IosProvenanceError(
        "ios:verify-installed is not a command. Use ios:verify-app-bundle for a local App.app.",
        { code: "usage" },
      );
    }
    if (arg === "--app") {
      out.app = argv[i + 1] ?? "";
      i += 1;
      if (!out.app) {
        throw new IosProvenanceError("--app requires a path to a local App.app", { code: "usage" });
      }
      continue;
    }
    if (arg === "--expected") {
      out.expected = argv[i + 1] ?? "";
      i += 1;
      if (!out.expected) {
        throw new IosProvenanceError("--expected requires a provenance file path", {
          code: "usage",
        });
      }
      continue;
    }
    throw new IosProvenanceError(`Unknown argument: ${arg}`, { code: "usage" });
  }
  return out;
}

/**
 * Classify the governed Vite runner exit. No signal is ever success.
 *
 * @param {{ code: number | null, signal: NodeJS.Signals | string | null, timedOut?: boolean }} args
 */
export function classifyRunnerExit(args) {
  if (args.timedOut) {
    return { ok: false, state: "failed_timeout" };
  }
  if (args.signal) {
    return { ok: false, state: "failed_signal" };
  }
  if (args.code === 0) {
    return { ok: true, state: "succeeded" };
  }
  if (args.code == null) {
    return { ok: false, state: "failed_crash" };
  }
  return { ok: false, state: "failed_nonzero" };
}

/**
 * @param {{
 *   cwd: string,
 *   env: NodeJS.ProcessEnv,
 *   timeoutMs?: number,
 *   spawnImpl?: typeof spawn,
 *   runnerPath?: string,
 * }} args
 * @returns {Promise<{ status: number, state: string, code: number | null, signal: NodeJS.Signals | string | null, timedOut: boolean, killCount: number }>}
 */
export function defaultSpawnBuild(args) {
  return new Promise((resolve) => {
    const spawnImpl = args.spawnImpl ?? spawn;
    const runnerPath = args.runnerPath ?? RUNNER_PATH;
    const timeoutMs = args.timeoutMs ?? BUILD_HARD_TIMEOUT_MS;
    const child = spawnImpl(process.execPath, [runnerPath], {
      cwd: args.cwd,
      env: args.env,
      stdio: "inherit",
    });

    let finished = false;
    let timedOut = false;
    let killCount = 0;
    /** @type {NodeJS.Timeout | null} */
    let timeoutHandle = null;

    const finish = (code, signal) => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      const classified = classifyRunnerExit({ code, signal, timedOut });
      resolve({
        status: classified.ok ? 0 : 1,
        state: classified.state,
        code,
        signal,
        timedOut,
        killCount,
      });
    };

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      if (child.exitCode == null && child.signalCode == null) {
        killCount += 1;
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }, timeoutMs);

    child.on("error", () => finish(1, null));
    child.on("exit", (code, signal) => finish(code, signal));
  });
}

/**
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} args
 */
export function defaultSpawnCopy(args) {
  return spawnSync("pnpm", ["exec", "cap", "copy", "ios"], {
    cwd: args.cwd,
    env: args.env,
    stdio: "inherit",
  });
}

/**
 * @typedef {object} PrepareHooks
 * @property {(args: { cwd: string, env: NodeJS.ProcessEnv }) => { status: number | null } | Promise<{ status: number | null }>} [spawnBuild]
 * @property {(args: { cwd: string, env: NodeJS.ProcessEnv }) => { status: number | null } | Promise<{ status: number | null }>} [spawnCopy]
 * @property {(cwd: string) => string} [readGitHead]
 * @property {(cwd: string) => string} [readGitStatus]
 */

/**
 * @param {{
 *   cwd: string,
 *   env: NodeJS.ProcessEnv,
 *   argv?: string[],
 *   hooks?: PrepareHooks,
 * }} options
 */
export async function runPrepareIosNativeBundle(options) {
  const cwd = options.cwd;
  const env = options.env;
  const args = parseCliArgs(options.argv ?? []);
  const hooks = options.hooks ?? {};
  const expectedPath = resolve(cwd, args.expected ?? EXPECTED_PROVENANCE_REL);

  if (args.mode === "verify-copied") {
    const manifest = verifyCopiedBundle({
      webDir: join(cwd, WEB_DIR_REL),
      publicDir: join(cwd, NATIVE_PUBLIC_REL),
      expectedProvenancePath: expectedPath,
      capacitorConfigPath: join(cwd, NATIVE_CAPACITOR_CONFIG_REL),
    });
    return { status: 0, manifest, output: formatPrepareReport(manifest) };
  }

  if (args.mode === "verify-app-bundle") {
    if (!args.app) {
      throw new IosProvenanceError(
        "--verify-app-bundle requires --app /path/to/App.app (local packaged bundle only)",
        { code: "usage" },
      );
    }
    const manifest = verifyAppBundle({
      appPath: resolve(cwd, args.app),
      expectedProvenancePath: expectedPath,
    });
    return { status: 0, manifest, output: formatPrepareReport(manifest) };
  }

  const apiOrigin = resolveIosApiOrigin(env.VITE_PUBLIC_URL);
  const supabaseRuntime = resolveIosSupabaseRuntimeConfig(env);
  const readHead = hooks.readGitHead ?? readGitHead;
  const readStatus = hooks.readGitStatus ?? readGitStatusPorcelain;
  const sourceSha = assertSourceSha(readHead(cwd));
  assertSourceTreeClean(readStatus(cwd));

  const childEnv = createChildEnv(env, apiOrigin, supabaseRuntime);
  const spawnBuild = hooks.spawnBuild ?? defaultSpawnBuild;
  const buildResult = await Promise.resolve(spawnBuild({ cwd, env: childEnv }));
  if (buildResult.timedOut || buildResult.state === "failed_timeout") {
    throw new IosProvenanceError("Governed Vite runner timed out", { code: "failed_timeout" });
  }
  if (buildResult.signal || buildResult.state === "failed_signal") {
    throw new IosProvenanceError("Governed Vite runner exited on a signal", {
      code: "failed_signal",
    });
  }
  if (buildResult.state === "failed_crash") {
    throw new IosProvenanceError("Governed Vite runner crashed without an exit code or signal", {
      code: "failed_crash",
    });
  }
  if ((buildResult.status ?? 1) !== 0) {
    throw new IosProvenanceError("Governed Vite runner failed", { code: "vite_ios_failed" });
  }

  const webDir = join(cwd, WEB_DIR_REL);
  const rollupMap = readRollupMap(join(cwd, ROLLUP_MAP_REL));
  const handoff = assertRollupMapHandoff(rollupMap, webDir, apiOrigin, supabaseRuntime.supabaseUrl);
  const originAuthorityChunk = handoff.originAuthorityChunk;
  const supabaseAuthorityChunk = handoff.supabaseAuthorityChunk;
  assertSpaReady(webDir);
  assertAuthorityChunkContainsOrigin(webDir, originAuthorityChunk, apiOrigin);
  assertAuthorityChunkContainsSupabaseConfig(
    webDir,
    supabaseAuthorityChunk,
    supabaseRuntime.supabaseUrl,
    supabaseRuntime.supabasePublicKey,
  );
  const files = hashWebDirFiles(webDir);
  const supabasePublicKeySha256 = sha256Bytes(supabaseRuntime.supabasePublicKey);
  const manifest = buildProvenanceManifest({
    sourceSha,
    apiOrigin,
    files,
    originAuthorityChunk,
    supabaseUrl: supabaseRuntime.supabaseUrl,
    supabasePublicKeySha256,
    supabaseAuthorityChunk,
  });
  writeProvenanceArtifacts({
    webDir,
    expectedPath: join(cwd, EXPECTED_PROVENANCE_REL),
    manifest,
  });

  const spawnCopy = hooks.spawnCopy ?? defaultSpawnCopy;
  const copyResult = await Promise.resolve(spawnCopy({ cwd, env: childEnv }));
  if ((copyResult.status ?? 1) !== 0) {
    throw new IosProvenanceError("pnpm exec cap copy ios failed", { code: "cap_copy_failed" });
  }

  verifyCopiedBundle({
    webDir,
    publicDir: join(cwd, NATIVE_PUBLIC_REL),
    expectedProvenancePath: join(cwd, EXPECTED_PROVENANCE_REL),
    capacitorConfigPath: join(cwd, NATIVE_CAPACITOR_CONFIG_REL),
  });

  if (manifest.apiOrigin !== apiOrigin) {
    throw new IosProvenanceError("Provenance apiOrigin must equal the normalized child origin", {
      code: "provenance_mismatch",
    });
  }
  if (manifest.supabaseUrl !== supabaseRuntime.supabaseUrl) {
    throw new IosProvenanceError(
      "Provenance supabaseUrl must equal the normalized child Supabase URL",
      { code: "provenance_mismatch" },
    );
  }
  if (manifest.supabasePublicKeySha256 !== supabasePublicKeySha256) {
    throw new IosProvenanceError("Provenance supabasePublicKeySha256 must match the selected key", {
      code: "provenance_mismatch",
    });
  }

  return { status: 0, manifest, output: formatPrepareReport(manifest), childEnv };
}

function isMain() {
  const self = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] && resolve(process.argv[1]);
  return self === invoked;
}

async function main() {
  try {
    const result = await runPrepareIosNativeBundle({
      cwd: process.cwd(),
      env: process.env,
      argv: process.argv.slice(2),
    });
    if (result.output) process.stdout.write(result.output);
    process.exit(result.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof IosProvenanceError ? err.code : "unexpected";
    process.stderr.write(`IOS-BUILD-PROVENANCE\nStatus: FAIL\ncode: ${code}\n${message}\n`);
    process.exit(1);
  }
}

if (isMain()) {
  void main();
}
