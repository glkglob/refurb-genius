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
import { spawnSync } from "node:child_process";
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
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} args
 */
export function defaultSpawnBuild(args) {
  return spawnSync("pnpm", ["build:ios"], {
    cwd: args.cwd,
    env: args.env,
    stdio: "inherit",
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
 * @property {(args: { cwd: string, env: NodeJS.ProcessEnv }) => { status: number | null }} [spawnBuild]
 * @property {(args: { cwd: string, env: NodeJS.ProcessEnv }) => { status: number | null }} [spawnCopy]
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
export function runPrepareIosNativeBundle(options) {
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
  const buildResult = spawnBuild({ cwd, env: childEnv });
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
  const copyResult = spawnCopy({ cwd, env: childEnv });
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

function main() {
  try {
    const result = runPrepareIosNativeBundle({
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
  main();
}
