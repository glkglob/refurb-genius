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
export { startNativeOAuthSignIn, type StartNativeOAuthSignInInput } from "./startNativeOAuthSignIn";
export { extractNativeOAuthAuthorizationCode } from "./extractNativeOAuthAuthorizationCode";
export {
  exchangeNativeAuthCode,
  type ExchangeNativeAuthCodeInput,
  type ExchangeNativeAuthCodeResult,
} from "./exchangeNativeAuthCode";
/** Re-export pure mapper for app-shell consumers (hooks/routes) via infrastructure public surface. */
export { mapNativeSupabaseUser } from "../application/mapNativeSupabaseUser";
export { sendMagicLinkEmail, type SendMagicLinkEmailInput } from "./sendMagicLinkEmail";
export {
  requestPasswordResetEmail,
  type RequestPasswordResetEmailInput,
} from "./requestPasswordResetEmail";
export { updateAuthUserPassword, type UpdateAuthUserPasswordInput } from "./updateAuthUserPassword";
export {
  exchangeAuthCode,
  type ExchangeAuthCodeInput,
  type ExchangeAuthCodeResult,
} from "./exchangeAuthCode";
export {
  verifyEmailTokenHash,
  type VerifyEmailTokenHashInput,
  type VerifyEmailTokenHashResult,
} from "./verifyEmailTokenHash";
export { getBrowserAuthSession, type BrowserAuthSessionResult } from "./getBrowserAuthSession";
