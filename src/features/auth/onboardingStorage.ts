/**
 * Client-side onboarding markers shared by signup and the dashboard checklist.
 * Keys are intentionally browser-local; optional goals may also be mirrored to
 * Supabase user metadata when a session exists.
 */

export const NEW_USER_ONBOARDING_KEY = "refurb-genius:onboarding:new-user";
export const ONBOARDING_GOAL_KEY = "refurb-genius:onboarding:goal";
export const FIRST_STUDY_CELEBRATION_KEY = "refurb-genius:first-study-celebration";

export const ONBOARDING_GOAL_OPTIONS = [
  "Run my first feasibility study",
  "Estimate refurb costs on a project",
  "Model ROI for an investment deal",
  "Prepare an investor report export",
] as const;

export type OnboardingGoalOption = (typeof ONBOARDING_GOAL_OPTIONS)[number];

/** Mark this browser as having a brand-new signup (consumed once on dashboard). */
export function markNewUserOnboarding(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEW_USER_ONBOARDING_KEY, "1");
}

/**
 * Read-and-clear the new-user flag. Returns true only on the first post-signup
 * dashboard visit in this browser.
 */
export function consumeNewUserOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(NEW_USER_ONBOARDING_KEY) !== "1") return false;
  window.localStorage.removeItem(NEW_USER_ONBOARDING_KEY);
  return true;
}

export function readOnboardingGoal(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ONBOARDING_GOAL_KEY) ?? "";
}

/**
 * Persist the optional first-action preference in localStorage.
 * Empty string clears the stored goal.
 */
export function writeOnboardingGoal(goal: string): string {
  if (typeof window === "undefined") return goal;
  const trimmed = goal.trim();
  if (!trimmed) {
    window.localStorage.removeItem(ONBOARDING_GOAL_KEY);
    return "";
  }
  window.localStorage.setItem(ONBOARDING_GOAL_KEY, trimmed);
  return trimmed;
}

export function hasCompletedFirstStudy(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(FIRST_STUDY_CELEBRATION_KEY) === "1";
}
