# Technical baseline (Apple-relevant)

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**BASE SHA:** `b5999318375d087c1469dd7f1f0b6e1bfcdc0588`
**Verified:** 2026-08-19
**Scope:** Application architecture that matters for an eventual iOS submission.
**Not:** readiness declaration or runtime proof of a shipped IPA.

---

## 1. Product and repository

**VERIFIED FACT.** The repository is a pnpm workspace hosting a single TanStack Start application under `src/`, not an `apps/*` multi-app monorepo.
Evidence: committed doc `docs/architecture/overview.md` §1 · git tree @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Root `package.json` name is `tanstack_start_ts`, `private: true`. There is no npm `version` field.
Evidence: git blob `package.json` @ BASE SHA · query: `"name"`, absence of `"version"` · verified 2026-08-19.

**VERIFIED FACT.** Declared stack in programme docs: TanStack Start (React 19), Vite 7 + Nitro, TypeScript, Tailwind v4, Supabase, OpenAI via server paths, Vercel deploy, Sentry, pnpm + Turbo.
Evidence: `AGENTS.md` “Tech Stack” table @ BASE SHA · verified 2026-08-19.

**WATCH ITEM.** `AGENTS.md` AI row still says “OpenAI Vision (gpt-4o) via `createServerFn`”. Native Analysis now also uses Bearer `POST /api/mobile/v1/analysis/run`. Treat the table as incomplete, not as exclusive transport.

---

## 2. Web vs native / Capacitor boundary

**VERIFIED FACT.** Capacitor wraps a locally bundled iOS SPA. Config:

| Key | Value |
| --- | ----- |
| `appId` | `com.refurbgenius.app` |
| `appName` | `Refurb Genius` |
| `webDir` | `dist/ios/client` |
| `ios.scheme` | `dark` |

`capacitor.config.ts` states there is **no** `server.url` (local bundle only; do not point Capacitor at Production).
Evidence: git blob `capacitor.config.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** iOS packaging is a separate Vite config (`vite.ios.config.ts`) from Vercel (`vite.vercel.config.ts`). The iOS build uses TanStack Start SPA prerender (`spa.enabled`, `outputPath: "/index"`) and a dedicated server entry `src/server.ios.ts`, explicitly not Production `src/server.ts`.
Evidence: git blob `vite.ios.config.ts` @ BASE SHA · query: `entry: "./server.ios.ts"`, `spa` · verified 2026-08-19.

**VERIFIED FACT.** Scripts: `build:ios`, `prepare:ios`, `ios:verify-copied`, `ios:verify-app-bundle`, `test:ios-provenance`.
Evidence: git blob `package.json` `scripts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Native platform detection uses Capacitor (`Capacitor.isNativePlatform()`), including photo-write client selection.
Evidence: git blob `src/lib/photos-write.ts` @ BASE SHA · query: `Capacitor.isNativePlatform` · verified 2026-08-19.

**PENDING VERIFICATION.** Whether a given physical install was produced by `pnpm prepare:ios` at this SHA (provenance JSON on device / App.app). This tree does not contain a certified archive.

---

## 3. iOS bundle and build provenance

**VERIFIED FACT.** Governed native prepare is documented as:

```text
explicit source SHA
  → explicit API origin (VITE_PUBLIC_URL, HTTPS)
  → explicit Supabase public runtime config
  → Vite iOS build (explicit child env)
  → provenance generation
  → cap copy ios (not cap sync)
  → copied-bundle verification
```

Certification identity is documented as `HEAD SHA + bundle fingerprint + effective API origin + Supabase URL + public-key SHA-256`. Raw keys must not be stored in provenance.
Evidence: committed doc `docs/ios-build-provenance.md` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** `prepare:ios` is required to fail closed on `VITE_SUPABASE_SERVICE_ROLE_KEY` as a selected key, missing HTTPS origin, dirty tree, and unmapped authority chunks.
Evidence: `docs/ios-build-provenance.md` + `scripts/lib/ios-build-provenance.test.mjs` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Xcode project identifiers (Debug and Release App target):

