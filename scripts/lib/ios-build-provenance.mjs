/**
 * IOS-BUILD-PROVENANCE-1 — deterministic iOS native-bundle provenance.
 *
 * Authority is source SHA + effective API origin + Supabase runtime
 * identity (normalized URL + SHA-256 of the selected public client key)
 * + SHA-256 file map. Timestamps are not provenance authority. No secrets.
 * The raw public client key is proven at prepare time and never stored.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA_VERSION = 3;
export const SIDECAR_SCHEMA_VERSION = 2;
export const BUILD_IDENTITY = "ios-capacitor-spa";
export const BUILD_MODE = "production";
export const VITE_CONFIG = "vite.ios.config.ts";
export const PROVENANCE_FILE_NAME = "ios-build-provenance.json";
export const WEB_DIR_REL = "dist/ios/client";
export const EXPECTED_PROVENANCE_REL = "dist/ios/ios-build-provenance.json";
export const ROLLUP_MAP_REL = "dist/ios/ios-vite-rollup-map.json";
export const ORIGIN_AUTHORITY_MODULE = "src/platform/http/origin.ts";
export const SUPABASE_AUTHORITY_MODULE = "packages/supabase/src/env.ts";
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
  "originAuthorityChunk",
  "supabaseUrl",
  "supabasePublicKeySha256",
  "supabaseAuthorityChunk",
  "files",
  "bundleFingerprint",
]);

export const SIDECAR_KEYS = Object.freeze([
  "schemaVersion",
  "originModule",
  "originAuthorityChunk",
  "originFoundInChunk",
  "supabaseModule",
  "supabaseAuthorityChunk",
  "supabaseUrlFoundInChunk",
  "supabasePublicKeyFoundInChunk",
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
 * @param {{ empty: string, invalid: string, notHttps: string }} codes
 * @returns {string}
 */
function normalizeHttpsOriginValue(raw, codes) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new IosProvenanceError("HTTPS origin is empty", { code: codes.empty });
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new IosProvenanceError("Value is not a valid URL", { code: codes.invalid });
  }

  if (url.protocol !== "https:") {
    throw new IosProvenanceError("Value must use HTTPS", { code: codes.notHttps });
  }

  if (url.username || url.password) {
    throw new IosProvenanceError("Value must not include credentials", { code: codes.invalid });
  }

  return url.origin;
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeHttpsOrigin(raw) {
  return normalizeHttpsOriginValue(raw, {
    empty: "origin_invalid",
    invalid: "origin_invalid",
    notHttps: "origin_not_https",
  });
}

/**
 * @param {unknown} envValue
 * @returns {string}
 */
export function resolveIosSupabaseUrl(envValue) {
  if (typeof envValue !== "string" || envValue.trim() === "") {
    throw new IosProvenanceError("VITE_SUPABASE_URL is not configured", {
      code: "supabase_url_missing",
    });
  }
  return normalizeHttpsOriginValue(envValue, {
    empty: "supabase_url_missing",
    invalid: "supabase_url_invalid",
    notHttps: "supabase_url_not_https",
  });
}

/**
 * @param {unknown} env
 */
export function assertViteServiceRoleAbsent(env) {
  const record = env && typeof env === "object" ? /** @type {Record<string, unknown>} */ (env) : {};
  const planted = record.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (typeof planted === "string" && planted.trim() !== "") {
    throw new IosProvenanceError(
      "VITE_SUPABASE_SERVICE_ROLE_KEY is forbidden for native/client certification",
      { code: "supabase_service_role_forbidden" },
    );
  }
}

/**
 * Inspect a JWT-shaped value for a privileged Supabase role. Does not verify
 * signatures and never logs the token.
 *
 * @param {string} key
 * @returns {string | null}
 */
