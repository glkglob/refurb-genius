# App Privacy declarations worksheet

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**Current BASE SHA:** `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`
**Verified:** 2026-08-20

**This file is a WORKSHEET, not a final App Store Connect declaration.**
It does **not** submit, infer, or certify Privacy Nutrition Labels. Final answers are **LEGAL CONFIRMATION REQUIRED**. Runtime and App Store Connect unknowns remain **PENDING VERIFICATION**.

This file is an **addition** on current main.

Do **not** infer declarations from npm/package or lockfile names.

---

## 1. Purpose

Map **repository-evidenced** collection, linkage, and purpose into Apple App Privacy categories as a worksheet for later counsel / App Store Connect work (AC1-F13). Cross-check data classes in [`05-data-inventory.md`](./05-data-inventory.md).

---

## 2. Apple requirement (external)

**EXTERNAL FACT.** Developers must provide information about the app’s privacy practices, including practices of third-party partners whose code is integrated, in App Store Connect. That information is displayed as Privacy Nutrition Labels.
Sources: https://developer.apple.com/app-store/app-privacy-details/ · https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/ · verified 2026-08-20.

**EXTERNAL FACT.** Guideline 5.1.2(i) requires disclosure and explicit permission before sharing personal data with third parties, including third-party AI.
Sources: https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/news/?id=ey6d8onl · verified 2026-08-20.

---

## 3. Worksheet — categories with repository evidence

Answers below are **not** App Store Connect submissions. “Linked to identity” here means the repository associates the data with `auth.users` / `user_id` (or equivalent), not a legal “linked to you” determination.

| Apple-style category (worksheet) | Repository evidence | Linked in repo? | Purpose evidenced in repo | Evidence class |
| -------------------------------- | ------------------- | --------------- | ------------------------- | -------------- |
| Contact Info (email) | Auth email; Resend transactional mail | Yes (`auth.users`) | Account, notifications | VERIFIED REPOSITORY FACT of code path; live send catalogue PENDING VERIFICATION |
| User Content (photos / property media) | `project-photos` Storage; `photos` metadata | Yes (`user_id`) | Analysis, redesign, estimates | VERIFIED REPOSITORY FACT of upload/AI paths |
| User Content (project / property text) | `projects` and related tables | Yes | Product workflow | VERIFIED REPOSITORY FACT |
| Identifiers (user id / session) | `pip-auth` cookie; native `rg-native-auth` Keychain | Yes | Authentication | VERIFIED REPOSITORY FACT |
| Diagnostics | Sentry exceptions/traces/replay when DSN present | Possibly (Sentry user context **PENDING VERIFICATION**) | Crash/error reporting | VERIFIED REPOSITORY FACT of SDK init; DSN presence PENDING VERIFICATION |
| Product Interaction / Usage Data | PostHog events when token present | Possibly (`person_profiles: identified_only`) | Product analytics | VERIFIED REPOSITORY FACT of SDK init; token presence PENDING VERIFICATION |
| Location (precise) | No `NSLocation*` keys; no Core Location plugin | No Core Location evidenced | N/A for GPS | VERIFIED REPOSITORY FACT of absence in Info.plist |
| Location (coarse / address text) | User-entered address/postcode/region text | Yes if stored on project | Pricing/region copy | PENDING VERIFICATION of exact columns vs nutrition-label “Physical Address” |
| Tracking | No ATT API / no `NSUserTrackingUsageDescription` | — | — | VERIFIED REPOSITORY FACT of absence; ATT classification of PostHog/Sentry Replay is LEGAL CONFIRMATION REQUIRED + PENDING VERIFICATION |

Do **not** list OpenAI or Hugging Face as **iOS SDKs**. They are server processors (see `05` §10). Whether photo payloads are “personal data” under Guideline 5.1.2(i) is **LEGAL CONFIRMATION REQUIRED**, not a repository fact (AC1-F12).

---

## 4. Third parties whose **code** may run in the iOS shell

Only native-linked or WKWebView JS evidenced in-repo (see [`04`](./04-sdk-and-permissions-inventory.md)):

| Party | How evidenced | Privacy-label relevance |
| ----- | ------------- | ----------------------- |
| Capacitor / Ionic | SPM `capacitor-swift-pm` 8.3.4 | Listed SDK for privacy manifests (**EXTERNAL FACT**); archive coverage PENDING VERIFICATION |
| Aparajita Secure Storage | SPM path, npm `8.0.0` | Keychain session storage |
| Capacitor App | SPM / npm | App lifecycle |
| PostHog JS | `src/platform/posthog/browser.ts` | Usage/diagnostics **if** token present |
| Sentry JS | `src/lib/sentry.ts` | Diagnostics/replay **if** DSN present |
| Apple JS SDK | optional `appleid.auth.js` | Auth **if** client ID configured |

Server-only processors (OpenAI, Hugging Face, Resend, `@sentry/node`) are **not** inferred as iOS binaries from npm names.

---

## 5. Finding AC1-F13

| Field | Value |
| ----- | ----- |
| ID | AC1-F13 |
| Severity | P1 |
| Status | **PENDING VERIFICATION** |
| This file | **WORKSHEET only** |
| App Store Connect answers currently on file | **PENDING VERIFICATION** (not inspected) |
| Final nutrition-label correctness | **LEGAL CONFIRMATION REQUIRED** |

---

## 6. Explicit non-claims

This worksheet does **not** claim:

- App Store Privacy Nutrition Labels are complete or correct
- tracking / ATT status of PostHog or Sentry Replay
- that every uploaded property photo is personal data
- that package.json names equal collected data types
- archive privacy-manifest contents
