/**
 * Prevents server-only modules from being statically imported into client-
 * reachable source. Dynamic import() inside createServerFn handlers is allowed
 * (see serverFns/* and feature presentation serverFns).
 *
 * PH-SENTRY-1B2B: also forbids client-surface dynamic import()/require() of
 * Node Sentry ownership modules (@sentry/node, server.init, server-capture).
 * The legitimate dual-surface Start server callback in src/start.ts remains
 * allowed for dynamic server-capture only.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".vercel") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

function rel(file: string): string {
  return relative(ROOT, file).replace(/\\/g, "/");
}

/** Files allowed to statically import server-only modules. */
function isServerContext(path: string): boolean {
  if (/\.server\.(ts|tsx)$/.test(path)) return true;
  if (path === "src/server.ts") return true;
  // Platform server entrypoints
  if (path === "src/platform/server.ts") return true;
  if (path.startsWith("src/platform/") && /\/server\.ts$/.test(path)) return true;
  // PH-SENTRY-1B1 Node Sentry ownership modules
  if (
    path === "src/platform/sentry/server.init.ts" ||
    path === "src/platform/sentry/server-capture.ts"
  ) {
    return true;
  }
  // Node scripts / edge functions (not browser)
  if (path.startsWith("scripts/")) return true;
  if (path.startsWith("supabase/functions/")) return true;
  return false;
}

/** Paths that must never pull server-only code (static import). */
function isClientSurface(path: string): boolean {
  if (isServerContext(path)) return false;
  if (path.startsWith("src/routes/")) return true;
  if (path.startsWith("src/components/")) return true;
  if (path.startsWith("src/hooks/")) return true;
  if (path.startsWith("packages/ui/")) return true;
  if (path.startsWith("src/lib/") && !path.includes(".server.")) return true;
  if (
    path.startsWith("src/features/") &&
    path.includes("/presentation/") &&
    !path.endsWith("serverFns.ts")
  ) {
    return true;
  }
  return false;
}

