/**
 * IOS-BUILD-PROVENANCE-1 — deterministic iOS native-bundle provenance.
 *
 * Authority is source SHA + effective API origin + SHA-256 file map.
 * Timestamps are not provenance authority. No secrets.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

export const SCHEMA_VERSION = 1;
export const BUILD_IDENTITY = "ios-capacitor-spa";
export const BUILD_MODE = "production";
export const VITE_CONFIG = "vite.ios.config.ts";
export const PROVENANCE_FILE_NAME = "ios-build-provenance.json";
export const WEB_DIR_REL = "dist/ios/client";
export const EXPECTED_PROVENANCE_REL = "dist/ios/ios-build-provenance.json";
export const NATIVE_PUBLIC_REL = "ios/App/App/public";
export const NATIVE_CAPACITOR_CONFIG_REL = "ios/App/App/capacitor.config.json";
export const APP_BUNDLE_PUBLIC_DIR = "public";
export const APP_BUNDLE_CAPACITOR_CONFIG = "capacitor.config.json";

/** Capacitor `cap copy ios` injects these after wiping and copying webDir. */
export const CAPACITOR_INJECTED_ALLOWLIST = Object.freeze(["cordova.js", "cordova_plugins.js"]);

export const PROVENANCE_KEYS = Object.freeze([
  "schemaVersion",
  "sourceSha",
  "apiOrigin",
  "buildIdentity",
  "buildMode",
  "viteConfig",
  "webDir",
  "nativePublicDir",
  "files",
  "bundleFingerprint",
]);

const SECRET_KEY =
  /secret|token|password|authorization|service_role|api[_-]?key|private[_-]?key|bearer|access_token|refresh_token/i;
const SECRET_VALUE =
  /service_role|sk-proj-|sk-ant-|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|SENTRY_AUTH_TOKEN/i;
const TIMESTAMP_KEY = /timestamp|createdat|builtat|generatedat|date/i;
const SOURCE_SHA_RE = /^[0-9a-f]{40}$/;
const FINGERPRINT_RE = /^[0-9a-f]{64}$/;

export class IosProvenanceError extends Error {
  /**
   * @param {string} message
   * @param {{ code: string }} opts
   */
  constructor(message, opts) {
    super(message);
    this.name = "IosProvenanceError";
    this.code = opts.code;
  }
}

/**
 * @param {unknown} envValue
 * @returns {string}
 */
export function resolveIosApiOrigin(envValue) {
  if (typeof envValue !== "string" || envValue.trim() === "") {
    throw new IosProvenanceError("VITE_PUBLIC_URL is not configured", { code: "origin_missing" });
  }
  return normalizeHttpsOrigin(envValue);
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeHttpsOrigin(raw) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new IosProvenanceError("Production API origin is empty", { code: "origin_invalid" });
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new IosProvenanceError("Production API origin is not a valid URL", {
      code: "origin_invalid",
    });
  }

  if (url.protocol !== "https:") {
    throw new IosProvenanceError("Production API origin must use HTTPS", {
      code: "origin_not_https",
    });
  }

  if (url.username || url.password) {
    throw new IosProvenanceError("Production API origin must not include credentials", {
      code: "origin_invalid",
    });
  }

  return url.origin;
}

/**
 * Child env for `pnpm build:ios`. Does not mutate `parentEnv`.
 *
 * @param {NodeJS.ProcessEnv} parentEnv
 * @param {string} apiOrigin
 * @returns {NodeJS.ProcessEnv}
 */
export function createChildEnv(parentEnv, apiOrigin) {
  return { ...parentEnv, VITE_PUBLIC_URL: apiOrigin };
}

/**
 * @param {string} cwd
 * @returns {string}
 */
export function readGitHead(cwd) {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
}

/**
 * @param {string} cwd
 * @returns {string}
 */
export function readGitStatusPorcelain(cwd) {
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd,
    encoding: "utf8",
  });
}

