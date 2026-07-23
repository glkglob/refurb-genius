/**
 * Prevents server-only modules from being statically imported into client-
 * reachable source. Dynamic import() inside createServerFn handlers is allowed
 * (see serverFns/* and feature presentation serverFns).
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
];

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
