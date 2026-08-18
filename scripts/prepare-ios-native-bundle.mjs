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
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_PROVENANCE_REL,
  IosProvenanceError,
  NATIVE_CAPACITOR_CONFIG_REL,
  NATIVE_PUBLIC_REL,
  WEB_DIR_REL,
  assertSourceSha,
  assertSourceTreeClean,
  buildProvenanceManifest,
  createChildEnv,
  formatPrepareReport,
  hashWebDirFiles,
  readGitHead,
  readGitStatusPorcelain,
  resolveIosApiOrigin,
  verifyAppBundle,
  verifyCopiedBundle,
  writeProvenanceArtifacts,
} from "./lib/ios-build-provenance.mjs";

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
 * Vite/Nitro SPA prerender can leave an idle event loop after writing
 * dist/ios/client/index.html. Treat a successful emit as PASS even if the
 * child is then terminated so prepare can continue to copy/verify.
 *
 * @param {{ code: number | null, signal: NodeJS.Signals | null, indexHtmlExists: boolean }} args
 */
export function resolveViteIosBuildStatus(args) {
  if (args.code === 0) return 0;
  if (args.indexHtmlExists && args.signal) return 0;
  return args.code ?? 1;
}

const INDEX_STABLE_MS = 8000;
const BUILD_HARD_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * @param {number | undefined} pid
 * @param {NodeJS.Signals} signal
 */
function stopProcessGroup(pid, signal) {
  if (!pid) return;
  try {
    if (process.platform !== "win32") {
      process.kill(-pid, signal);
      return;
    }
  } catch {
    /* fall through to direct kill */
  }
  try {
    process.kill(pid, signal);
  } catch {
    /* already gone */
  }
}

/**
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} args
 * @returns {Promise<{ status: number | null }>}
 */
export function defaultSpawnBuild(args) {
  return new Promise((resolve) => {
    const indexHtml = join(args.cwd, WEB_DIR_REL, "index.html");
    const child = spawn("pnpm", ["build:ios"], {
      cwd: args.cwd,
      env: args.env,
      stdio: "inherit",
      detached: process.platform !== "win32",
    });

    const started = Date.now();
    let sawMissing = !existsSync(indexHtml);
    let lastSize = -1;
    let lastMtimeMs = -1;
    let stableSince = 0;
    let finished = false;

    const finish = (code, signal) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      resolve({
        status: resolveViteIosBuildStatus({
          code,
          signal,
          indexHtmlExists: existsSync(indexHtml),
        }),
      });
    };

    const timer = setInterval(() => {
      const now = Date.now();
      if (!existsSync(indexHtml)) {
        sawMissing = true;
        lastSize = -1;
        lastMtimeMs = -1;
        stableSince = 0;
      } else if (sawMissing) {
        const st = statSync(indexHtml);
        if (st.size === lastSize && st.mtimeMs === lastMtimeMs && st.size > 0) {
          if (!stableSince) stableSince = now;
          else if (now - stableSince >= INDEX_STABLE_MS) {
            process.stderr.write(
              "IOS-BUILD-PROVENANCE: Vite iOS emit is complete; terminating idle build process so prepare can continue.\n",
            );
            stopProcessGroup(child.pid, "SIGTERM");
            setTimeout(() => stopProcessGroup(child.pid, "SIGKILL"), 4000);
          }
        } else {
          lastSize = st.size;
          lastMtimeMs = st.mtimeMs;
          stableSince = now;
        }
      }
      if (now - started > BUILD_HARD_TIMEOUT_MS) {
        stopProcessGroup(child.pid, "SIGKILL");
      }
    }, 500);

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
  const readHead = hooks.readGitHead ?? readGitHead;
  const readStatus = hooks.readGitStatus ?? readGitStatusPorcelain;
  const sourceSha = assertSourceSha(readHead(cwd));
  assertSourceTreeClean(readStatus(cwd));

  const childEnv = createChildEnv(env, apiOrigin);
  const spawnBuild = hooks.spawnBuild ?? defaultSpawnBuild;
  const buildResult = await Promise.resolve(spawnBuild({ cwd, env: childEnv }));
  if ((buildResult.status ?? 1) !== 0) {
    throw new IosProvenanceError("pnpm build:ios failed", { code: "vite_ios_failed" });
  }

  const webDir = join(cwd, WEB_DIR_REL);
  const files = hashWebDirFiles(webDir);
  const manifest = buildProvenanceManifest({ sourceSha, apiOrigin, files });
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