export function readJwtRoleClaim(key) {
  if (typeof key !== "string" || !key.startsWith("eyJ")) return null;
  const parts = key.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const json = Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf8");
    const payload = JSON.parse(json);
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 */
export function assertPublicSupabaseClientKey(key) {
  if (typeof key !== "string" || key.trim() === "") {
    throw new IosProvenanceError("Supabase public client key is missing", {
      code: "supabase_key_missing",
    });
  }
  const trimmed = key.trim();
  if (
    /service_role/i.test(trimmed) ||
    /^sb_secret_/i.test(trimmed) ||
    readJwtRoleClaim(trimmed) === "service_role"
  ) {
    throw new IosProvenanceError("Selected Supabase key is not a public client key", {
      code: "supabase_key_forbidden",
    });
  }
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function readPublicKeyCandidate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Process-env public client key only. Never reads dotenv or service_role.
 *
 * @param {unknown} env
 * @returns {string}
 */
export function resolveIosSupabasePublicKey(env) {
  const record = env && typeof env === "object" ? /** @type {Record<string, unknown>} */ (env) : {};
  assertViteServiceRoleAbsent(record);
  const anon = readPublicKeyCandidate(record.VITE_SUPABASE_ANON_KEY);
  const publishable = readPublicKeyCandidate(record.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!anon && !publishable) {
    throw new IosProvenanceError(
      "VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY is required",
      { code: "supabase_key_missing" },
    );
  }
  if (anon && publishable && anon !== publishable) {
    throw new IosProvenanceError(
      "VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY disagree",
      { code: "supabase_key_conflict" },
    );
  }
  const selected = anon ?? publishable;
  assertPublicSupabaseClientKey(selected);
  return selected;
}

/**
 * @param {unknown} env
 * @returns {{ supabaseUrl: string, supabasePublicKey: string }}
 */
export function resolveIosSupabaseRuntimeConfig(env) {
  const record = env && typeof env === "object" ? /** @type {Record<string, unknown>} */ (env) : {};
  assertViteServiceRoleAbsent(record);
  return {
    supabaseUrl: resolveIosSupabaseUrl(record.VITE_SUPABASE_URL),
    supabasePublicKey: resolveIosSupabasePublicKey(record),
  };
}

/**
 * Child env for the governed Vite runner. Does not mutate `parentEnv`.
 * Canonical public key is always VITE_SUPABASE_ANON_KEY. Publishable is
 * an input alias only. The unused VITE_* names are empty-string
 * tombstones so Vite process-env precedence suppresses ignored dotenv
 * values of the same name. Do not delete those keys.
 *
 * @param {NodeJS.ProcessEnv} parentEnv
 * @param {string} apiOrigin
 * @param {{ supabaseUrl: string, supabasePublicKey: string }} supabaseRuntime
 * @returns {NodeJS.ProcessEnv}
 */
export function createChildEnv(parentEnv, apiOrigin, supabaseRuntime) {
  if (!supabaseRuntime || typeof supabaseRuntime !== "object") {
    throw new IosProvenanceError("Supabase runtime config is required for the child env", {
      code: "supabase_key_missing",
    });
  }
  const supabaseUrl = resolveIosSupabaseUrl(supabaseRuntime.supabaseUrl);
  const supabasePublicKey = supabaseRuntime.supabasePublicKey;
  assertPublicSupabaseClientKey(typeof supabasePublicKey === "string" ? supabasePublicKey : "");
  const child = { ...parentEnv, VITE_PUBLIC_URL: apiOrigin };
  child.VITE_SUPABASE_URL = supabaseUrl;
  child.VITE_SUPABASE_ANON_KEY = supabasePublicKey.trim();
  child.VITE_SUPABASE_PUBLISHABLE_KEY = "";
  child.VITE_SUPABASE_SERVICE_ROLE_KEY = "";
  return child;
}

/**
 * Normalize Rollup/Vite module IDs before matching authority modules.
 *
 * @param {unknown} id
 * @returns {string}
 */
export function normalizeRollupModuleId(id) {
  if (typeof id !== "string" || id.length === 0) return "";
  let value = id.replace(/\\/g, "/");
  const q = value.indexOf("?");
  if (q !== -1) value = value.slice(0, q);
  if (value.startsWith("file:")) {
    try {
      value = fileURLToPath(value).replace(/\\/g, "/");
    } catch {
      value = value.replace(/^file:\/\//, "");
    }
  }
  return value;
}

/**
 * @param {unknown} id
 * @param {string} moduleRel
 * @returns {boolean}
 */
function isAuthorityModule(id, moduleRel) {
  const normalized = normalizeRollupModuleId(id);
  return normalized.endsWith(`/${moduleRel}`) || normalized.endsWith(moduleRel);
}

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isOriginAuthorityModule(id) {
  return isAuthorityModule(id, ORIGIN_AUTHORITY_MODULE);
}

/**
 * @param {unknown} id
 * @returns {boolean}
 */
export function isSupabaseAuthorityModule(id) {
  return isAuthorityModule(id, SUPABASE_AUTHORITY_MODULE);
}

/**
 * Safe relative path under webDir. No absolute, scheme, or traversal paths.
 *
 * @param {unknown} raw
 * @param {{ field?: string, code?: string }} [options]
 * @returns {string}
 */
export function assertSafeWebDirRelativePath(raw, options) {
  const field = options?.field ?? "originAuthorityChunk";
  const code = options?.code ?? "origin_authority_chunk_invalid";
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new IosProvenanceError(`${field} must be a relative webDir path`, { code });
  }
  const trimmed = raw.trim().replace(/\\/g, "/");
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith("//")) {
    throw new IosProvenanceError(`${field} must not include a URL scheme`, { code });
  }
  if (trimmed.startsWith("/") || /^[a-zA-Z]:\//.test(trimmed)) {
    throw new IosProvenanceError(`${field} must not be an absolute path`, { code });
  }
  const parts = trimmed.split("/");
  if (parts.some((part) => part === ".." || part === "")) {
    throw new IosProvenanceError(`${field} must not contain path traversal`, { code });
  }
  return parts.join("/");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function assertSha256Hex(value) {
  if (typeof value !== "string" || !FINGERPRINT_RE.test(value)) {
    throw new IosProvenanceError(
      "supabasePublicKeySha256 must be a 64-character lowercase hex SHA-256",
      { code: "provenance_invalid" },
    );
  }
  return value;
}

/**
 * @param {Buffer} buf
 * @returns {string}
 */
export function decodeTextBuffer(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString("utf16le");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return swapped.toString("utf16le");
  }
  const utf8 = buf.toString("utf8");
  const nulCount = (utf8.match(/\u0000/g) || []).length;
  if (nulCount > 8 && buf.length % 2 === 0) {
    return buf.toString("utf16le").replace(/\u0000/g, "");
  }
  return utf8;
}

/**
 * Local asset references from the SPA entry document.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function collectLocalAssetRefs(html) {
  const refs = new Set();
  const attrRe = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = attrRe.exec(html))) {
    addLocalRef(refs, match[1] || match[2] || match[3] || "");
  }
  const srcsetRe = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((match = srcsetRe.exec(html))) {
    const value = match[1] || match[2] || "";
    for (const part of value.split(",")) {
      addLocalRef(refs, part.trim().split(/\s+/)[0] || "");
    }
  }
  return [...refs].sort();
}

/**
 * @param {Set<string>} refs
 * @param {string} raw
 */
function addLocalRef(refs, raw) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("?")) return;
  if (/^(?:https?:|data:|blob:|mailto:|capacitor:|\/\/)/i.test(trimmed)) return;
  const pathOnly = trimmed.split("#")[0].split("?")[0];
  if (!pathOnly || pathOnly === ".") return;
  refs.add(pathOnly);
}

