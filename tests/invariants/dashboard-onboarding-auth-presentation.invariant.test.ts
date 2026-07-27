/**
 * AO-1D2 — Dashboard route must not own platform Supabase Auth onboarding writes.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment of a Supabase client imported under another name, dynamic
 * import strings split across concatenations, computed property names.
 *
 * Requires useOnboardingGoalSelection(.
 * Bans platform Supabase, supabase.auth, updateUser(, and route-owned
 * onboarding_goal: payload construction in the dashboard route.
 * Allows local mount useEffect, onboarding storage helpers, useAuth, trades.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const ROUTE = "src/routes/_authed/dashboard.tsx";
const HOOK = "src/features/auth/presentation/hooks/useOnboardingGoalSelection.ts";
const PRIMITIVE = "src/features/auth/infrastructure/updateAuthOnboardingGoal.ts";

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

test("dashboard onboarding Auth — Dashboard calls useOnboardingGoalSelection(", () => {
  const full = join(ROOT, ROUTE);
  assert.ok(existsSync(full), `missing ${ROUTE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(
    text,
    /useOnboardingGoalSelection\s*\(/,
    `${ROUTE} must call useOnboardingGoalSelection(`,
  );
});

test("dashboard onboarding Auth — route bans platform Supabase and Auth update", () => {
  const text = stripAllComments(readFileSync(join(ROOT, ROUTE), "utf8"));
  assert.doesNotMatch(text, /@\/platform\/supabase/, `${ROUTE} must not import platform supabase`);
  assert.doesNotMatch(text, /supabase\.auth/, `${ROUTE} must not reference supabase.auth`);
  assert.doesNotMatch(text, /auth\.updateUser/, `${ROUTE} must not call auth.updateUser`);
  assert.doesNotMatch(text, /updateUser\s*\(/, `${ROUTE} must not call updateUser(`);
  assert.doesNotMatch(
    text,
    /onboarding_goal\s*:/,
    `${ROUTE} must not construct onboarding_goal Auth payload`,
  );
});

test("dashboard onboarding Auth — hook orchestrates storage then Auth primitive", () => {
  const full = join(ROOT, HOOK);
  assert.ok(existsSync(full), `missing ${HOOK}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /writeOnboardingGoal/);
  assert.match(text, /readOnboardingGoal/);
  assert.match(text, /updateAuthOnboardingGoal/);
  assert.doesNotMatch(text, /@\/platform\/supabase/);
  assert.doesNotMatch(text, /useMutation|useQueryClient|invalidateQueries|toast|logger/);
});

test("dashboard onboarding Auth — infrastructure owns updateUser payload", () => {
  const full = join(ROOT, PRIMITIVE);
  assert.ok(existsSync(full), `missing ${PRIMITIVE}`);
  const text = stripAllComments(readFileSync(full, "utf8"));
  assert.match(text, /@\/platform\/supabase\/browser/);
  assert.match(text, /updateUser/);
  assert.match(text, /onboarding_goal/);
  assert.doesNotMatch(text, /useQuery|useMutation|QueryClient|localStorage|toast|logger/);
  assert.doesNotMatch(text, /\.from\s*\(|\.insert\s*\(|\.upsert\s*\(/);
});

test("dashboard onboarding Auth — probe: residual platform supabase is forbidden", () => {
  const sample = `import { supabase } from "@/platform/supabase/browser";
await supabase.auth.updateUser({
  data: {
    onboarding_goal: next,
  },
});
`;
  assert.match(sample, /@\/platform\/supabase/);
  assert.match(sample, /supabase\.auth/);
  assert.match(sample, /updateUser\s*\(/);
  assert.match(sample, /onboarding_goal\s*:/);
});

test("dashboard onboarding Auth — probe: string-only hook name does not satisfy call", () => {
  const sample = `const useOnboardingGoalSelection = "fake";`;
  assert.match(sample, /useOnboardingGoalSelection/);
  assert.doesNotMatch(sample, /useOnboardingGoalSelection\s*\(/);
});

test("dashboard onboarding Auth — legitimate mount useEffect is still present", () => {
  const text = stripAllComments(readFileSync(join(ROOT, ROUTE), "utf8"));
  assert.match(text, /useEffect\s*\(/);
  assert.match(text, /consumeNewUserOnboarding/);
  assert.match(text, /hydrateOnboardingGoal/);
});
