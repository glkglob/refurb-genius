# Sign in with Apple revocation worksheet

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**Current BASE SHA:** `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`
**Verified:** 2026-08-20

**This file is a WORKSHEET, not a final declaration.**
It does **not** implement Sign in with Apple, token revocation, entitlements, or App Store Connect configuration. It does **not** claim active non-compliance.

This file is an **addition** on current main.

---

## 1. Purpose

Collect labelled evidence for later SIWA account-deletion / token-revocation work (AC1-F11). This worksheet is not a legal opinion and not an App Store submission.

---

## 2. Apple requirement (external)

**EXTERNAL FACT.** Apple TN3194 describes handling account deletions and revoking tokens for Sign in with Apple. The token revocation endpoint (`/auth/revoke`) is documented as the programmatic way to invalidate user tokens associated with the developer account without user interaction. A valid refresh token or access token is required for that endpoint. Apple also states that if those tokens are unavailable, the developer must still fulfil the user’s account deletion request.
Source: https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple · verified 2026-08-20.

**EXTERNAL FACT.** Guideline 5.1.1(v) requires in-app account deletion when the app supports account creation.
Source: https://developer.apple.com/app-store/review/guidelines/ · verified 2026-08-20.

---

## 3. Repository evidence (re-read at BASE)

**VERIFIED REPOSITORY FACT.** `ios/App/App/App.entitlements` contains Associated Domains only. It does **not** contain `com.apple.developer.applesignin`.
Evidence: git blob `ios/App/App/App.entitlements` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** No `auth/revoke` or `appleid.apple.com` revoke path appears under `src/`.
Evidence: repository search `auth/revoke` under `src/` @ BASE SHA · empty · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Browser JS SDK helpers exist. `APPLE_SIGN_IN_SDK_URL` is `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js`. Meta tags are emitted only when `VITE_APPLE_CLIENT_ID` resolves to a non-empty client ID. The file comments that this is **separate** from Supabase OAuth provider `"apple"`.
Evidence: git blob `src/platform/auth/apple-sign-in-config.ts` · `src/routes/__root.tsx` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** First-party `WebAuthSessionPlugin.swift` is present. Custom URL scheme `com.refurbgenius.app` is declared; comment states canonical callback `com.refurbgenius.app://auth/callback`.
Evidence: `ios/App/App/WebAuthSessionPlugin.swift` · `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Current account deletion (email/password and other cookie/Bearer identities) is documented in [`06-account-deletion-evidence.md`](./06-account-deletion-evidence.md). That runner calls `auth.admin.deleteUser` after Storage cleanup. This worksheet does not treat that call as Apple token revocation.

---

## 4. Supabase documentation (bounded conclusion)

**EXTERNAL FACT.** Supabase primary documentation for Login with Apple describes configuring the Apple provider (Services ID, secret key, dashboard/Management API). That documentation was reviewed for this worksheet.

**Bounded conclusion:** Reviewed Supabase primary documentation does not establish automatic Apple `/auth/revoke` as part of `auth.admin.deleteUser`.

Do **not** infer undocumented behaviour either way. Do **not** write that Supabase does, or does not, revoke Apple tokens beyond the sentence above.

Source: https://supabase.com/docs/guides/auth/social-login/auth-apple · verified 2026-08-20.

---

## 5. Finding AC1-F11

| Field | Value |
| ----- | ----- |
| ID | AC1-F11 |
| Severity | P1 |
| Status | **PENDING LIVE VERIFICATION** |
| Apple requirement | **EXTERNAL FACT** (TN3194 `/auth/revoke`) |
| In-repo revoke implementation | **VERIFIED REPOSITORY FACT** of absence |
| Production Apple provider / `VITE_APPLE_CLIENT_ID` / native path | **PENDING VERIFICATION** |
| Active non-compliance claim | **Not made** |

Do **not** implement revocation in this documentation slice.

---

## 6. Worksheet (not filled as a declaration)

| Question | Evidence class | Notes |
| -------- | -------------- | ----- |
| Does Production have Apple Sign In enabled for this app? | PENDING VERIFICATION | App Store Connect / Supabase dashboard / `VITE_APPLE_CLIENT_ID` not inspected here |
| Native path: JS SDK vs Supabase OAuth vs entitlement? | PENDING VERIFICATION | Entitlement absent in repo; JS SDK helpers present; ASWebAuthenticationSession present |
| Are Apple refresh/access tokens stored so `/auth/revoke` can be called? | PENDING VERIFICATION | Not evidenced in this pass |
| Does account deletion call Apple `/auth/revoke`? | VERIFIED REPOSITORY FACT of no in-repo `/auth/revoke` | Live provider applicability still PENDING |
| Must SIWA revocation block email/password deletion? | RECOMMENDATION | Historical programme decision: SIWA is a separate App Store-readiness gate; not part of the confirmed email/password deletion P0 |

---

## 7. Explicit non-claims

This worksheet does **not** claim:

- that Sign in with Apple is live in Production
- that Apple will reject the app for missing `/auth/revoke`
- that `auth.admin.deleteUser` does or does not revoke Apple tokens
- legal sufficiency of the current deletion path for SIWA users