/**
 * @param {string} webDir
 * @param {string} ref
 * @returns {string}
 */
export function resolveLocalAssetRel(ref) {
  const withoutDot = ref.replace(/^\.\//, "");
  const rel = withoutDot.startsWith("/") ? withoutDot.slice(1) : withoutDot;
  return assertSafeWebDirRelativePath(rel);
}

/**
 * Index.html plus every local HTML-referenced file must exist under webDir.
 *
 * @param {string} webDir
 */
export function assertSpaReady(webDir) {
  const indexPath = join(webDir, "index.html");
  if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
    throw new IosProvenanceError("SPA index.html is missing", { code: "spa_incomplete" });
  }
  const html = decodeTextBuffer(readFileSync(indexPath));
  for (const ref of collectLocalAssetRefs(html)) {
    const rel = resolveLocalAssetRel(ref);
    const abs = join(webDir, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      throw new IosProvenanceError(`SPA is missing referenced asset: ${rel}`, {
        code: "spa_incomplete",
      });
    }
  }
}

/**
 * @param {string} dir
 * @param {unknown} chunkRel
 * @param {{ field?: string, missingCode?: string }} [options]
 */
function readAuthorityChunkText(dir, chunkRel, options) {
  const field = options?.field ?? "originAuthorityChunk";
  const missingCode = options?.missingCode ?? "origin_authority_chunk_missing";
  const rel = assertSafeWebDirRelativePath(chunkRel, {
    field,
    code:
      field === "supabaseAuthorityChunk"
        ? "supabase_authority_chunk_invalid"
        : "origin_authority_chunk_invalid",
  });
  const abs = join(dir, rel);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new IosProvenanceError(`Authority chunk missing: ${rel}`, { code: missingCode });
  }
  return { rel, text: decodeTextBuffer(readFileSync(abs)) };
}

