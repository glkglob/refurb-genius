# SDK and permissions inventory

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**BASE SHA:** `b5999318375d087c1469dd7f1f0b6e1bfcdc0588`
**Verified:** 2026-08-19
**Rule:** Do not infer iOS runtime presence from a JavaScript package name alone. Native linkage requires `Package.swift`, `ios/**` source, or an Xcode/SPM archive.

---

## 1. Native / iOS packages evidenced in-repo

### 1.1 Capacitor SPM (linked)

**VERIFIED FACT.** `ios/App/CapApp-SPM/Package.swift` (comment: managed by Capacitor CLI) depends on:

| SPM identity | Pin / path |
| ------------ | ---------- |
| `capacitor-swift-pm` | exact `8.3.4` (products `Capacitor`, `Cordova`) |
| `AparajitaCapacitorSecureStorage` | path under `node_modules/.pnpm/@aparajita+capacitor-secure-storage@8.0.0/...` |
| `CapacitorApp` | path under `node_modules/.pnpm/@capacitor+app@8.1.1_@capacitor+core@8.3.4/...` |

iOS platform declared `.iOS(.v15)`.
Evidence: git blob `ios/App/CapApp-SPM/Package.swift` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Matching npm dependencies in root `package.json`: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` `^8.3.4`; `@capacitor/app` `^8`; `@aparajita/capacitor-secure-storage` `8.0.0`.
Evidence: git blob `package.json` @ BASE SHA · verified 2026-08-19.

These npm names **plus** Package.swift paths are treated as native-linked for Capacitor/App/SecureStorage. Other npm packages in `package.json` are **not** listed as iOS SDKs unless also linked natively below.

### 1.2 First-party native code

**VERIFIED FACT.** First-party Swift in the App target includes `AppDelegate.swift`, `SceneDelegate.swift`, and `WebAuthSessionPlugin.swift` (`ASWebAuthenticationSession` + `AppBridgeViewController` plugin registration).
Evidence: git tree `ios/App/App/*.swift` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** `ios/debug.xcconfig` sets `CAPACITOR_DEBUG = true` (Debug base config reference in pbxproj).
Evidence: `ios/debug.xcconfig` · `project.pbxproj` `baseConfigurationReference` @ BASE SHA · verified 2026-08-19.

### 1.3 Explicitly absent from native link evidence

**VERIFIED FACT.** There is no `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/geolocation`, `@capacitor/push-notifications`, or `@capacitor/browser` dependency in root `package.json`.
Evidence: git blob `package.json` `dependencies` @ BASE SHA · query: those package names absent · verified 2026-08-19.

**VERIFIED FACT.** `Package.swift` does not reference a Camera or Photos Capacitor plugin.
Evidence: git blob `ios/App/CapApp-SPM/Package.swift` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Transitive native libraries pulled by Capacitor/Cordova SPM into a Release archive (beyond the three declared packages). Inspect the archive / `Frameworks` folder; do not assume from npm lockfile.

---

## 2. Info.plist usage strings and capabilities

**VERIFIED FACT.** Declared usage description:

| Key | String |
| --- | ------ |
| `NSCameraUsageDescription` | `Refurb Genius uses the camera so you can photograph rooms and property details for refurbishment analysis.` |

Evidence: git blob `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** The following keys are **not** present in `ios/App/App/Info.plist`:

- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSLocationWhenInUseUsageDescription` / `NSLocationAlways*`
- `NSUserTrackingUsageDescription`
- `NSFaceIDUsageDescription`
- `ITSAppUsesNonExemptEncryption`
- `UIBackgroundModes`
- `NSAppTransportSecurity` (custom ATS exceptions)

Evidence: git blob `ios/App/App/Info.plist` @ BASE SHA · query: those keys absent · verified 2026-08-19.

**VERIFIED FACT.** `UIRequiredDeviceCapabilities` contains `armv7`. Orientations include portrait and landscape; iPad includes upside-down.
Evidence: same Info.plist @ BASE SHA · verified 2026-08-19.

**FUTURE REQUIREMENT.** App Store export-compliance / encryption declaration is not encoded in this Info.plist.
**PENDING VERIFICATION.** What App Store Connect currently has on file.

**PENDING VERIFICATION.** Merged Info.plist from SPM packages after `cap copy` / Xcode archive.

---

## 3. Camera and photos capabilities (product vs native plugin)

**VERIFIED FACT.** Upload UI uses HTML file inputs, not a Capacitor Camera plugin:

- camera control: `<input type="file" accept="image/*" capture="environment">`
- library control: `<input type="file" accept="image/*" multiple>`

Evidence: git blob `src/routes/_authed/projects.$id.upload.tsx` @ BASE SHA · query: `capture="environment"` · verified 2026-08-19.

**WATCH ITEM.** `docs/capacitor-ios.md` (dated May 17, 2026) lists “Camera/photo library plugins” as not included in Phase C. That is consistent with **no Capacitor Camera plugin**, but it is **stale** as a statement that the product does not use the camera: the web shell requests camera via `capture="environment"` and Info.plist has `NSCameraUsageDescription`.

**PENDING VERIFICATION.** On a physical iPhone WKWebView:

- whether `capture="environment"` shows the system camera and is covered solely by `NSCameraUsageDescription`;
- whether the library picker requires `NSPhotoLibraryUsageDescription` on the OS version under test (PHPicker vs older UIImagePicker behaviour).

Treat AC1-F02 as an observation, not a confirmed App Review rejection.

---

## 4. Analytics / telemetry SDKs

Classify by **where the SDK is imported**, not by assuming a native `.framework`.

### 4.1 PostHog (JS)

**VERIFIED FACT.** `posthog-js` / `@posthog/react` initialise in the **browser/WKWebView** platform module. Config includes `autocapture: false`, `persistence: "localStorage+cookie"`, `person_profiles: "identified_only"`, `capture_exceptions: true`, `before_send` sanitizer. Init requires `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`; otherwise init returns false. Default host fallback in source is `https://us.i.posthog.com` if `VITE_PUBLIC_POSTHOG_HOST` is unset.
Evidence: git blob `src/platform/posthog/browser.ts` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Whether iOS WKWebView builds ship a non-empty PostHog token (build-time env). Do not copy token values into this pack.

**PENDING VERIFICATION.** Apple ATT / “tracking” classification of this SDK on iOS.

There is **no** `NSUserTrackingUsageDescription` in Info.plist (**VERIFIED FACT**, §2).

### 4.2 Sentry (JS)

**VERIFIED FACT.** Browser Sentry (`@sentry/react`) initialises when `typeof window !== "undefined" && import.meta.env.PROD && dsn`. Integrations include `browserTracingIntegration` and `replayIntegration` with explicit privacy options; `sendDefaultPii: false`; sample rates traces 0.2, session replay 0.05, error replay 1.0.
Evidence: git blob `src/lib/sentry.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Node/server Sentry lives under `src/platform/sentry/server.init.ts` and is **not** the iOS archive SDK. iOS Vite entry `server.ios.ts` is documented as omitting Production server Sentry bootstrap.
Evidence: `vite.ios.config.ts` comment · `src/platform/sentry/server.init.ts` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Whether Production-mode iOS bundles include a Sentry DSN (`VITE_SENTRY_DSN`). Do not copy DSN values.

**PENDING VERIFICATION.** Whether Session Replay inside WKWebView is treated as tracking or requires additional Apple disclosures.

### 4.3 Apple JS SDK (web)

**VERIFIED FACT.** Optional load of `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js` when Apple client ID is configured.
Evidence: `src/platform/auth/apple-sign-in-config.ts` `APPLE_SIGN_IN_SDK_URL` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Whether that script is loaded in the native shell at runtime.

### 4.4 Not evidenced as native iOS SDKs

Do **not** list OpenAI, Hugging Face, Resend, or `@sentry/node` as **iOS** SDKs. They are server/npm dependencies. Transmission of user data to those processors is a **data-inventory** question (see `05-data-inventory.md`), not a native-link fact.

**VERIFIED FACT.** No App Tracking Transparency / `AppTrackingTransparency` import appears in `ios/**` Swift.
Evidence: grep `ios/` @ BASE SHA · verified 2026-08-19.

---

## 5. Privacy manifests

**VERIFIED FACT.** No `PrivacyInfo.xcprivacy` and no `*.xcprivacy` files exist in the repository tree.
Evidence: git tree search `*.xcprivacy` / `PrivacyInfo` @ BASE SHA · verified 2026-08-19.

**FUTURE REQUIREMENT.** Apple third-party SDK privacy-manifest rules for a submitted app. Capacitor / Secure Storage / any JS SDK that embeds native code may require manifests in the **archive**, even if this repo does not vendor them.

**PENDING VERIFICATION.** Whether Capacitor 8.3.4 or Aparajita Secure Storage ships a privacy manifest inside `node_modules` that Xcode copies (not searched into `node_modules` as product evidence in this pack).

---

## 6. URL types, associated domains, encryption

**VERIFIED FACT.** URL scheme `com.refurbgenius.app` (role Editor).
Evidence: `ios/App/App/Info.plist` `CFBundleURLTypes` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Associated Domains entitlement `applinks:www.refurbgenius.info`, documented in-file as scaffold / not operational.
Evidence: `ios/App/App/App.entitlements` @ BASE SHA · verified 2026-08-19.

**FUTURE REQUIREMENT / PENDING VERIFICATION.** `ITSAppUsesNonExemptEncryption` and App Store Connect export compliance.

---

## 7. Archive-only / App Store Connect unknowns

| Item | Label |
| ---- | ----- |
| Linked binary list in `App.app/Frameworks` | PENDING VERIFICATION |
| dSYM / bitcode / strip settings in Release | PENDING VERIFICATION |
| Privacy Nutrition Labels | FUTURE REQUIREMENT |
| Age rating questionnaire | FUTURE REQUIREMENT |
| Required device capabilities vs 64-bit-only App Store | PENDING VERIFICATION (`armv7` still listed) |
| Push / Background Modes (none declared) | VERIFIED FACT of absence in Info.plist; no further native push plugin evidenced |

---

## 8. Stale documentation (do not treat as current SDK list)

**WATCH ITEM.** `docs/capacitor-ios.md` “Current Constraints” still says no native authentication, no analytics SDKs, no camera/photo library plugins, App Store reserved for Phase E. Current tree has Keychain native auth, PostHog/Sentry JS in the web shell, `NSCameraUsageDescription`, and HTML camera capture. Use source + this inventory over that section.
