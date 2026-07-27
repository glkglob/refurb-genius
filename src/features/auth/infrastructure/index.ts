/**
 * Auth feature infrastructure surface (internal).
 */
export { updateAuthOnboardingGoal } from "./updateAuthOnboardingGoal";
export {
  signInWithPasswordEmail,
  type SignInWithPasswordEmailInput,
  type SignInWithPasswordEmailResult,
} from "./signInWithPasswordEmail";
export {
  signUpWithPasswordEmail,
  type SignUpWithPasswordEmailInput,
  type SignUpWithPasswordEmailResult,
} from "./signUpWithPasswordEmail";
export {
  startOAuthSignIn,
  type AuthOAuthProvider,
  type StartOAuthSignInInput,
} from "./startOAuthSignIn";