/**
 * Module-linked origin proof: the authority chunk itself must contain apiOrigin.
 *
 * @param {string} dir
 * @param {unknown} chunkRel
 * @param {string} apiOrigin
 */
export function assertAuthorityChunkContainsOrigin(dir, chunkRel, apiOrigin) {
  const { rel, text } = readAuthorityChunkText(dir, chunkRel);
  if (!text.includes(apiOrigin)) {
    throw new IosProvenanceError(`Normalized API origin is not present in authority chunk ${rel}`, {
      code: "origin_not_baked",
    });
  }
}

/**
 * Prepare-time proof: URL and the exact selected public key are in the chunk.
 *
 * @param {string} dir
 * @param {unknown} chunkRel
 * @param {string} supabaseUrl
 * @param {string} publicKey
 */
export function assertAuthorityChunkContainsSupabaseConfig(dir, chunkRel, supabaseUrl, publicKey) {
  const { rel, text } = readAuthorityChunkText(dir, chunkRel, {
    field: "supabaseAuthorityChunk",
    missingCode: "supabase_authority_chunk_missing",
  });
  if (!text.includes(supabaseUrl)) {
    throw new IosProvenanceError(
      `Normalized Supabase URL is not present in authority chunk ${rel}`,
      { code: "supabase_url_not_baked" },
    );
  }
  if (typeof publicKey !== "string" || publicKey.length === 0 || !text.includes(publicKey)) {
    throw new IosProvenanceError(
      `Selected Supabase public key is not present in authority chunk ${rel}`,
      { code: "supabase_key_not_baked" },
    );
  }
}

/**
 * Copied/App verification: re-check the stored URL only. The selected key is
 * bound by the prepare-time proof plus exact certified authority-chunk bytes.
 *
 * @param {string} dir
 * @param {unknown} chunkRel
 * @param {string} supabaseUrl
 */
export function assertAuthorityChunkContainsSupabaseUrl(dir, chunkRel, supabaseUrl) {
  const { rel, text } = readAuthorityChunkText(dir, chunkRel, {
    field: "supabaseAuthorityChunk",
    missingCode: "supabase_authority_chunk_missing",
  });
  if (!text.includes(supabaseUrl)) {
    throw new IosProvenanceError(
      `Normalized Supabase URL is not present in authority chunk ${rel}`,
      { code: "supabase_url_not_baked" },
    );
  }
}