/**
 * @param {string} sha
 * @returns {string}
 */
export function assertSourceSha(sha) {
  if (typeof sha !== "string" || !SOURCE_SHA_RE.test(sha)) {
    throw new IosProvenanceError("Source SHA must be a full 40-character lowercase hex Git SHA", {
      code: "source_sha_invalid",
    });
  }
  return sha;
}

/**
 * Parse `git status --porcelain --untracked-files=all`.
 * Ignored generated outputs are omitted by git and do not appear here.
 *
 * @param {string} porcelain
 * @returns {{ tracked: string[], untracked: string[] }}
 */
export function classifyGitPorcelain(porcelain) {
  const tracked = [];
  const untracked = [];
  const text = porcelain ?? "";
  for (const rawLine of text.split("\n")) {
    if (!rawLine) continue;
    const code = rawLine.slice(0, 2);
    const pathPart = rawLine.slice(3);
    if (code === "!!") continue;
    if (code === "??") {
      untracked.push(pathPart);
      continue;
    }
    tracked.push(pathPart);
  }
  return { tracked, untracked };
}

/**
 * Fail on tracked modifications and on non-ignored untracked source files.
 * Ignored generated outputs are not source identity.
 *
 * @param {string} porcelain
 */
export function assertSourceTreeClean(porcelain) {
  const { tracked, untracked } = classifyGitPorcelain(porcelain);
  if (tracked.length > 0) {
    throw new IosProvenanceError(
      `Refusing authorised iOS prepare: tracked modifications would make HEAD SHA a lie.\n${tracked.join("\n")}`,
      { code: "dirty_tracked" },
    );
  }
  if (untracked.length > 0) {
    throw new IosProvenanceError(
      `Refusing authorised iOS prepare: non-ignored untracked source files are not in HEAD.\n${untracked.join("\n")}`,
      { code: "dirty_untracked" },
    );
  }
}

/**
 * @param {Buffer | string} buf
 * @returns {string}
 */
export function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function listRelativeFiles(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new IosProvenanceError(`Directory not found: ${root}`, { code: "bundle_missing" });
  }
  /** @type {string[]} */
  const files = [];
  /**
   * @param {string} dir
   */
  function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
      } else if (ent.isFile()) {
        files.push(relative(root, abs).split(sep).join("/"));
      }
    }
  }
  walk(root);
  files.sort();
  return files;
}

/**
 * Hash a webDir tree. The provenance file is excluded from the file map
 * so the fingerprint is not self-referential.
 *
 * @param {string} root
 * @returns {Record<string, string>}
 */
export function hashWebDirFiles(root) {
  /** @type {Record<string, string>} */
  const files = {};
  for (const rel of listRelativeFiles(root)) {
    if (rel === PROVENANCE_FILE_NAME) continue;
    files[rel] = sha256File(join(root, rel));
  }
  return files;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(/** @type {Record<string, unknown>} */ (value)[key]);
    }
    return out;
  }
  return value;
}

/**
 * @param {{
 *   schemaVersion?: number,
 *   sourceSha: string,
 *   apiOrigin: string,
 *   buildIdentity?: string,
 *   buildMode?: string,
 *   files: Record<string, string>,
 * }} input
 * @returns {string}
 */
export function computeBundleFingerprint(input) {
  const payload = {
    schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
    sourceSha: input.sourceSha,
    apiOrigin: input.apiOrigin,
    buildIdentity: input.buildIdentity ?? BUILD_IDENTITY,
    buildMode: input.buildMode ?? BUILD_MODE,
    files: input.files,
  };
  return sha256Bytes(JSON.stringify(canonicalize(payload)));
}

/**
 * @param {{ sourceSha: string, apiOrigin: string, files: Record<string, string> }} input
 */
