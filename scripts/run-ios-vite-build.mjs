#!/usr/bin/env node
/**
 * Governed iOS Vite build runner.
 *
 * Uses Vite's public environment-aware API:
 *   createBuilder({ configFile: vite.ios.config.ts })
 *   await builder.buildApp()
 *
 * That is what runs TanStack Start's client+ssr environments and the
 * post-build SPA prerender. Legacy `build()` is a single-environment
 * shortcut and is not a governed iOS success path.
 *
 * Origin authority is captured per `this.environment` during generateBundle.
 * A matching environment must have consumer === "client" and an exact
 * resolved build.outDir equal to the packaged client root. After
 * fileName deduplication, zero matches fail, more than one match is
 * ambiguous, and the single selected chunk is re-read from disk before
 * the handoff sidecar is written.
 *
 * Signals, timeouts, and rejections are failures. The sidecar is handoff
 * evidence only; certification authority is the schema v2 provenance
 * manifest written by prepare.
 */
import { rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilder } from "vite";
import {
  IosProvenanceError,
  ORIGIN_AUTHORITY_MODULE,
  ROLLUP_MAP_REL,
  SIDECAR_SCHEMA_VERSION,
  VITE_CONFIG,
  WEB_DIR_REL,
  assertAuthorityChunkContainsOrigin,
  assertSafeWebDirRelativePath,
  isOriginAuthorityModule,
  resolveIosApiOrigin,
} from "./lib/ios-build-provenance.mjs";

export const DIST_IOS_REL = "dist/ios";
export const ORIGIN_CAPTURE_PLUGIN_NAME = "ios-origin-authority-capture";

/**
 * @param {string} cwd
 * @returns {string}
 */
export function resolveGuardedDistIos(cwd) {
  const root = resolve(cwd);
  const target = resolve(root, DIST_IOS_REL);
  const expected = resolve(root, "dist", "ios");
  if (target !== expected) {
    throw new IosProvenanceError("Refusing to touch a dist/ios path outside the worktree", {
      code: "dist_ios_guard",
    });
  }
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== join(root, "dist", "ios") || !target.startsWith(prefix)) {
    throw new IosProvenanceError("dist/ios deletion is limited to this worktree", {
      code: "dist_ios_guard",
    });
  }
  return target;
}

/**
 * @param {string} cwd
 */
export async function removeStaleDistIos(cwd) {
  const target = resolveGuardedDistIos(cwd);
  await rm(target, { recursive: true, force: true });
}

/**
 * Exact directory identity. Not a prefix / "contained within" check.
 *
 * @param {unknown} dir
 * @returns {string}
 */
export function resolveExactDirectory(dir) {
  if (typeof dir !== "string" || dir.trim() === "") return "";
  return resolve(dir);
}

/**
 * Packaged client environment: consumer === "client" AND exact outDir.
 *
 * @param {{ consumer?: unknown, outDir?: unknown, config?: { consumer?: unknown, build?: { outDir?: unknown } } } | null | undefined} environmentOrRecord
 * @param {string} expectedClientOutDir
 * @returns {boolean}
 */
export function isPackagedClientEnvironment(environmentOrRecord, expectedClientOutDir) {
  if (!environmentOrRecord || typeof environmentOrRecord !== "object") return false;
  const consumer = environmentOrRecord.config?.consumer ?? environmentOrRecord.consumer;
  const outDir = environmentOrRecord.config?.build?.outDir ?? environmentOrRecord.outDir;
  if (consumer !== "client") return false;
  const expected = resolveExactDirectory(expectedClientOutDir);
  const actual = resolveExactDirectory(outDir);
  return expected !== "" && actual !== "" && actual === expected;
}

/**
 * @param {unknown} item
 * @returns {unknown[]}
 */
export function collectChunkModuleIds(item) {
  if (!item || typeof item !== "object") return [];
  const record = /** @type {Record<string, unknown>} */ (item);
  /** @type {unknown[]} */
  const ids = [];
  if (Array.isArray(record.moduleIds)) ids.push(...record.moduleIds);
  if (record.facadeModuleId) ids.push(record.facadeModuleId);
  if (record.modules && typeof record.modules === "object") {
    ids.push(...Object.keys(/** @type {object} */ (record.modules)));
  }
  return ids;
}

/**
 * Isolated capture state keyed by the actual `this.environment` object.
 * Never overwrites a single last-environment record.
 *
 * @returns {{
 *   byEnvironment: Map<object, { consumer: unknown, outDir: unknown, fileNames: Set<string> }>,
 *   plugin: { name: string, apply: string, generateBundle: Function },
 * }}
 */