/**
 * @param {string} filePath
 */
export function readRollupMap(filePath) {
  if (!existsSync(filePath)) {
    throw new IosProvenanceError(`Rollup map sidecar missing: ${filePath}`, {
      code: "origin_module_unmapped",
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new IosProvenanceError("Rollup map sidecar is not valid JSON", {
      code: "origin_module_unmapped",
    });
  }
  if (!parsed || typeof parsed !== "object") {
    throw new IosProvenanceError("Rollup map sidecar is invalid", {
      code: "origin_module_unmapped",
    });
  }
  return parsed;
}

/**
 * @param {unknown} map
 */
function assertSidecarHasNoSecrets(map) {
  const record = /** @type {Record<string, unknown>} */ (map);
  for (const key of Object.keys(record)) {
    if (!SIDECAR_KEYS.includes(key)) {
      throw new IosProvenanceError(`Rollup map contains unexpected key: ${key}`, {
        code: "origin_module_unmapped",
      });
    }
    if (SECRET_KEY.test(key) || TIMESTAMP_KEY.test(key)) {
      throw new IosProvenanceError(`Rollup map contains forbidden key: ${key}`, {
        code: "provenance_secrets",
      });
    }
    const value = record[key];
    if (typeof value === "string" && SECRET_VALUE.test(value)) {
      throw new IosProvenanceError("Rollup map value looks like a secret", {
        code: "provenance_secrets",
      });
    }
  }
}

/**
 * Sidecar is handoff only. Re-check mapped client chunks on disk.
 * Does not re-require the raw public key.
 *
 * @param {unknown} map
 * @param {string} webDir
 * @param {string} apiOrigin
 * @param {string} supabaseUrl
 * @returns {{ originAuthorityChunk: string, supabaseAuthorityChunk: string }}
 */
export function assertRollupMapHandoff(map, webDir, apiOrigin, supabaseUrl) {
  const record = /** @type {Record<string, unknown>} */ (map);
  assertSidecarHasNoSecrets(record);
  if (record.schemaVersion !== SIDECAR_SCHEMA_VERSION) {
    throw new IosProvenanceError("Rollup map sidecar schemaVersion must be 2", {
      code: "origin_module_unmapped",
    });
  }
  if (record.originModule !== ORIGIN_AUTHORITY_MODULE) {
    throw new IosProvenanceError("Rollup map does not name the origin authority module", {
      code: "origin_module_unmapped",
    });
  }
  if (record.supabaseModule !== SUPABASE_AUTHORITY_MODULE) {
    throw new IosProvenanceError("Rollup map does not name the Supabase authority module", {
      code: "supabase_module_unmapped",
    });
  }
  if (record.originFoundInChunk !== true) {
    throw new IosProvenanceError("Rollup map did not confirm origin in the authority chunk", {
      code: "origin_not_baked",
    });
  }
  if (record.supabaseUrlFoundInChunk !== true) {
    throw new IosProvenanceError("Rollup map did not confirm Supabase URL in the authority chunk", {
      code: "supabase_url_not_baked",
    });
  }
  if (record.supabasePublicKeyFoundInChunk !== true) {
    throw new IosProvenanceError(
      "Rollup map did not confirm the selected public key in the authority chunk",
      { code: "supabase_key_not_baked" },
    );
  }
  const originAuthorityChunk = assertSafeWebDirRelativePath(record.originAuthorityChunk);
  const supabaseAuthorityChunk = assertSafeWebDirRelativePath(record.supabaseAuthorityChunk, {
    field: "supabaseAuthorityChunk",
    code: "supabase_authority_chunk_invalid",
  });
  assertAuthorityChunkContainsOrigin(webDir, originAuthorityChunk, apiOrigin);
  assertAuthorityChunkContainsSupabaseUrl(webDir, supabaseAuthorityChunk, supabaseUrl);
  return { originAuthorityChunk, supabaseAuthorityChunk };
}

/**
 * Certification requires the named authority chunk to be one of the hashed files.
 *
 * @param {unknown} chunkRel
 * @param {unknown} files
 * @param {{ field?: string, code?: string }} [options]
 * @returns {string}
 */
export function assertAuthorityChunkListedInFiles(chunkRel, files, options) {
  const field = options?.field ?? "originAuthorityChunk";
  const rel = assertSafeWebDirRelativePath(chunkRel, options);
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    throw new IosProvenanceError("Provenance files map is missing", { code: "provenance_invalid" });
  }
  if (!Object.hasOwn(/** @type {object} */ (files), rel)) {
    throw new IosProvenanceError(`${field} is not present in the hashed file map: ${rel}`, {
      code: "provenance_invalid",
    });
  }
  return rel;
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
 *   originAuthorityChunk: string,
 *   supabaseUrl: string,
 *   supabasePublicKeySha256: string,
 *   supabaseAuthorityChunk: string,
 *   files: Record<string, string>,
 * }} input
 * @returns {string}
 */