| Setting | Value |
| ------- | ----- |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.refurbgenius.app` |
| `MARKETING_VERSION` | `1.0` |
| `CURRENT_PROJECT_VERSION` | `1` |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.0` |
| `CODE_SIGN_STYLE` | `Automatic` |
| `CODE_SIGN_IDENTITY` | `iPhone Developer` |
| `CODE_SIGN_ENTITLEMENTS` | `App/App.entitlements` |
| `TARGETED_DEVICE_FAMILY` | `1,2` (iPhone + iPad) |
| `INFOPLIST_FILE` | `App/Info.plist` |

Evidence: git blob `ios/App/App.xcodeproj/project.pbxproj` @ BASE SHA · query: those keys · verified 2026-08-19.

**PENDING VERIFICATION.** `DEVELOPMENT_TEAM` is not present in `project.pbxproj`. Actual signing team is archive/local-Xcode state.

**WATCH ITEM.** Marketing/build numbers `1.0` / `1` are repository defaults, not evidence of an App Store version.

**VERIFIED FACT.** Info.plist display name is `Refurb Genius`; bundle identifier/version are Xcode variable substitutions.
Evidence: git blob `ios/App/App/Info.plist` @ BASE SHA · verified 2026-08-19.

---

## 4. Authentication and runtime service boundaries

**VERIFIED FACT.** Web authenticated server functions use cookie/pip-auth (`createServerSupabase` + cookie name `pip-auth`). Native must not be assumed to share that cookie jar.
Evidence: `AGENTS.md` “Critical Rules” item 2 · `packages/supabase/src/browser.ts` comment · BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Native Supabase client `getNativeSupabase()`:

- throws unless `Capacitor.isNativePlatform()`;
- uses PKCE, `detectSessionInUrl: false`, `persistSession: true`, `autoRefreshToken: false`;
- storage key `rg-native-auth`;
- storage adapter `createNativeAuthSecureStorage()` (`@aparajita/capacitor-secure-storage`).

Evidence: git blob `src/platform/supabase/native.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** First-party Capacitor plugin `WebAuthSessionPlugin` opens `ASWebAuthenticationSession` for `https` URLs only, callback scheme exactly `com.refurbgenius.app`, and does not implement token exchange.
Evidence: git blob `ios/App/App/WebAuthSessionPlugin.swift` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Custom URL scheme `com.refurbgenius.app` is declared; comment states canonical OAuth callback `com.refurbgenius.app://auth/callback` and forbids designing access/refresh tokens into that URL.
Evidence: git blob `ios/App/App/Info.plist` `CFBundleURLTypes` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Mobile HTTP API namespace is `/api/mobile/v1/*`. In-tree handlers:

| Path | Role |
| ---- | ---- |
| `POST /api/mobile/v1/session/ping` | Session canary |
| `POST /api/mobile/v1/analysis/run` | Native photo analysis (Bearer) |
| `POST /api/mobile/v1/redesign/generate` | Native redesign generate (Bearer) |

Evidence: git blob `src/platform/http/mobile-api.server.ts` @ BASE SHA · query: `MOBILE_*_PATHNAME` · verified 2026-08-19.