export function buildProvenanceManifest(input) {
  const sourceSha = assertSourceSha(input.sourceSha);
  const apiOrigin = resolveIosApiOrigin(input.apiOrigin);
  const files = sortFileMap(input.files);
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    sourceSha,
    apiOrigin,
    buildIdentity: BUILD_IDENTITY,
    buildMode: BUILD_MODE,
    viteConfig: VITE_CONFIG,
    webDir: WEB_DIR_REL,
    nativePublicDir: NATIVE_PUBLIC_REL,
    files,
    bundleFingerprint: computeBundleFingerprint({ sourceSha, apiOrigin, files }),
  };
  assertProvenanceHasNoSecrets(manifest);
  return manifest;
}

/**
 * @param {Record<string, string>} files
 * @returns {Record<string, string>}
 */
export function sortFileMap(files) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of Object.keys(files).sort()) {
    out[key] = files[key];
  }
  return out;
}

/**
 * @param {unknown} manifest
 */
export function assertProvenanceHasNoSecrets(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new IosProvenanceError("Provenance manifest must be an object", {
      code: "provenance_invalid",
    });
  }
  const record = /** @type {Record<string, unknown>} */ (manifest);
  for (const key of Object.keys(record)) {
    if (!PROVENANCE_KEYS.includes(key)) {
      throw new IosProvenanceError(`Provenance contains unexpected key: ${key}`, {
        code: "provenance_secrets",
      });
    }
    if (SECRET_KEY.test(key) || TIMESTAMP_KEY.test(key)) {
      throw new IosProvenanceError(`Provenance contains forbidden key: ${key}`, {
        code: "provenance_secrets",
      });
    }
    const value = record[key];
    if (typeof value === "string" && SECRET_VALUE.test(value)) {
      throw new IosProvenanceError("Provenance value looks like a secret", {
        code: "provenance_secrets",
      });
    }
  }
  if ("env" in record || "process.env" in record) {
    throw new IosProvenanceError("Provenance must not dump environment", {
      code: "provenance_secrets",
    });
  }
}

/**
 * @param {unknown} manifest
 */
export function assertValidProvenance(manifest) {
  assertProvenanceHasNoSecrets(manifest);
  const record = /** @type {Record<string, unknown>} */ (manifest);
  if (record.schemaVersion !== SCHEMA_VERSION) {
    throw new IosProvenanceError("Unsupported provenance schemaVersion", {
      code: "provenance_invalid",
    });
  }
  assertSourceSha(/** @type {string} */ (record.sourceSha));
  if (record.apiOrigin !== resolveIosApiOrigin(record.apiOrigin)) {
    throw new IosProvenanceError("Provenance apiOrigin is not a normalized HTTPS origin", {
      code: "provenance_invalid",
    });
  }
  if (record.buildIdentity !== BUILD_IDENTITY || record.buildMode !== BUILD_MODE) {
    throw new IosProvenanceError("Provenance build identity/mode mismatch", {
      code: "provenance_mismatch",
    });
  }
  if (!record.files || typeof record.files !== "object" || Array.isArray(record.files)) {
    throw new IosProvenanceError("Provenance files map is missing", { code: "provenance_invalid" });
  }
  if (
    typeof record.bundleFingerprint !== "string" ||
    !FINGERPRINT_RE.test(record.bundleFingerprint)
  ) {
    throw new IosProvenanceError("Provenance bundleFingerprint is invalid", {
      code: "provenance_invalid",
    });
  }
  const expectedFp = computeBundleFingerprint({
    sourceSha: /** @type {string} */ (record.sourceSha),
    apiOrigin: /** @type {string} */ (record.apiOrigin),
    files: /** @type {Record<string, string>} */ (record.files),
  });
  if (expectedFp !== record.bundleFingerprint) {
    throw new IosProvenanceError("Provenance bundleFingerprint does not match file map", {
      code: "provenance_mismatch",
    });
  }
}

/**
 * @param {object} manifest
 * @returns {string}
 */
