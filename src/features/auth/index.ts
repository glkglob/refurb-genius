/**
 * Auth slice — public API.
 */
export * from "./presentation";
export {
  consumeNewUserOnboarding,
  markNewUserOnboarding,
  hasCompletedFirstStudy,
  readOnboardingGoal,
  writeOnboardingGoal,
  NEW_USER_ONBOARDING_KEY,
  ONBOARDING_GOAL_KEY,
  ONBOARDING_GOAL_OPTIONS,
} from "./onboardingStorage";