**VERIFIED FACT.** Native Analysis provider comment: web uses cookie serverFn; native uses Bearer `/api/mobile/v1/analysis/run`; OpenAI stays server-side.
Evidence: `src/features/ai-upload/presentation/photo-analysis.provider.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Apple Sign In **browser JS SDK** helpers exist (`VITE_APPLE_CLIENT_ID` → meta tags + `appleid.auth.js`). Separate from “Supabase OAuth provider apple”. Unconfigured client ID emits no Apple meta.
Evidence: `src/platform/auth/apple-sign-in-config.ts` · `src/routes/__root.tsx` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Whether Production/native builds have `VITE_APPLE_CLIENT_ID` set; whether native sign-in uses ASWebAuthenticationSession + Supabase OAuth, the Apple JS SDK inside WKWebView, or a native Sign in with Apple entitlement. No Sign in with Apple entitlement appears in `App.entitlements`.

**VERIFIED FACT.** Account deletion UI calls `deleteAccountServerFn` (cookie `createServerFn`), which requires server `SUPABASE_SERVICE_ROLE_KEY` and deletes `profiles` then `auth.admin.deleteUser`.
Evidence: `src/serverFns/auth.ts` · `src/routes/_authed/settings.tsx` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Native in-app account deletion success (serverFn/cookie vs Keychain session).

---

## 5. Backend, storage, and API dependencies

**VERIFIED FACT.** Backend is Supabase (Postgres, Auth, Storage). Production project hard-gate documented as `sxhzjmzfkgbogmlsbeju`. Preview refs are not Production.
Evidence: `AGENTS.md` Model B section @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Production web origin used in code defaults / comments: `https://www.refurbgenius.info`.
Evidence: `src/routes/__root.tsx` · `src/platform/http/native-authenticated-fetch.test.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Authenticated project photos use bucket id `project-photos`. Latest committed migration sets `storage.buckets.public = false` for that id.
Evidence: `src/lib/photos-write.ts` `PROJECT_PHOTOS_BUCKET` · migration `supabase/migrations/20260816155524_project_photos_private.sql` @ BASE SHA · verified 2026-08-19.

**WATCH ITEM.** Earlier migrations created / re-asserted the bucket as public. Historical Production apply state is Model B / live-DB **PENDING VERIFICATION**. The **repository latest** migration intends private.

**VERIFIED FACT.** Other inventoried buckets: `floorplans` (private), `pitch-decks` (private), `gallery` (public read).
Evidence: invariant config `tests/invariants/config/data/storage.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Display signed URL TTL is 900 seconds; AI retrieval signed URL TTL is 300 seconds.
Evidence: `src/features/ai-upload/presentation/projectPhotoDisplay.ts` `SIGNED_URL_TTL_SECONDS = 900` · `src/features/ai-upload/infrastructure/resolveAuthorizedPhotos.server.ts` `AI_SIGNED_URL_TTL_SECONDS = 300` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Hosting/deploy path for web is Vercel (`build:vercel`, Nitro vercel preset).
Evidence: `package.json` · `AGENTS.md` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Server-side OpenAI is gated on `process.env.OPENAI_API_KEY` in analysis/redesign/estimate adapters (`*.server.ts`).
Evidence: e.g. `src/features/ai-upload/infrastructure/adapters/ai-vision.adapter.server.ts` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Hugging Face Inference is a **server-only** platform module (`src/platform/huggingface/server.ts`); used from `hf-vision.adapter.server.ts`. Comment forbids browser entry / API key in the client bundle.
Evidence: those files @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Whether Production currently routes any live user photo through Hugging Face versus OpenAI (adapter presence ≠ live routing).

**VERIFIED FACT.** Transactional email wrapper is server-only Resend (`src/lib/email.ts`, `RESEND_API_KEY`, from `notifications@mail.refurbgenius.info`).
Evidence: git blob `src/lib/email.ts` @ BASE SHA · verified 2026-08-19.

---

## 6. Associated domains / Universal Links

**VERIFIED FACT.** `App.entitlements` includes `applinks:www.refurbgenius.info` and states Universal Links are **not operational** until Apple Developer Associated Domains, a published AASA with real Team ID, and signing include the entitlement.
Evidence: git blob `ios/App/App/App.entitlements` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** No `apple-app-site-association` file exists under `public/`.
Evidence: git tree `public/` @ BASE SHA · verified 2026-08-19.

**PENDING VERIFICATION.** Production HTTPS AASA publication and Team ID.

---

## 7. Unresolved baseline evidence

| Topic | Label |
| ----- | ----- |
| Installed App.app / IPA equals this SHA | PENDING VERIFICATION |
| Apple Team ID / provisioning | PENDING VERIFICATION |
| App Store Connect app record | PENDING VERIFICATION |
| Live Production `project-photos` public flag | PENDING VERIFICATION (Model B) |
| Native cookie serverFn behaviour | PENDING VERIFICATION |
| Effective Info.plist after SPM embed | PENDING VERIFICATION |
| `docs/capacitor-ios.md` “ready for simulator” vs current 2B/2C native auth | WATCH ITEM (stale narrative) |
