/**
 * AO-1F1 — Auth callback route must not own direct Auth, session, mapping,
 * or QueryClient cache mutation.
 *
 * Progressive seal for authorization-code exchange, no-code session read,
 * AUTH_USER_QUERY_KEY seeding, destination resolution, and navigation.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const ROUTE = "src/routes/auth_.callback.tsx";
const HOOK = "src/features/auth/presentation/hooks/useAuthCallbackCompletion.ts";
const APP = "src/features/auth/application/completeAuthCallback.ts";
const EXCHANGE = "src/features/auth/infrastructure/exchangeAuthCode.ts";
const VERIFY = "src/features/auth/infrastructure/verifyEmailTokenHash.ts";
const SESSION = "src/features/auth/infrastructure/getBrowserAuthSession.ts";
const DEST = "src/features/auth/application/resolveAuthCallbackDestination.ts";

function stripLineComments(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

function stripAllComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map(stripLineComments)
    .join("\n");
}

function read(rel: string): string {
  const full = join(ROOT, rel);
  assert.ok(existsSync(full), `missing ${rel}`);
  return stripAllComments(readFileSync(full, "utf8"));
}

test("auth callback presentation — route calls useAuthCallbackCompletion(", () => {
  const text = read(ROUTE);
  assert.match(
    text,
    /useAuthCallbackCompletion\s*\(/,
    `${ROUTE} must call useAuthCallbackCompletion(`,
  );
});

test("auth callback presentation — route bans residual direct Auth ownership", () => {
  const text = read(ROUTE);
  assert.doesNotMatch(
    text,
    /exchangeCodeForSession/,
    `${ROUTE} must not call exchangeCodeForSession`,
  );
  assert.doesNotMatch(text, /getSession\s*\(/, `${ROUTE} must not call getSession(`);
  assert.doesNotMatch(text, /setQueryData/, `${ROUTE} must not call setQueryData`);
  assert.doesNotMatch(
    text,
    /AUTH_USER_QUERY_KEY/,
    `${ROUTE} must not reference AUTH_USER_QUERY_KEY`,
  );
  assert.doesNotMatch(text, /fromSupabaseUser/, `${ROUTE} must not map Auth users`);
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${ROUTE} must not import platform Supabase after AO-1F1`,
  );
  assert.doesNotMatch(
    text,
    /from ["']@\/lib\/auth["']/,
    `${ROUTE} must not import @/lib/auth after AO-1F1`,
  );
  assert.doesNotMatch(text, /useQueryClient/, `${ROUTE} must not own QueryClient after AO-1F1`);
});

test("auth callback presentation — route retains search validation and presentation UI", () => {
  const text = read(ROUTE);
  assert.match(text, /validateSearch|callbackSearchSchema/);
  assert.match(text, /code/);
  assert.match(text, /token_hash/);
  assert.match(text, /flow/);
  assert.match(text, /redirect_to/);
  assert.match(text, /error_description/);
  assert.match(text, /Completing sign in/);
  assert.match(text, /Authentication failed/);
  assert.match(text, /Back to sign in/);
  assert.match(text, /aria-busy/);
  assert.match(text, /aria-live/);
  assert.match(text, /replaceState|history/);
  assert.doesNotMatch(text, /verifyOtp|exchangeCodeForSession/);
});

test("auth callback presentation — hook owns seed and navigation", () => {
  const text = read(HOOK);
  assert.match(text, /completeAuthCallback/);
  assert.match(text, /AUTH_USER_QUERY_KEY/);
  assert.match(text, /setQueryData/);
  assert.match(text, /useNavigate|navigate/);
  assert.match(text, /mode:\s*["']reset["']/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
  assert.doesNotMatch(text, /exchangeCodeForSession/);
  assert.doesNotMatch(text, /getSession\s*\(/);
  assert.doesNotMatch(text, /\blogger\b|\btoast\b/);
});

test("auth callback presentation — application owns mapping and branch model", () => {
  const text = read(APP);
  assert.match(text, /fromSupabaseUser/);
  assert.match(text, /exchangeAuthCode/);
  assert.match(text, /verifyEmailTokenHash/);
  assert.match(text, /getBrowserAuthSession/);
  assert.match(text, /resolveAuthCallbackDestination/);
  assert.match(text, /kind:\s*["']recovery["']/);
  assert.match(text, /kind:\s*["']authenticated["']/);
  assert.match(text, /kind:\s*["']error["']/);
  assert.doesNotMatch(text, /QueryClient|setQueryData|AUTH_USER_QUERY_KEY/);
  assert.doesNotMatch(text, /useNavigate|from ["']react["']/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
});

test("auth callback presentation — destination rule hardened", () => {
  const text = read(DEST);
  assert.match(text, /startsWith\s*\(\s*["']\/["']\s*\)/);
  assert.match(text, /\/dashboard/);
  assert.match(text, /\/auth/);
  assert.match(text, /\/\//);
});

test("auth callback presentation — infrastructure owns Auth methods", () => {
  for (const [path, method] of [
    [EXCHANGE, /exchangeCodeForSession/],
    [VERIFY, /verifyOtp/],
    [SESSION, /getSession/],
  ] as const) {
    const text = read(path);
    assert.match(text, /@\/platform\/supabase\/browser/);
    assert.match(text, method);
    assert.doesNotMatch(text, /\bwindow\b/);
    assert.doesNotMatch(
      text,
      /trackEvent|logger|toast|QueryClient|fromSupabaseUser|captureAuthError/,
    );
    assert.doesNotMatch(text, /from ["']react["']/);
  }
});

test("auth callback presentation — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useAuthCallbackCompletion = "fake";`;
  assert.doesNotMatch(sample, /useAuthCallbackCompletion\s*\(/);
});
