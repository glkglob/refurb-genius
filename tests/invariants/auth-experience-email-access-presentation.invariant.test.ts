/**
 * AO-1E1.3 — AuthExperience must not own direct email-access Auth.
 *
 * Progressive seal for magic-link OTP, password-reset request, and
 * reset-mode password update.
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
const HOOK = "src/features/auth/presentation/hooks/useAuthEmailAccess.ts";
const SEND = "src/features/auth/infrastructure/sendMagicLinkEmail.ts";
const RESET = "src/features/auth/infrastructure/requestPasswordResetEmail.ts";
const UPDATE = "src/features/auth/infrastructure/updateAuthUserPassword.ts";

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

test("auth email access presentation — AuthExperience calls useAuthEmailAccess(", () => {
  const full = join(ROOT, COMPONENT);
  assert.ok(existsSync(full), `missing ${COMPONENT}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /useAuthEmailAccess\s*\(/, `${COMPONENT} must call useAuthEmailAccess(`);
});

test("auth email access presentation — component bans residual direct Auth ownership", () => {
  const text = stripAllComments(readFileSync(join(ROOT, COMPONENT), "utf8"));
  assert.doesNotMatch(text, /signInWithOtp/, `${COMPONENT} must not call signInWithOtp`);
  assert.doesNotMatch(
    text,
    /resetPasswordForEmail/,
    `${COMPONENT} must not call resetPasswordForEmail`,
  );
  assert.doesNotMatch(
    text,
    /@\/platform\/supabase/,
    `${COMPONENT} must not import platform Supabase after AO-1E1.3`,
  );
  assert.doesNotMatch(
    text,
    /from ["']@\/lib\/auth["']/,
    `${COMPONENT} must not import @/lib/auth after AO-1E1.3`,
  );
});

test("auth email access presentation — hook owns redirects and primitives", () => {
  const full = join(ROOT, HOOK);
  assert.ok(existsSync(full), `missing ${HOOK}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /sendMagicLinkEmail/);
  assert.match(text, /requestPasswordResetEmail/);
  assert.match(text, /updateAuthUserPassword/);
  assert.match(text, /auth\/callback/);
  assert.match(text, /redirect_to/);
  assert.match(text, /type=recovery/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
  assert.doesNotMatch(
    text,
    /\blogger\b|\btoast\b|useNavigate|setMagicLinkLoading|setForgotPasswordLoading/,
  );
});

test("auth email access presentation — infrastructure owns Auth methods", () => {
  for (const [path, method] of [
    [SEND, /signInWithOtp/],
    [RESET, /resetPasswordForEmail/],
    [UPDATE, /updateUser/],
  ] as const) {
    const full = join(ROOT, path);
    assert.ok(existsSync(full), `missing ${path}`);
    const text = stripAllComments(readFileSync(full, "utf8"));
    assert.match(text, /@\/platform\/supabase\/browser/);
    assert.match(text, method);
    assert.doesNotMatch(text, /\bwindow\b/);
    assert.doesNotMatch(text, /trackEvent|logger|toast|QueryClient|localStorage|captureAuthError/);
    assert.doesNotMatch(text, /from ["']react["']/);
  }
});

test("auth email access presentation — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useAuthEmailAccess = "fake";`;
  assert.match(sample, /useAuthEmailAccess/);
  assert.doesNotMatch(sample, /useAuthEmailAccess\s*\(/);
});
