# Technical baseline (Apple-relevant)

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**Current BASE SHA:** `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`
**Verified:** 2026-08-20
**Scope:** Application architecture that matters for an eventual iOS submission.
**Not:** readiness declaration or runtime proof of a shipped IPA.

This file is an **addition** on current main. It conceptually reconciles the historical `78b3a64` technical baseline; that file did not exist on BASE.

---

## 1. Product and repository

**VERIFIED REPOSITORY FACT.** The repository is a pnpm workspace hosting a single TanStack Start application under `src/`, not an `apps/*` multi-app monorepo.
Evidence: committed doc `docs/architecture/overview.md` §1 · git tree @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Root `package.json` name is `tanstack_start_ts`, `private: true`. There is no npm `version` field.
Evidence: git blob `package.json` @ BASE SHA · query: `"name"`, absence of `"version"` · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Declared stack in programme docs: TanStack Start (React 19), Vite 7 + Nitro, TypeScript, Tailwind v4, Supabase, OpenAI via server paths, Vercel deploy, Sentry, pnpm + Turbo.
Evidence: `AGENTS.md` “Tech Stack” table @ BASE SHA · verified 2026-08-20.

**WATCH ITEM (AC1-F06).** `docs/capacitor-ios.md` “Current Constraints” still lists Phase C exclusions (no native authentication, no camera/photo library plugins, no analytics SDKs, App Store reserved for Phase E). Current source has Keychain native auth, PostHog/Sentry JS in the web shell, `NSCameraUsageDescription`, and HTML camera capture. Use source + this pack over that section.

---

## 2. Web vs native / Capacitor boundary

**VERIFIED REPOSITORY FACT.** Capacitor wraps a locally bundled iOS SPA. Config:

| Key | Value |
| --- | ----- |
| `appId` | `com.refurbgenius.app` |
| `appName` | `Refurb Genius` |
| `webDir` | `dist/ios/client` |
| `ios.scheme` | `dark` |

`capacitor.config.ts` comments that there is **no** `server.url` (local bundle only; do not point Capacitor at Production).
Evidence: git blob `capacitor.config.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** iOS packaging is a separate Vite config (`vite.ios.config.ts`) from Vercel (`vite.vercel.config.ts`). The iOS build uses TanStack Start SPA prerender and a dedicated server entry `src/server.ios.ts`.
Evidence: git blob `vite.ios.config.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Native platform detection uses Capacitor (`Capacitor.isNativePlatform()`), including photo-write client selection and account-deletion client selection.
Evidence: `src/lib/photos-write.ts` · `src/features/account-deletion/presentation/deleteAccountForClient.ts` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether a given physical install was produced by `pnpm prepare:ios` at this SHA. This tree does not contain a certified archive.

**EXTERNAL FACT.** Since 2026-04-28, apps uploaded to App Store Connect must be built with Xcode 26 or later using an iOS 26-family SDK.
Source: https://developer.apple.com/news/upcoming-requirements/ · verified 2026-08-20.
Repo `IPHONEOS_DEPLOYMENT_TARGET` remaining `15.0` is a separate **VERIFIED REPOSITORY FACT**. This pack does **not** claim an archive of this SHA was built with Xcode 26.

---

## 3. iOS bundle and Xcode settings

**VERIFIED REPOSITORY FACT.** Project-level (`PBXProject` Debug / Release) settings include:

| Setting | Value |
| ------- | ----- |
| `CODE_SIGN_IDENTITY` | `iPhone Developer` |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.0` |

App-target (Debug `504EC317` / Release `504EC318`) settings include:

| Setting | Value |
| ------- | ----- |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.refurbgenius.app` |
| `MARKETING_VERSION` | `1.0` |
| `CURRENT_PROJECT_VERSION` | `1` |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.0` |
| `CODE_SIGN_STYLE` | `Automatic` |
| `CODE_SIGN_ENTITLEMENTS` | `App/App.entitlements` |
| `TARGETED_DEVICE_FAMILY` | `1,2` (iPhone + iPad) |
| `INFOPLIST_FILE` | `App/Info.plist` |

`CODE_SIGN_IDENTITY` is **project-level only** in this pbxproj; it is not an App-target build setting. `IPHONEOS_DEPLOYMENT_TARGET` appears at **both** levels.
Evidence: git blob `ios/App/App.xcodeproj/project.pbxproj` @ BASE SHA · those keys · verified 2026-08-20.

**PENDING VERIFICATION (AC1-F09).** `DEVELOPMENT_TEAM` is not present in `project.pbxproj`. Actual signing team is archive/local-Xcode state.

**WATCH ITEM (AC1-F10).** Marketing/build numbers `1.0` / `1` are repository defaults, not evidence of an App Store version.

**VERIFIED REPOSITORY FACT.** Info.plist display name is `Refurb Genius`; bundle identifier/version are Xcode variable substitutions. Custom URL scheme `com.refurbgenius.app` is declared; comment states canonical OAuth callback `com.refurbgenius.app://auth/callback` and forbids designing access/refresh tokens into that URL.
Evidence: git blob `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-20.

---

## 4. Authentication and runtime service boundaries

**VERIFIED REPOSITORY FACT.** Web authenticated server functions use cookie/pip-auth (`createServerSupabase` + cookie name `pip-auth`). Native must not be assumed to share that cookie jar.
Evidence: `AGENTS.md` · `packages/supabase/src/browser.ts` comment @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Native Supabase client `getNativeSupabase()`:

- throws unless `Capacitor.isNativePlatform()`;
- uses `persistSession: true`, `autoRefreshToken: false`;
- storage key `rg-native-auth`.

Evidence: git blob `src/platform/supabase/native.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** First-party Swift in the App target includes `AppDelegate.swift`, `SceneDelegate.swift`, and `WebAuthSessionPlugin.swift`.
Evidence: git tree `ios/App/App/*.swift` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Mobile HTTP API namespace is `/api/mobile/v1/*`. In-tree handlers at this BASE:

| Path | Role |
| ---- | ---- |
| `POST /api/mobile/v1/session/ping` | Session canary |
| `POST /api/mobile/v1/analysis/run` | Native photo analysis (Bearer) |
| `POST /api/mobile/v1/redesign/generate` | Native redesign generate (Bearer) |
| `POST /api/mobile/v1/account/delete` | Native account deletion (Bearer) |
| `POST /api/mobile/v1/scope/analyze` | Native scope analysis (Bearer) |

Evidence: git blob `src/platform/http/mobile-api.server.ts` @ BASE SHA · query: `MOBILE_*_PATHNAME` · verified 2026-08-20.

**HISTORICAL FACT** @ `b599931` / pack `78b3a64`: the historical baseline table listed only ping, analysis/run, and redesign/generate.

**VERIFIED REPOSITORY FACT.** Optional Apple Sign In **browser JS SDK** helpers exist (`VITE_APPLE_CLIENT_ID` → meta tags + `appleid.auth.js`). Separate from “Supabase OAuth provider apple”. Unconfigured client ID emits no Apple meta.
Evidence: `src/platform/auth/apple-sign-in-config.ts` · `src/routes/__root.tsx` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether Production/native builds have `VITE_APPLE_CLIENT_ID` set; whether native sign-in uses ASWebAuthenticationSession + Supabase OAuth, the Apple JS SDK inside WKWebView, or a native Sign in with Apple entitlement. No Sign in with Apple entitlement appears in `App.entitlements` (**VERIFIED REPOSITORY FACT** of absence). See [`07-sign-in-with-apple-revocation-worksheet.md`](./07-sign-in-with-apple-revocation-worksheet.md).

**VERIFIED REPOSITORY FACT.** Account deletion UI calls `deleteAccountForClient()`: native → Bearer `POST /api/mobile/v1/account/delete`; web → cookie `deleteAccountServerFn`. Both require `{ success: true }`. See [`06-account-deletion-evidence.md`](./06-account-deletion-evidence.md).
Evidence: `src/features/account-deletion/presentation/deleteAccountForClient.ts` · `src/routes/_authed/settings.tsx` @ BASE SHA · verified 2026-08-20.

---

## 5. Backend, storage, and API dependencies

**VERIFIED REPOSITORY FACT.** Backend is Supabase (Postgres, Auth, Storage). Production project hard-gate documented as `sxhzjmzfkgbogmlsbeju`. Preview refs are not Production.
Evidence: `AGENTS.md` Model B section @ BASE SHA · verified 2026-08-20.

**EXTERNAL FACT.** Preview branches are isolated environments and do not prove Production state.
Source: https://supabase.com/docs/guides/deployment/branching · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Production web origin used in code defaults / comments: `https://www.refurbgenius.info`.
Evidence: `.env.example` · `docs/ios-build-provenance.md` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Authenticated project photos use bucket id `project-photos`. Display signed URL TTL is 900 seconds; AI retrieval signed URL TTL is 300 seconds.
Evidence: `src/features/ai-upload/presentation/projectPhotoDisplay.ts` `SIGNED_URL_TTL_SECONDS = 900` · `src/features/ai-upload/infrastructure/resolveAuthorizedPhotos.server.ts` `AI_SIGNED_URL_TTL_SECONDS = 300` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Server-side OpenAI is gated on `process.env.OPENAI_API_KEY` in analysis/redesign/estimate adapters. Hugging Face Inference is a **server-only** platform module. Transactional email wrapper is server-only Resend (`src/lib/email.ts`, `RESEND_API_KEY`, from `notifications@mail.refurbgenius.info`).
Evidence: those files @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether Production currently routes any live user photo through Hugging Face versus OpenAI (adapter presence ≠ live routing).

---

## 6. Associated domains / Universal Links

**VERIFIED REPOSITORY FACT (AC1-F07).** `App.entitlements` includes `applinks:www.refurbgenius.info` and states Universal Links are **not operational** until Apple Developer Associated Domains, a published AASA with real Team ID, and signing include the entitlement.
Evidence: git blob `ios/App/App/App.entitlements` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** No `apple-app-site-association` file exists under `public/`.
Evidence: git tree `public/` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Production HTTPS AASA publication and Team ID.

---

## 7. Native Scope Save (out of scope)

Native Scope Save remains a **separate P1 engineering slice**. This pack does not inspect or repair it beyond that identification. Native **scope analysis** over Bearer `POST /api/mobile/v1/scope/analyze` is in-tree at this BASE (see §4) and is not the same slice as Scope Save persistence.

---

## 8. Unresolved baseline evidence

| Topic | Label |
| ----- | ----- |
| Installed App.app / IPA equals this SHA | PENDING VERIFICATION |
| Apple Team ID / provisioning | PENDING VERIFICATION (AC1-F09) |
| App Store Connect app record | PENDING VERIFICATION |
| Live Production `project-photos` public flag | PENDING VERIFICATION (Model B) |
| Effective Info.plist after SPM embed | PENDING VERIFICATION |
| Archive built with Xcode 26 / iOS 26 SDK | PENDING VERIFICATION |
| `docs/capacitor-ios.md` Phase C narrative vs current native auth | WATCH ITEM (AC1-F06) |