export function createOriginAuthorityCaptureState() {
  /** @type {Map<object, { consumer: unknown, outDir: unknown, fileNames: Set<string> }>} */
  const byEnvironment = new Map();
  return {
    byEnvironment,
    plugin: {
      name: ORIGIN_CAPTURE_PLUGIN_NAME,
      apply: "build",
      generateBundle(_options, bundle) {
        const environment = this.environment;
        if (!environment || typeof environment !== "object") return;
        let rec = byEnvironment.get(environment);
        if (!rec) {
          rec = {
            consumer: environment.config?.consumer,
            outDir: environment.config?.build?.outDir,
            fileNames: new Set(),
          };
          byEnvironment.set(environment, rec);
        }
        if (!bundle || typeof bundle !== "object") return;
        for (const item of Object.values(bundle)) {
          if (!item || /** @type {{ type?: unknown }} */ (item).type !== "chunk") continue;
          if (!collectChunkModuleIds(item).some((id) => isOriginAuthorityModule(id))) continue;
          const fileName = String(
            /** @type {{ fileName?: unknown }} */ (item).fileName || "",
          ).replace(/\\/g, "/");
          rec.fileNames.add(fileName);
        }
      },
    },
  };
}

/**
 * After deduplication by emitted fileName:
 *   0 → origin_module_unmapped
 *   1 → that relative path
 *  >1 → origin_authority_ambiguous
 *
 * @param {Map<object, { consumer: unknown, outDir: unknown, fileNames: Set<string> }>} byEnvironment
 * @param {string} expectedClientOutDir
 * @returns {string}
 */
export function selectUniqueClientAuthorityChunk(byEnvironment, expectedClientOutDir) {
  /** @type {Set<string>} */
  const distinct = new Set();
  for (const rec of byEnvironment.values()) {
    if (!isPackagedClientEnvironment(rec, expectedClientOutDir)) continue;
    for (const fileName of rec.fileNames) {
      distinct.add(assertSafeWebDirRelativePath(fileName));
    }
  }
  if (distinct.size === 0) {
    throw new IosProvenanceError(
      `Could not map ${ORIGIN_AUTHORITY_MODULE} to a client chunk under ${WEB_DIR_REL}`,
      { code: "origin_module_unmapped" },
    );
  }
  if (distinct.size > 1) {
    throw new IosProvenanceError(
      `Origin authority module mapped to multiple client chunks: ${[...distinct].join(", ")}`,
      { code: "origin_authority_ambiguous" },
    );
  }
  return [...distinct][0];
}

/**
 * @param {{
 *   cwd: string,
 *   env: NodeJS.ProcessEnv,
 *   createBuilderImpl?: (inlineConfig: object) => Promise<{ buildApp: () => Promise<unknown> }>,
 * }} args
 */
export async function runIosViteBuild(args) {
  const cwd = args.cwd;
  const apiOrigin = resolveIosApiOrigin(args.env.VITE_PUBLIC_URL);
  await removeStaleDistIos(cwd);

  const expectedClientOutDir = resolve(cwd, WEB_DIR_REL);
  const capture = createOriginAuthorityCaptureState();
  const createBuilderImpl = args.createBuilderImpl ?? createBuilder;

  try {
    const builder = await createBuilderImpl({
      configFile: resolve(cwd, VITE_CONFIG),
      root: cwd,
      plugins: [capture.plugin],
    });
    if (!builder || typeof builder.buildApp !== "function") {
      throw new Error("createBuilder did not return a builder with buildApp()");
    }
    await builder.buildApp();
  } catch (err) {
    if (err instanceof IosProvenanceError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new IosProvenanceError(`Vite buildApp() rejected: ${message}`, {
      code: "vite_ios_failed",
    });
  }

  const originAuthorityChunk = selectUniqueClientAuthorityChunk(
    capture.byEnvironment,
    expectedClientOutDir,
  );
  assertAuthorityChunkContainsOrigin(expectedClientOutDir, originAuthorityChunk, apiOrigin);

  const map = {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    originModule: ORIGIN_AUTHORITY_MODULE,
    originAuthorityChunk,
    originFoundInChunk: true,
  };
  const mapPath = resolve(cwd, ROLLUP_MAP_REL);
  await writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return { apiOrigin, originAuthorityChunk, mapPath };
}

function isMain() {
  const self = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] && resolve(process.argv[1]);
  return self === invoked;
}

async function main() {
  try {
    await runIosViteBuild({ cwd: process.cwd(), env: process.env });
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof IosProvenanceError ? err.code : "vite_ios_failed";
    process.stderr.write(`IOS-VITE-BUILD\nStatus: FAIL\ncode: ${code}\n${message}\n`);
    process.exit(1);
  }
}

if (isMain()) {
  void main();
}
