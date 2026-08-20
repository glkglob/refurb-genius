# SDK and permissions inventory

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**Current BASE SHA:** `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`
**Verified:** 2026-08-20
**Rule:** Do not infer iOS runtime presence from a JavaScript package name alone. Native linkage requires `Package.swift`, `ios/**` source, or an Xcode/SPM archive.

This file is an **addition** on current main. It conceptually reconciles the historical `78b3a64` SDK inventory; that file did not exist on BASE.

---

## 1. Native / iOS packages evidenced in-repo

### 1.1 Capacitor SPM (linked)

**VERIFIED REPOSITORY FACT.** `ios/App/CapApp-SPM/Package.swift` (comment: managed by Capacitor CLI) depends on:

| SPM identity | Pin / path |
| ------------ | ---------- |
| `capacitor-swift-pm` | exact `8.3.4` (products `Capacitor`, `Cordova`) |
| `AparajitaCapacitorSecureStorage` | path under `node_modules/.pnpm/@aparajita+capacitor-secure-storage@8.0.0/...` |
| `CapacitorApp` | path under `node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.3.4/...` |

iOS platform declared `.iOS(.v15)`.
Evidence: git blob `ios/App/CapApp-SPM/Package.swift` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Matching npm dependencies in root `package.json`: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` `^8.3.4`; `@capacitor/app` `^8`; `@aparajita/capacitor-secure-storage` `8.0.0`.
Evidence: git blob `package.json` @ BASE SHA · verified 2026-08-20.

These npm names **plus** Package.swift paths are treated as native-linked for Capacitor/App/SecureStorage. Other npm packages in `package.json` are **not** listed as iOS SDKs unless also linked natively below.

### 1.2 First-party native code

**VERIFIED REPOSITORY FACT.** First-party Swift in the App target includes `AppDelegate.swift`, `SceneDelegate.swift`, and `WebAuthSessionPlugin.swift`.
Evidence: git tree `ios/App/App/*.swift` @ BASE SHA · verified 2026-08-20.

### 1.3 Explicitly absent from native link evidence

**VERIFIED REPOSITORY FACT.** There is no `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/geolocation`, `@capacitor/push-notifications`, or `@capacitor/browser` dependency in root `package.json`.
Evidence: git blob `package.json` `dependencies` @ BASE SHA · query: those package names absent · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** `Package.swift` does not reference a Camera or Photos Capacitor plugin.
Evidence: git blob `ios/App/CapApp-SPM/Package.swift` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Transitive native libraries pulled by Capacitor/Cordova SPM into a Release archive (beyond the three declared packages). Inspect the archive / `Frameworks` folder; do not assume from npm lockfile.

---

## 2. Info.plist usage strings and capabilities

**VERIFIED REPOSITORY FACT.** Declared usage description:

| Key | String |
| --- | ------ |
| `NSCameraUsageDescription` | `Refurb Genius uses the camera so you can photograph rooms and property details for refurbishment analysis.` |

Evidence: git blob `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** The following keys are **not** present in `ios/App/App/Info.plist`:

- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSLocationWhenInUseUsageDescription` / `NSLocationAlways*`
- `NSUserTrackingUsageDescription`
- `NSFaceIDUsageDescription`
- `ITSAppUsesNonExemptEncryption`
- `UIBackgroundModes`
- `NSAppTransportSecurity` (custom ATS exceptions)

Evidence: git blob `ios/App/App/Info.plist` @ BASE SHA · query: those keys absent · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** `UIRequiredDeviceCapabilities` contains `armv7`. Orientations include portrait and landscape.
Evidence: same Info.plist @ BASE SHA · verified 2026-08-20.

That `armv7` string is inventory prose only. It is **not** AC1-F11 (F11 is Sign in with Apple token revocation).

**EXTERNAL FACT / AC1-F03.** App Store Connect walks through an export-compliance questionnaire when `ITSAppUsesNonExemptEncryption` is absent. Including the key streamlines submission; absence is **not** itself proof of export-compliance failure.
Sources: https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption · https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/ · verified 2026-08-20.

Do **not** blindly recommend setting `ITSAppUsesNonExemptEncryption` to `false` without linked-crypto verification of the app and third-party libraries.

**PENDING VERIFICATION.** What App Store Connect currently has on file. Merged Info.plist from SPM packages after `cap copy` / Xcode archive.

---

## 3. Camera and photos capabilities (product vs native plugin)

**VERIFIED REPOSITORY FACT.** Upload UI uses HTML file inputs, not a Capacitor Camera plugin:

- camera control: `<input type="file" accept="image/*" capture="environment">`
- library control: `<input type="file" accept="image/*" multiple>`

Evidence: git blob `src/routes/_authed/projects.$id.upload.tsx` @ BASE SHA · query: `capture="environment"` · verified 2026-08-20.

**WATCH ITEM (AC1-F06).** `docs/capacitor-ios.md` lists “Camera/photo library plugins” as not included in Phase C. That is consistent with **no Capacitor Camera plugin**, but it is **stale** as a statement that the product does not use the camera: the web shell requests camera via `capture="environment"` and Info.plist has `NSCameraUsageDescription`.

**EXTERNAL FACT.** Apple documents that the system Photos picker grants access only to items the user selects and does not require broad photo-library authorisation.
Sources: https://developer.apple.com/documentation/photokit/selecting-photos-and-videos-in-ios · https://developer.apple.com/documentation/swiftui/view/photospicker(ispresented:selection:matching:preferreditemencoding:) · verified 2026-08-20.

**PENDING VERIFICATION (AC1-F02).** Whether this exact WKWebView HTML `<input type="file" accept="image/*" multiple>` path independently requires `NSPhotoLibraryUsageDescription` on the OS version under test. This pack does **not** assert that the missing usage-description key is required, and does **not** call it a confirmed App Review rejection.

---

## 4. Analytics / telemetry SDKs

Classify by **where the SDK is imported**, not by assuming a native `.framework`.

### 4.1 PostHog (JS)

**VERIFIED REPOSITORY FACT.** `posthog-js` / `@posthog/react` initialise in the **browser/WKWebView** platform module. Config includes `autocapture: false`, `persistence: "localStorage+cookie"`, `person_profiles: "identified_only"`, `capture_exceptions: true`. Init requires `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`.
Evidence: git blob `src/platform/posthog/browser.ts` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether iOS WKWebView builds ship a non-empty PostHog token (build-time env). Do not copy token values into this pack.

**PENDING VERIFICATION.** Apple ATT / “tracking” classification of this SDK on iOS.

There is **no** `NSUserTrackingUsageDescription` in Info.plist (**VERIFIED REPOSITORY FACT**, §2).

### 4.2 Sentry (JS)

**VERIFIED REPOSITORY FACT.** Browser Sentry (`@sentry/react`) initialises with `browserTracingIntegration` and `replayIntegration`; `sendDefaultPii: false`; sample rates traces 0.2, session replay 0.05.
Evidence: git blob `src/lib/sentry.ts` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether Production-mode iOS bundles include a Sentry DSN (`VITE_SENTRY_DSN`). Do not copy DSN values.

**PENDING VERIFICATION.** Whether Session Replay inside WKWebView is treated as tracking or requires additional Apple disclosures.

### 4.3 Apple JS SDK (web)

**VERIFIED REPOSITORY FACT.** Optional load of `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js` when Apple client ID is configured.
Evidence: `src/platform/auth/apple-sign-in-config.ts` `APPLE_SIGN_IN_SDK_URL` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether that script is loaded in the native shell at runtime.

### 4.4 Not evidenced as native iOS SDKs

Do **not** list OpenAI, Hugging Face, Resend, or `@sentry/node` as **iOS** SDKs. They are server/npm dependencies. Transmission of user data to those processors is a **data-inventory** question (see [`05-data-inventory.md`](./05-data-inventory.md)), not a native-link fact.

**VERIFIED REPOSITORY FACT.** No App Tracking Transparency / `AppTrackingTransparency` import appears in `ios/**` Swift.
Evidence: grep `ios/` @ BASE SHA · verified 2026-08-20.

---

## 5. Privacy manifests (AC1-F01)

**VERIFIED REPOSITORY FACT.** No `PrivacyInfo.xcprivacy` and no `*.xcprivacy` files exist in the repository tree.
Evidence: git tree search `*.xcprivacy` / `PrivacyInfo` @ BASE SHA · verified 2026-08-20.

**EXTERNAL FACT.** Apple requires privacy manifests describing collected data and required-reason API use for apps and third-party SDKs. Apple’s listed SDK set includes **Capacitor**. Any version of a listed SDK, and SDKs that repackage those on the list, are included in the requirement when submitting new apps or updates that add a listed SDK.
Sources: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files · https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api · https://developer.apple.com/support/third-party-SDK-requirements/ · verified 2026-08-20.

This pack does **not** claim guaranteed App Review rejection from repository absence of `PrivacyInfo.xcprivacy`.

**PENDING VERIFICATION.** Whether Capacitor 8.3.4 or Aparajita Secure Storage ships a privacy manifest inside `node_modules` that Xcode copies into the archive. Archive `Frameworks` contents are not proven from this tree.

---

## 6. URL types, associated domains, encryption

**VERIFIED REPOSITORY FACT.** URL scheme `com.refurbgenius.app` (role Editor).
Evidence: `ios/App/App/Info.plist` `CFBundleURLTypes` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Associated Domains entitlement `applinks:www.refurbgenius.info`, documented in-file as scaffold / not operational.
Evidence: `ios/App/App/App.entitlements` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** App Store Connect export-compliance answers currently on file (AC1-F03).

---

## 7. Archive-only / App Store Connect unknowns

| Item | Label |
| ---- | ----- |
| Linked binary list in `App.app/Frameworks` | PENDING VERIFICATION |
| Privacy manifests copied from SPM into the archive | PENDING VERIFICATION (AC1-F01) |
| Privacy Nutrition Labels currently on file | PENDING VERIFICATION (see [`08`](./08-app-privacy-declarations-worksheet.md); AC1-F13) |
| Age rating questionnaire | PENDING VERIFICATION |
| Required device capabilities vs 64-bit-only App Store (`armv7` still listed) | PENDING VERIFICATION (inventory only; not F11) |
| Push / Background Modes (none declared) | VERIFIED REPOSITORY FACT of absence in Info.plist |

---

## 8. Stale documentation (do not treat as current SDK list)

**WATCH ITEM (AC1-F06).** `docs/capacitor-ios.md` “Current Constraints” still says no native authentication, no analytics SDKs, no camera/photo library plugins, App Store reserved for Phase E. Current tree has Keychain native auth, PostHog/Sentry JS in the web shell, `NSCameraUsageDescription`, and HTML camera capture. Use source + this inventory over that section.
