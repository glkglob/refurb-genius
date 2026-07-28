/**
 * AO-1E1.1 — AuthExperience must not own direct password sign-in / signup Auth.
 *
 * Progressive seal: OAuth, OTP, and recovery Auth remain temporarily allowed
 * until AO-1E1.2 / AO-1E1.3.
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
const HOOK = "src/features/auth/presentation/hooks/useAuthPasswordCredentials.ts";
const SIGN_IN = "src/features/auth/infrastructure/signInWithPasswordEmail.ts";
const SIGN_UP = "src/features/auth/infrastructure/signUpWithPasswordEmail.ts";

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

test("auth password presentation — AuthExperience calls useAuthPasswordCredentials(", () => {
  const full = join(ROOT, COMPONENT);
  assert.ok(existsSync(full), `missing ${COMPONENT}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /useAuthPasswordCredentials\s*\(/,
    `${COMPONENT} must call useAuthPasswordCredentials(`,
  );
});

test("auth password presentation — component bans direct password Auth methods", () => {
  const text = stripAllComments(readFileSync(join(ROOT, COMPONENT), "utf8"));
  assert.doesNotMatch(
    text,
    /\.signInWithPassword\s*\(/,
    `${COMPONENT} must not call .signInWithPassword(`,
  );
  assert.doesNotMatch(text, /auth\.signUp\s*\(/, `${COMPONENT} must not call auth.signUp(`);
  assert.doesNotMatch(
    text,
    /supabase\.auth\.signUp\s*\(/,
    `${COMPONENT} must not call supabase.auth.signUp(`,
  );
  // Bare object-form signUp used previously for password signup
  assert.doesNotMatch(
    text,
    /await\s+supabase\.auth\.signUp\s*\(/,
    `${COMPONENT} must not await supabase.auth.signUp(`,
  );
});

test("auth password presentation — component bans password-flow QC seed and onboarding mark", () => {
  const text = stripAllComments(readFileSync(join(ROOT, COMPONENT), "utf8"));
  assert.doesNotMatch(
    text,
    /AUTH_USER_QUERY_KEY/,
    `${COMPONENT} must not reference AUTH_USER_QUERY_KEY`,
  );
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not call setQueryData`);
  assert.doesNotMatch(text, /fromSupabaseUser/, `${COMPONENT} must not map Auth users`);
  assert.doesNotMatch(
    text,
    /markNewUserOnboarding/,
    `${COMPONENT} must not mark new-user onboarding directly`,
  );
  assert.doesNotMatch(
    text,
    /identifyAnalyticsUser|trackSignupCompleted/,
    `${COMPONENT} must not own password-flow analytics`,
  );
});

test("auth password presentation — hook orchestrates primitives, cache, analytics", () => {
  const full = join(ROOT, HOOK);
  assert.ok(existsSync(full), `missing ${HOOK}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /signInWithPasswordEmail/);
  assert.match(text, /signUpWithPasswordEmail/);
  assert.match(text, /setQueryData/);
  assert.match(text, /AUTH_USER_QUERY_KEY/);
  assert.match(text, /markNewUserOnboarding/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
  assert.doesNotMatch(text, /\btoast\b|\blogger\b|useNavigate/);
});

test("auth password presentation — infrastructure owns password Auth methods", () => {
  const signIn = stripAllComments(readFileSync(join(ROOT, SIGN_IN), "utf8"));
  const signUp = stripAllComments(readFileSync(join(ROOT, SIGN_UP), "utf8"));
  assert.match(signIn, /@\/platform\/supabase\/browser/);
  assert.match(signIn, /signInWithPassword/);
  assert.match(signUp, /@\/platform\/supabase\/browser/);
  assert.match(signUp, /signUp/);
  assert.match(signUp, /full_name/);
  assert.match(signUp, /company_name/);
  assert.doesNotMatch(signUp, /emailRedirectTo/);
  assert.doesNotMatch(signIn, /useQuery|useMutation|QueryClient|localStorage|toast|logger/);
  assert.doesNotMatch(signUp, /useQuery|useMutation|QueryClient|localStorage|toast|logger/);
});

test("auth password presentation — OAuth and email-access residuals extracted under AO-1E1.2/E1.3", () => {
  const text = stripAllComments(readFileSync(join(ROOT, COMPONENT), "utf8"));
  assert.doesNotMatch(
    text,
    /signInWithOAuth/,
    `${COMPONENT} must not retain direct OAuth after AO-1E1.2`,
  );
  assert.doesNotMatch(
    text,
    /signInWithOtp/,
    `${COMPONENT} must not retain direct OTP after AO-1E1.3`,
  );
  assert.match(
    text,
    /useAuthEmailAccess\s*\(/,
    `${COMPONENT} must call useAuthEmailAccess after AO-1E1.3`,
  );
});

test("auth password presentation — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useAuthPasswordCredentials = "fake";`;
  assert.match(sample, /useAuthPasswordCredentials/);
  assert.doesNotMatch(sample, /useAuthPasswordCredentials\s*\(/);
});