// Static import of a .server module (not dynamic import())
const STATIC_SERVER_IMPORT =
  /(?:^|\n)\s*import\s+(?:type\s+)?(?:[^'"\n]+from\s+)?['"]([^'"]*\.server)['"]/g;

const FORBIDDEN_STATIC_MODULES = [
  /@\/platform\/server['"]/,
  /from\s+['"]@\/platform\/openai\/server['"]/,
  /from\s+['"]@\/platform\/huggingface\/server['"]/,
  /from\s+['"]@\/platform\/posthog\/server['"]/,
  /from\s+['"]@\/platform\/posthog\/otel\.server['"]/,
  // PH-SENTRY-1B1: Node Sentry ownership must not enter client surfaces
  /from\s+['"]@\/platform\/sentry\/server\.init['"]/,
  /from\s+['"]@\/platform\/sentry\/server-capture['"]/,
  /from\s+['"]@sentry\/node['"]/,
];

/** Specifiers that must never enter client surfaces via static OR dynamic import. */
const FORBIDDEN_SENTRY_NODE_SPECIFIERS = [
  "@sentry/node",
  "@/platform/sentry/server.init",
  "@/platform/sentry/server-capture",
];

/**
 * Dynamic import("…") or import('…') of a forbidden Sentry/server module.
 * Matches: import("@sentry/node"), await import('@/platform/sentry/server-capture')
 */
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** CommonJS require("…") of forbidden modules. */
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function isForbiddenSentryNodeSpecifier(spec: string): boolean {
  const normalized = spec.replace(/\\/g, "/");
  return FORBIDDEN_SENTRY_NODE_SPECIFIERS.some(
    (f) => normalized === f || normalized.endsWith(`/${f.replace(/^@\//, "")}`),
  );
}

/**
 * Dual-surface Start entry: server middleware may dynamically import
 * server-capture. Static @sentry/node / server-capture / server.init imports
 * remain forbidden. Dynamic @sentry/node and server.init remain forbidden.
 */
function isAllowedStartServerCaptureDynamic(path: string, specifier: string): boolean {
  if (path !== "src/start.ts") return false;
  return (
    specifier === "@/platform/sentry/server-capture" ||
    specifier.endsWith("/platform/sentry/server-capture")
  );
}

const FORBIDDEN_CLIENT_SECRET_NAMES = [
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
  "VITE_OPENAI_API_KEY",
  "VITE_HUGGINGFACE_API_KEY",
  "VITE_RESEND_API_KEY",
  "VITE_SENTRY_AUTH_TOKEN",
];

const SRC_AND_PKGS = [
  ...collectSourceFiles(join(ROOT, "src")),
  ...collectSourceFiles(join(ROOT, "packages")),
];

test("server-only boundary — client surfaces do not statically import *.server modules", () => {
  const violations: string[] = [];

  for (const file of SRC_AND_PKGS) {
    const path = rel(file);
    if (!isClientSurface(path)) continue;

    const source = readFileSync(file, "utf8");
    // Strip block comments lightly to reduce false positives
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    for (const match of stripped.matchAll(STATIC_SERVER_IMPORT)) {
      violations.push(`${path}: static import of "${match[1]}"`);
    }

    for (const pattern of FORBIDDEN_STATIC_MODULES) {
      if (pattern.test(stripped)) {
        violations.push(`${path}: forbidden server module import (${pattern})`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Client-reachable files must not statically import server-only modules.\n` +
      `Use dynamic import() inside createServerFn handlers instead.\n` +
      violations.join("\n"),
  );
});

test("server-only boundary — client surfaces do not dynamic-import Node Sentry ownership", () => {
  const violations: string[] = [];

  for (const file of SRC_AND_PKGS) {
    const path = rel(file);
    // Server contexts may load Node Sentry; client surfaces must not.
    if (isServerContext(path)) continue;
    if (!isClientSurface(path) && path !== "src/start.ts") continue;

    const source = readFileSync(file, "utf8");
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    for (const match of stripped.matchAll(DYNAMIC_IMPORT_RE)) {
      const spec = match[1] ?? "";
      if (!isForbiddenSentryNodeSpecifier(spec)) continue;
      if (isAllowedStartServerCaptureDynamic(path, spec)) continue;
      violations.push(`${path}: dynamic import("${spec}")`);
    }

    for (const match of stripped.matchAll(REQUIRE_RE)) {
      const spec = match[1] ?? "";
      if (!isForbiddenSentryNodeSpecifier(spec)) continue;
      violations.push(`${path}: require("${spec}")`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Client-reachable files must not dynamic-import or require Node Sentry modules.\n` +
      `Allowed: src/start.ts server-callback dynamic import of @/platform/sentry/server-capture only.\n` +
      violations.join("\n"),
  );
});

test("server-only boundary — src/start.ts dual-surface Sentry contract", () => {
  const startPath = join(ROOT, "src/start.ts");
  assert.ok(existsSync(startPath), "src/start.ts must exist");
  const source = readFileSync(startPath, "utf8");
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // Must not statically pull Node Sentry
  assert.doesNotMatch(stripped, /from\s+['"]@sentry\/node['"]/);
  assert.doesNotMatch(stripped, /from\s+['"]@\/platform\/sentry\/server-capture['"]/);
  assert.doesNotMatch(stripped, /from\s+['"]@\/platform\/sentry\/server\.init['"]/);

  // Must retain the server-callback dynamic import of server-capture (1B1 path)
  assert.match(
    stripped,
    /import\s*\(\s*['"]@\/platform\/sentry\/server-capture['"]\s*\)/,
    "src/start.ts must dynamically import server-capture inside server middleware",
  );

  // Must not dynamically import raw @sentry/node or server.init
  for (const match of stripped.matchAll(DYNAMIC_IMPORT_RE)) {
    const spec = match[1] ?? "";
    assert.notEqual(spec, "@sentry/node", "src/start.ts must not dynamic-import @sentry/node");
    assert.notEqual(
      spec,
      "@/platform/sentry/server.init",
      "src/start.ts must not dynamic-import server.init",
    );
  }
});

test("server-only boundary — createServerFn modules use dynamic import for *.server", () => {
  const violations: string[] = [];
  const serverFnFiles = SRC_AND_PKGS.filter((f) => {
    const path = rel(f);
    return (
      path.startsWith("src/serverFns/") ||
      path.endsWith("/presentation/serverFns.ts") ||
      path.endsWith("/presentation/serverFns.tsx")
    );
  });

  for (const file of serverFnFiles) {
    const path = rel(file);
    if (isServerContext(path)) continue;
    const source = readFileSync(file, "utf8");
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    for (const match of stripped.matchAll(STATIC_SERVER_IMPORT)) {
      violations.push(
        `${path}: static import of "${match[1]}" (use await import() inside handler)`,
      );
    }
  }

  assert.deepEqual(violations, [], violations.join("\n"));
});

test("server-only boundary — no VITE_ prefix for private credential env names", () => {
  const violations: string[] = [];

  for (const file of SRC_AND_PKGS) {
    const path = rel(file);
    const source = readFileSync(file, "utf8");
    for (const name of FORBIDDEN_CLIENT_SECRET_NAMES) {
      if (source.includes(name)) {
        violations.push(`${path}: references ${name}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Private credentials must never use a VITE_ prefix (would enter client bundles):\n` +
      violations.join("\n"),
  );
});

test("server-only boundary — platform/browser must not re-export server AI clients", () => {
  const browserPath = join(ROOT, "src/platform/browser.ts");
  assert.ok(existsSync(browserPath), "src/platform/browser.ts must exist");
  const browser = readFileSync(browserPath, "utf8");
  assert.doesNotMatch(browser, /getOpenAIClient|OPENAI_API_KEY|SERVICE_ROLE/);
  assert.doesNotMatch(browser, /\.server['"]/);
});
