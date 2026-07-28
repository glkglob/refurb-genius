/**
 * AO-1E1.2 — AuthExperience must not own direct OAuth initiation Auth.
 *
 * Progressive seal: OTP and recovery extracted under AO-1E1.3.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, dynamic import string splits, computed property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/features/auth/presentation/AuthExperience.tsx";
const HOOK = "src/features/auth/presentation/hooks/useOAuthSignIn.ts";
const PRIMITIVE = "src/features/auth/infrastructure/startOAuthSignIn.ts";

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

test("auth oauth presentation — AuthExperience calls useOAuthSignIn(", () => {
  const full = join(ROOT, COMPONENT);
  assert.ok(existsSync(full), `missing ${COMPONENT}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useOAuthSignIn\s*\(/, `${COMPONENT} must call useOAuthSignIn(`);
});

test("auth oauth presentation — component bans direct signInWithOAuth", () => {
  const text = stripAllComments(readFileSync(join(ROOT, COMPONENT), "utf8"));
  assert.doesNotMatch(text, /signInWithOAuth/, `${COMPONENT} must not reference signInWithOAuth`);
  assert.doesNotMatch(
    text,
    /\.signInWithOAuth\s*\(/,
    `${COMPONENT} must not call .signInWithOAuth(`,
  );
  assert.doesNotMatch(
    text,
    /oauth_sign_in_initiated|trackEvent/,
    `${COMPONENT} must not own OAuth initiation analytics`,
  );
});

test("auth oauth presentation — residual OTP extracted under AO-1E1.3", () => {
  const text = stripAllComments(readFileSync(join(ROOT, COMPONENT), "utf8"));
  assert.doesNotMatch(
    text,
    /signInWithOtp/,
    `${COMPONENT} must not retain direct OTP after AO-1E1.3`,
  );
});

test("auth oauth presentation — hook owns analytics, callback URL, and primitive", () => {
  const full = join(ROOT, HOOK);
  assert.ok(existsSync(full), `missing ${HOOK}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /startOAuthSignIn/);
  assert.match(text, /trackEvent/);
  assert.match(text, /oauth_sign_in_initiated/);
  assert.match(text, /auth\/callback/);
  assert.match(text, /redirect_to/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
  assert.doesNotMatch(text, /\blogger\b|\btoast\b|useNavigate|setOauthLoading|setAppleLoading/);
});

test("auth oauth presentation — infrastructure owns signInWithOAuth payload", () => {
  const full = join(ROOT, PRIMITIVE);
  assert.ok(existsSync(full), `missing ${PRIMITIVE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /@\/platform\/supabase\/browser/);
  assert.match(text, /signInWithOAuth/);
  assert.match(text, /provider/);
  assert.match(text, /redirectTo/);
  assert.doesNotMatch(text, /\bwindow\b/);
  assert.doesNotMatch(text, /trackEvent|logger|toast|QueryClient|localStorage/);
  assert.doesNotMatch(text, /from ["']react["']/);
});

test("auth oauth presentation — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useOAuthSignIn = "fake";`;
  assert.match(sample, /useOAuthSignIn/);
  assert.doesNotMatch(sample, /useOAuthSignIn\s*\(/);
});