export function serializeProvenance(manifest) {
  const ordered = {};
  for (const key of PROVENANCE_KEYS) {
    if (key in manifest) ordered[key] = manifest[key];
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * @param {string} filePath
 */
export function readProvenanceFile(filePath) {
  if (!existsSync(filePath)) {
    throw new IosProvenanceError(`Provenance file missing: ${filePath}`, {
      code: "provenance_missing",
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new IosProvenanceError(`Provenance file is not valid JSON: ${filePath}`, {
      code: "provenance_invalid",
    });
  }
  assertValidProvenance(parsed);
  return parsed;
}

/**
 * @param {{ webDir: string, expectedPath: string, manifest: object }} args
 */
export function writeProvenanceArtifacts(args) {
  const json = serializeProvenance(args.manifest);
  mkdirSync(dirname(args.expectedPath), { recursive: true });
  mkdirSync(args.webDir, { recursive: true });
  writeFileSync(args.expectedPath, json);
  writeFileSync(join(args.webDir, PROVENANCE_FILE_NAME), json);
}

/**
 * Fail if `server.url` exists on a Capacitor config object.
 *
 * @param {unknown} config
 * @param {string} label
 */
export function assertNoServerUrl(config, label) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new IosProvenanceError(`${label} is not a Capacitor config object`, {
      code: "capacitor_config_invalid",
    });
  }
  const server = /** @type {Record<string, unknown>} */ (config).server;
  if (server && typeof server === "object" && !Array.isArray(server) && "url" in server) {
    throw new IosProvenanceError(`${label} must not contain server.url`, {
      code: "server_url_forbidden",
    });
  }
}

/**
 * @param {string} filePath
 * @param {string} label
 */
export function assertCapacitorConfigHasNoServerUrl(filePath, label) {
  if (!existsSync(filePath)) {
    throw new IosProvenanceError(`${label} missing: ${filePath}`, {
      code: "capacitor_config_missing",
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new IosProvenanceError(`${label} is not valid JSON: ${filePath}`, {
      code: "capacitor_config_invalid",
    });
  }
  assertNoServerUrl(parsed, label);
}

/**
 * @param {Buffer} a
 * @param {Buffer} b
 */
function buffersEqual(a, b) {
  return a.length === b.length && a.equals(b);
}

/**
 * @param {{
 *   webDir: string,
 *   publicDir: string,
 *   expectedProvenancePath: string,
 *   capacitorConfigPath: string,
 * }} args
 */
export function verifyCopiedBundle(args) {
  const expectedPath = args.expectedProvenancePath;
  const webProvenancePath = join(args.webDir, PROVENANCE_FILE_NAME);
  const publicProvenancePath = join(args.publicDir, PROVENANCE_FILE_NAME);

  for (const p of [expectedPath, webProvenancePath, publicProvenancePath]) {
    if (!existsSync(p)) {
      throw new IosProvenanceError(`Provenance file missing: ${p}`, { code: "provenance_missing" });
    }
  }

  const expectedBytes = readFileSync(expectedPath);
  const webBytes = readFileSync(webProvenancePath);
  const publicBytes = readFileSync(publicProvenancePath);
  if (!buffersEqual(expectedBytes, webBytes) || !buffersEqual(expectedBytes, publicBytes)) {
    throw new IosProvenanceError("Copied provenance is not byte-identical to the expected file", {
      code: "provenance_mismatch",
    });
  }

  const manifest = readProvenanceFile(expectedPath);
  const liveFiles = hashWebDirFiles(args.webDir);
  const liveFingerprint = computeBundleFingerprint({
    sourceSha: manifest.sourceSha,
    apiOrigin: manifest.apiOrigin,
    files: liveFiles,
  });
  if (liveFingerprint !== manifest.bundleFingerprint) {
    throw new IosProvenanceError("Copied webDir no longer matches provenance fingerprint", {
      code: "copied_bundle_mismatch",
    });
  }

  assertFileMapMatchesDir(manifest.files, args.publicDir, "copied_bundle_mismatch");
  assertNoStaleExtras(args.publicDir, manifest.files);
  assertCapacitorConfigHasNoServerUrl(
    args.capacitorConfigPath,
    "Generated native capacitor.config.json",
  );
  return manifest;
}

/**
 * Verify a local packaged App.app. Does not certify a physical device install.
 *
 * @param {{ appPath: string, expectedProvenancePath: string }} args
 */
export function verifyAppBundle(args) {
  if (!existsSync(args.appPath) || !statSync(args.appPath).isDirectory()) {
    throw new IosProvenanceError(`App.app not found: ${args.appPath}`, {
      code: "app_bundle_missing",
    });
  }

  const publicDir = join(args.appPath, APP_BUNDLE_PUBLIC_DIR);
  const packagedProvenance = join(publicDir, PROVENANCE_FILE_NAME);
  const capacitorConfigPath = join(args.appPath, APP_BUNDLE_CAPACITOR_CONFIG);

  if (!existsSync(packagedProvenance)) {
    throw new IosProvenanceError(`Packaged App.app is missing ${PROVENANCE_FILE_NAME}`, {
      code: "app_bundle_provenance_missing",
    });
  }

  const expectedBytes = readFileSync(args.expectedProvenancePath);
  const packagedBytes = readFileSync(packagedProvenance);
  if (!buffersEqual(expectedBytes, packagedBytes)) {
    throw new IosProvenanceError("App.app provenance is not byte-identical to the expected file", {
      code: "provenance_mismatch",
    });
  }

  const manifest = readProvenanceFile(args.expectedProvenancePath);
  assertFileMapMatchesDir(manifest.files, publicDir, "app_bundle_mismatch");
  assertNoStaleExtras(publicDir, manifest.files);
  assertCapacitorConfigHasNoServerUrl(
    capacitorConfigPath,
    "Packaged App.app capacitor.config.json",
  );
  return manifest;
}

/**
 * @param {Record<string, string>} files
 * @param {string} dir
 * @param {string} mismatchCode
 */
function assertFileMapMatchesDir(files, dir, mismatchCode) {
  for (const [rel, expectedHash] of Object.entries(files)) {
    const abs = join(dir, rel);
    if (!existsSync(abs)) {
      throw new IosProvenanceError(`Missing packaged file: ${rel}`, { code: mismatchCode });
    }
    const actual = sha256File(abs);
    if (actual !== expectedHash) {
      throw new IosProvenanceError(`Hash mismatch for ${rel}`, { code: mismatchCode });
    }
  }
}

/**
 * Extra hashed web assets that are not the current Vite outputs are stale.
 *
 * @param {string} dir
 * @param {Record<string, string>} files
 */
function assertNoStaleExtras(dir, files) {
  const allow = new Set(CAPACITOR_INJECTED_ALLOWLIST);
  for (const rel of listRelativeFiles(dir)) {
    if (rel === PROVENANCE_FILE_NAME) continue;
    if (rel in files) continue;
    if (allow.has(rel)) continue;
    throw new IosProvenanceError(`Stale or unexpected native web asset: ${rel}`, {
      code: "stale_native_assets",
    });
  }
}

/**
 * @param {object} manifest
 * @returns {string}
 */
export function formatPrepareReport(manifest) {
  return [
    "IOS-BUILD-PROVENANCE",
    "Status: PASS",
    `sourceSha: ${manifest.sourceSha}`,
    `apiOrigin: ${manifest.apiOrigin}`,
    `buildIdentity: ${manifest.buildIdentity}`,
    `buildMode: ${manifest.buildMode}`,
    `bundleFingerprint: ${manifest.bundleFingerprint}`,
    "server.url: absent",
    "",
  ].join("\n");
}