export function computeBundleFingerprint(input) {
  const originAuthorityChunk = assertSafeWebDirRelativePath(input.originAuthorityChunk);
  const supabaseAuthorityChunk = assertSafeWebDirRelativePath(input.supabaseAuthorityChunk, {
    field: "supabaseAuthorityChunk",
    code: "supabase_authority_chunk_invalid",
  });
  const supabaseUrl = resolveIosSupabaseUrl(input.supabaseUrl);
  const supabasePublicKeySha256 = assertSha256Hex(input.supabasePublicKeySha256);
  const payload = {
    schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
    sourceSha: input.sourceSha,
    apiOrigin: input.apiOrigin,
    buildIdentity: input.buildIdentity ?? BUILD_IDENTITY,
    buildMode: input.buildMode ?? BUILD_MODE,
    originAuthorityChunk,
    supabaseUrl,
    supabasePublicKeySha256,
    supabaseAuthorityChunk,
    files: input.files,
  };
  return sha256Bytes(JSON.stringify(canonicalize(payload)));
}

/**
 * @param {{
 *   sourceSha: string,
 *   apiOrigin: string,
 *   files: Record<string, string>,
 *   originAuthorityChunk: string,
 *   supabaseUrl: string,
 *   supabasePublicKeySha256: string,
 *   supabaseAuthorityChunk: string,
 * }} input
 */
