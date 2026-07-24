import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  consumeNewUserOnboarding,
  hasCompletedFirstStudy,
  markNewUserOnboarding,
  NEW_USER_ONBOARDING_KEY,
  ONBOARDING_GOAL_KEY,
  FIRST_STUDY_CELEBRATION_KEY,
  readOnboardingGoal,
  writeOnboardingGoal,
} from "./onboardingStorage";

describe("onboardingStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("marks and consumes the new-user onboarding flag once", () => {
    expect(consumeNewUserOnboarding()).toBe(false);

    markNewUserOnboarding();
    expect(window.localStorage.getItem(NEW_USER_ONBOARDING_KEY)).toBe("1");

    expect(consumeNewUserOnboarding()).toBe(true);
    expect(window.localStorage.getItem(NEW_USER_ONBOARDING_KEY)).toBeNull();
    // Second consume is a no-op so the card does not reappear after dismiss/reload.
    expect(consumeNewUserOnboarding()).toBe(false);
  });

  it("writes, reads, and clears the optional onboarding goal", () => {
    expect(readOnboardingGoal()).toBe("");

    expect(writeOnboardingGoal("  Run my first feasibility study  ")).toBe(
      "Run my first feasibility study",
    );
    expect(window.localStorage.getItem(ONBOARDING_GOAL_KEY)).toBe("Run my first feasibility study");
    expect(readOnboardingGoal()).toBe("Run my first feasibility study");

    expect(writeOnboardingGoal("   ")).toBe("");
    expect(window.localStorage.getItem(ONBOARDING_GOAL_KEY)).toBeNull();
    expect(readOnboardingGoal()).toBe("");
  });

  it("reports first-study celebration from storage", () => {
    expect(hasCompletedFirstStudy()).toBe(false);
    window.localStorage.setItem(FIRST_STUDY_CELEBRATION_KEY, "1");
    expect(hasCompletedFirstStudy()).toBe(true);
  });
});