export function buildProvenanceManifest(input) {
  const sourceSha = assertSourceSha(input.sourceSha);
  const apiOrigin = resolveIosApiOrigin(input.apiOrigin);
  const files = sortFileMap(input.files);
  const originAuthorityChunk = assertAuthorityChunkListedInFiles(input.originAuthorityChunk, files);
  const supabaseUrl = resolveIosSupabaseUrl(input.supabaseUrl);
  const supabasePublicKeySha256 = assertSha256Hex(input.supabasePublicKeySha256);
  const supabaseAuthorityChunk = assertAuthorityChunkListedInFiles(
    input.supabaseAuthorityChunk,
    files,
    { field: "supabaseAuthorityChunk", code: "supabase_authority_chunk_invalid" },
  );
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    sourceSha,
    apiOrigin,
    buildIdentity: BUILD_IDENTITY,
    buildMode: BUILD_MODE,
    viteConfig: VITE_CONFIG,
    webDir: WEB_DIR_REL,
    nativePublicDir: NATIVE_PUBLIC_REL,
    originAuthorityChunk,
    supabaseUrl,
    supabasePublicKeySha256,
    supabaseAuthorityChunk,
    files,
    bundleFingerprint: computeBundleFingerprint({
      sourceSha,
      apiOrigin,
      files,
      originAuthorityChunk,
      supabaseUrl,
      supabasePublicKeySha256,
      supabaseAuthorityChunk,
    }),
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
 * @param {{
 *   sourceSha: unknown,
 *   apiOrigin: unknown,
 *   files: unknown,
 *   originAuthorityChunk: unknown,
 *   supabaseUrl: unknown,
 *   supabasePublicKeySha256: unknown,
 *   supabaseAuthorityChunk: unknown,
 * }} record
 */
function fingerprintFromRecord(record) {
  return computeBundleFingerprint({
    sourceSha: /** @type {string} */ (record.sourceSha),
    apiOrigin: /** @type {string} */ (record.apiOrigin),
    files: /** @type {Record<string, string>} */ (record.files),
    originAuthorityChunk: /** @type {string} */ (record.originAuthorityChunk),
    supabaseUrl: /** @type {string} */ (record.supabaseUrl),
    supabasePublicKeySha256: /** @type {string} */ (record.supabasePublicKeySha256),
    supabaseAuthorityChunk: /** @type {string} */ (record.supabaseAuthorityChunk),
  });
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
  if (record.supabaseUrl !== resolveIosSupabaseUrl(record.supabaseUrl)) {
    throw new IosProvenanceError("Provenance supabaseUrl is not a normalized HTTPS origin", {
      code: "provenance_invalid",
    });
  }
  assertSha256Hex(record.supabasePublicKeySha256);
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
  assertAuthorityChunkListedInFiles(record.originAuthorityChunk, record.files);
  assertAuthorityChunkListedInFiles(record.supabaseAuthorityChunk, record.files, {
    field: "supabaseAuthorityChunk",
    code: "supabase_authority_chunk_invalid",
  });
  const expectedFp = fingerprintFromRecord(record);
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
 * Copied-bundle verification does not re-require process env or the raw key.
 * The key remains bound by prepare-time proof + exact certified chunk bytes.
 *
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
  const liveFingerprint = fingerprintFromRecord({
    ...manifest,
    files: liveFiles,
  });
  if (liveFingerprint !== manifest.bundleFingerprint) {
    throw new IosProvenanceError("Copied webDir no longer matches provenance fingerprint", {
      code: "copied_bundle_mismatch",
    });
  }

  assertFileMapMatchesDir(manifest.files, args.publicDir, "copied_bundle_mismatch");
  assertNoStaleExtras(args.publicDir, manifest.files);
  assertSpaReady(args.webDir);
  assertSpaReady(args.publicDir);
  assertAuthorityChunkContainsOrigin(
    args.publicDir,
    manifest.originAuthorityChunk,
    manifest.apiOrigin,
  );
  assertAuthorityChunkContainsSupabaseUrl(
    args.publicDir,
    manifest.supabaseAuthorityChunk,
    manifest.supabaseUrl,
  );
  assertCapacitorConfigHasNoServerUrl(
    args.capacitorConfigPath,
    "Generated native capacitor.config.json",
  );
  return manifest;
}

/**
 * Verify a local packaged App.app. Does not certify a physical device install.
 * Does not re-require process env or the raw public key.
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
  assertSpaReady(publicDir);
  assertAuthorityChunkContainsOrigin(publicDir, manifest.originAuthorityChunk, manifest.apiOrigin);
  assertAuthorityChunkContainsSupabaseUrl(
    publicDir,
    manifest.supabaseAuthorityChunk,
    manifest.supabaseUrl,
  );
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
    `originAuthorityChunk: ${manifest.originAuthorityChunk}`,
    `supabaseUrl: ${manifest.supabaseUrl}`,
    `supabasePublicKeySha256: ${manifest.supabasePublicKeySha256}`,
    `supabaseAuthorityChunk: ${manifest.supabaseAuthorityChunk}`,
    `bundleFingerprint: ${manifest.bundleFingerprint}`,
    "server.url: absent",
    "",
  ].join("\n");
}
