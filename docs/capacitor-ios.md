# Phase C: Capacitor iOS Setup

**Status:** Capacitor iOS wrapper configured, validated, and ready for local Xcode simulator testing.

**Date:** May 17, 2026

**Execution Status:**

- ✅ Build validation: PASS
- ✅ TypeScript strict mode: PASS
- ✅ Deal Copilot invariant protection: PASS
- ✅ Capacitor sync: PASS
- ✅ iOS project generated: PASS
- ⏳ Simulator test: Pending (requires local Xcode GUI)

---

## Purpose

Phase C adds a native iOS wrapper using Capacitor to the already mobile-ready Refurb Genius web application. This enables:

- Installation on iOS home screen via app store (future)
- Native app icon and splash screen
- Direct app access without browser UI
- Parity with Android wrapper (future phase)

This is a **narrow native wrapper only** — no app redesign, no new features, no product architecture changes.

---

## Current Constraints (Intentional Limitations)

The following are **NOT** included in Phase C:

- ❌ Push notifications
- ❌ Camera/photo library plugins
- ❌ Native authentication (continues to use Supabase web auth)
- ❌ Offline sync or background sync
- ❌ Background job processing
- ❌ Native-only business logic
- ❌ Analytics SDKs
- ❌ Android platform (reserved for Phase D)
- ❌ App Store submission (reserved for Phase E)

The app remains web-first with a native wrapper layer.

---

## Installation

### Prerequisites

- Node.js 24.x
- npm or pnpm
- Xcode 14+ (for local iOS development/signing)

### Install Capacitor and iOS Platform

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
```

### Initialize Capacitor Config

Config was generated during Phase C setup:

**File:** `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.refurbgenius.app",
  appName: "Refurb Genius",
  // iOS SPA shell from `pnpm build:ios` (vite.ios.config.ts).
  // Isolated from web SSR/Vercel client output under dist/client.
  webDir: "dist/ios/client",
  ios: {
    scheme: "dark",
  },
  // No server.url: local bundle only. Do not point Capacitor at Production.
};

export default config;
```

---

## Build & Sync Workflow

Capacitor iOS packaging uses a **separate** TanStack Start SPA build. It is **not** the normal web SSR/Vercel build.

The **authorised** packaging path is governed prepare (see [iOS build provenance](./ios-build-provenance.md)). A lone `pnpm build:ios` plus a later optional `cap sync` does **not** guarantee Xcode packages that bundle.

| Path | Role |
|------|------|
| `pnpm build` / `pnpm build:vercel` | Web SSR / Production Vercel — does **not** emit a Capacitor-ready `index.html` for the shell |
| `pnpm build:ios` | Lower-level iOS SPA shell (`vite.ios.config.ts`) → `dist/ios/client/`. Not certifiable alone. |
| `pnpm prepare:ios` | **Authorised:** validate origin + Supabase public runtime config + source SHA → Vite iOS (explicit child env) → provenance → `cap copy ios` → verify copied tree and no `server.url` |
| `pnpm exec cap sync ios` | Plugin / native-dependency update only. Not the authorised packaging path. |

### Authorised native prepare

```bash
VITE_PUBLIC_URL=https://www.refurbgenius.info \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios
```

Preview (explicit HTTPS origin required):

```bash
VITE_PUBLIC_URL=https://<preview-host>.vercel.app \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios
```

Output: `dist/ios/client/` including `ios-build-provenance.json`, copied to `ios/App/App/public/`, with a matching operator copy at `dist/ios/ios-build-provenance.json`.

### Lower-level Vite-only build (not authorised packaging)

```bash
pnpm build:ios
```

### Plugin update (not packaging)

```bash
pnpm exec cap sync ios
```

---

## iOS Project Structure

```
ios/
├── App/                                ← Xcode workspace
│   ├── App.xcworkspace/                ← Open in Xcode here
│   ├── App/
│   │   ├── AppDelegate.swift           ← Entry point
│   │   ├── Info.plist                  ← App metadata
│   │   ├── public/                     ← Web assets (auto-synced)
│   │   │   ├── index.html
│   │   │   ├── assets/                 ← JS, CSS bundles
│   │   │   ├── manifest.json
│   │   │   └── icon-192.svg
│   │   └── Base.lproj/
│   │       └── LaunchScreen.storyboard
│   └── capacitor-cordova-ios-plugins/  ← Plugin support (empty for Phase C)
└── capacitor.config.json               ← Copy of root config for iOS
```

---

## Local Development

### Open iOS Project in Xcode

```bash
npx cap open ios
```

If GUI is not available:

```
open ios/App/App.xcworkspace
```

### Build & Run in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select target: **App** (top-left dropdown)
3. Select simulator or connected device
4. Press **Play** (Cmd+R)

### Simulator Testing

**iPhone Simulator Steps:**

1. `npx cap open ios` (opens Xcode)
2. Choose simulator (e.g., iPhone 15 Pro)
3. Build and run (Cmd+R)
4. App launches in fullscreen (no browser UI)
5. Test all routes: `/` → `/deal-copilot` → `/dashboard` → `/trades` → etc.

**Expected Behavior:**

- App loads bundled web assets from the Capacitor `public/` copy of `dist/ios/client/`
- All routes render correctly (mobile-first layouts)
- Auth flow works (Supabase redirects during login)
- Financial calculations accurate (deterministic invariant)
- No console errors in Xcode debugger

### Hot Reload (Development)

For local iteration with the **bundled** shell (Production-safe path — no `server.url`):

```bash
# Authorised prepare, then open Xcode
VITE_PUBLIC_URL=https://www.refurbgenius.info \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios && pnpm exec cap open ios
```

Rebuild with `pnpm prepare:ios` after web/UI changes intended for the native shell. Do **not** set `server.url` to Production (remote createServerFn shortcut is out of scope and rejected for App Store packaging).

---

## Phase C Execution Test Results (May 17, 2026)

> **Historical log only.** The commands below record the original Phase C run. The **current authorised** Capacitor packaging path is `pnpm prepare:ios` (see [Build & Sync Workflow](#build--sync-workflow) and [iOS build provenance](./ios-build-provenance.md)).

### Pre-Simulator Validation ✅

All build and validation steps passed before simulator testing:

```text
✅ npm run typecheck          — PASS (TypeScript strict mode)
✅ npm run build              — PASS (9.84s, dist/client created)  [historical; superseded by pnpm build:ios for Capacitor]
✅ npx tsx scripts/validate-deal-copilot.ts  — PASS (5/11 tests, invariant protected)
✅ npx cap sync ios           — PASS (web assets synced to iOS project)
✅ npm run lint               — PASS (0 errors, 6 pre-existing warnings in UI)
```

### iOS Project Configuration ✅

Verified generated iOS project:

- Bundle ID: `com.refurbgenius.app` ✓
- App name: `Refurb Genius` ✓
- Web assets location: `ios/App/App/public/` ✓
- AppDelegate.swift: Correctly configured for Capacitor ✓
- Info.plist: No unauthorized permissions ✓
- Orientations: Portrait + Landscape ✓

### Web Assets Verification ✅

> **Current contract (IOS-READINESS-2A + IOS-BUILD-PROVENANCE-1):** Capacitor assets come from `pnpm prepare:ios` → `dist/ios/client/` (not the normal web `dist/client/` tree), then `cap copy ios`.

Confirmed shell assets present after `pnpm prepare:ios`:

- `dist/ios/client/index.html` — SPA shell entry point (genuine prerendered HTML)
- `dist/ios/client/manifest.json` — PWA metadata
- `dist/ios/client/icon-192.svg` — App icon
- `dist/ios/client/assets/` — Client JS/CSS bundles
- `dist/ios/client/ios-build-provenance.json` — source SHA, API origin, file hashes

Assets copied to: `ios/App/App/public/` via `cap copy ios` inside `pnpm prepare:ios`.

### Simulator Test Status

**Environment Limitation:** Terminal environment has Command Line Tools only (not full Xcode GUI).

**Impact:** Cannot launch simulator from terminal, but project is fully configured for local Xcode execution.

**Next Steps (For Local Xcode on macOS):**

```bash
# 1. Open Xcode
npx cap open ios

# 2. In Xcode:
#    - Select target: App
#    - Select simulator: iPhone 15 Pro
#    - Press Play (Cmd+R)

# 3. Expected behavior:
#    - Simulator launches
#    - App boots in fullscreen
#    - No browser chrome
#    - Login screen renders
```

---

**Phase C does NOT include App Store submission.** Local signing is optional for simulator testing.

### Automatic Signing (Recommended for Development)

In Xcode:

1. Select **App** target
2. Go to **Build Settings** → **Signing**
3. Check **Automatically manage signing**
4. Select your **Team**
5. Let Xcode create a development certificate

### Manual Signing (If Required)

1. Obtain Apple Developer Team ID
2. In Xcode, select target **App**
3. Set **Team ID** and **Bundle Identifier** → `com.refurbgenius.app`
4. Select a provisioning profile

**Note:** For TestFlight or App Store, see Phase E (App Store Submission).

---

## Configuration Files

### capacitor.config.ts (Root)

Defines Capacitor behavior for all platforms:

- `appId`: `com.refurbgenius.app`
- `appName`: `Refurb Genius`
- `webDir`: `dist/ios/client` (output of `pnpm build:ios` / `vite.ios.config.ts`)
- iOS preferences: dark scheme
- **No `server.url`** — ships the local SPA bundle only (do not remote-load Production)

### ios/App/App/capacitor.config.json

Auto-generated copy of root config. Updated by `cap copy ios` (inside `pnpm prepare:ios`). Must not contain `server.url`.

### ios/App/App/Info.plist

iOS-specific metadata:

- Display name: `Refurb Genius`
- Bundle identifier: `com.refurbgenius.app` (via Xcode)
- Supported orientations: portrait + landscape
- Custom URL scheme (2B-1): `com.refurbgenius.app` → callback `com.refurbgenius.app://auth/callback`
- No unnecessary permissions

### ios/App/App/App.entitlements

Associated Domains **scaffold** only (not Production-operational yet):

- `applinks:www.refurbgenius.info`

---

## IOS-READINESS-2B-1 — Auth return-channel foundation

**Status:** Scaffolding only. No OAuth initiation, no native Supabase session, no PKCE exchange.

### Frozen return surfaces

| Role | Surface | Canonical use |
|------|---------|----------------|
| Custom scheme | `com.refurbgenius.app://auth/callback` | OAuth via ASWebAuthenticationSession; sim/dev fallback |
| Universal Link | `https://www.refurbgenius.info/auth/native-callback` | Email magic-link / recovery return (Production when UL live) |

**Prohibited in ordinary deep-link query:** `access_token`, `refresh_token`.

### Dependencies (authorized)

| Package | Version constraint | Role |
|---------|-------------------|------|
| `@capacitor/app` | `^8` (major 8) | `appUrlOpen`, `getLaunchUrl` |
| `@aparajita/capacitor-secure-storage` | `8.0.0` exact | Keychain-backed storage plugin install only (no session write in 2B-1) |

**Do not install:** `@capacitor/browser`, third-party OAuth bridges. Browser/SFSafariViewController is **not** equivalent to ASWebAuthenticationSession.

### First-party ASWebAuthenticationSession plugin

- Native: `ios/App/App/WebAuthSessionPlugin.swift` (`jsName`: `WebAuthSession`)
- JS: `src/platform/auth/native/web-auth-session.ts`
- API: `openAuthSession({ url, callbackScheme })` → `{ type: "success" \| "cancel", url? }`
- Callback scheme: `com.refurbgenius.app`
- Cancellation is non-exceptional (`type: "cancel"`)
- Registered via `AppBridgeViewController` (storyboard host) — Capacitor 8 local-plugin pattern

### Inbound URL lifecycle (inert)

- JS: `src/platform/auth/native/auth-return.ts`
- Mounted from `src/routes/__root.tsx` (root client lifecycle, not AuthExperience)
- Accepts only the two frozen surfaces above; ignores unrelated URLs
- No query/fragment logging; no exchange

### AASA (ops prerequisite — not published by this phase)

Intended Production `apple-app-site-association` (owner ops; **do not** ship a fake incomplete file):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.refurbgenius.app",
        "paths": ["/auth/native-callback", "/auth/native-callback/*"]
      }
    ]
  }
}
```

- Host: `www.refurbgenius.info`
- Path: `/auth/native-callback`
- `TEAMID` must be the real Apple Developer Team ID (never fabricate)
- Publish at `https://www.refurbgenius.info/.well-known/apple-app-site-association` (and/or root)
- **Universal Links are not claimed operational** until portal capability + AASA + signed build with Associated Domains are all true

### Apple Developer / portal prerequisites (ops — not mutated here)

1. Enable **Associated Domains** capability on App ID `com.refurbgenius.app`
2. Provisioning profile includes Associated Domains
3. Publish AASA with real `TEAMID.com.refurbgenius.app`
4. Supabase Auth redirect allowlist updates are **out of 2B-1** (later slice)

### Secure storage (2B-1 scope)

- Plugin installed and synced for native registration proof only
- **No** Supabase session keys written yet
- Do not use Preferences / UserDefaults / localStorage for refresh tokens (2B contract)

### 2A non-regression (must remain true)

- `webDir` = `dist/ios/client`
- No `server.url`
- `vite.ios.config.ts` / `src/server.ios.ts` unchanged
- Production CSRF / `pip-auth` / web auth unchanged (no `capacitor://` CSRF exception)

---

## App Capabilities & Permissions

### Current (Phase C)

- ✅ Web view rendering
- ✅ Route navigation (TanStack Router)
- ✅ Supabase auth (web-based redirects)
- ✅ Touchscreen interaction
- ✅ Keyboard input
- ✅ Network requests (CORS-enabled)
- ✅ PWA manifest
- ✅ App icon + splash screen

### Future Phases

- ❌ Camera (Phase F: Photo Analysis)
- ❌ Photo library access (Phase F: Photo Analysis)
- ❌ Push notifications (Phase G: Mobile Notifications)
- ❌ Face ID / biometric auth (Phase H: Secure Auth)

---

## Known Limitations

### SSR Architecture

Refurb Genius web Production remains Vite + TanStack Start SSR/Nitro (Vercel). Capacitor does **not** use that SSR client tree for packaging. The iOS shell is built with `pnpm prepare:ios` (TanStack Start SPA mode via `build:ios`) into `dist/ios/client/`, then copied into the native project by `cap copy ios` and verified. Runtime data still depends on network APIs; there is no offline-first mobile API boundary yet.

**Development Mode (bundled SPA shell — current):**

```text
pnpm prepare:ios
        │
        ↓
 dist/ios/client/   (prerendered index.html + assets + provenance)
        │
        ↓  cap copy ios  (inside prepare)
 ios/App/App/public/  (verified copy of the same files)
        │
        ↓  Xcode / Simulator
 iOS Simulator loads the local bundle (no server.url)
```

Do **not** point Capacitor at `http://localhost:3000` or Production via `server.url` for packaging. Re-run `pnpm prepare:ios` after web/UI changes intended for the native shell.

**Production Mode (Future):**

```
┌─────────────────┐
│  iOS App Store  │
│  (Capacitor)    │
└────────┬────────┘
         │ HTTPS requests to api.refurb-genius.app
         ↓
    ┌─────────────────┐
    │  Vercel (Nitro) │
    │  Serverless     │
    └────┬────────────┘
         │ SQL queries
         ↓
    ┌──────────────┐
    │  Supabase    │
    │  (RLS auth)  │
    └──────────────┘
```

### Offline Support

Phase C provides **no offline functionality**. All data loads from backend on startup. Future phases may add local caching.

### Background Execution

Phase C provides **no background task support**. App pauses when backgrounded. Future phases may add background sync.

---

## TestFlight Preparation (Phase E)

Before App Store submission:

1. Update version number in Xcode: `Product` → `Scheme` → `Edit Scheme` → `Info` tab
2. Create App Store Connect record for bundle ID `com.refurbgenius.app`
3. Configure app metadata (description, screenshots, keywords)
4. Set up privacy policy URL (already at https://refurb-genius.app/privacy)
5. Obtain Apple Developer Program membership
6. Create signing certificate & provisioning profile
7. Archive app: `Product` → `Archive`
8. Distribute to TestFlight

(Detailed TestFlight workflow in Phase E docs.)

---

## App Store Submission Checklist (Phase E — Not Yet)

- [ ] Privacy policy compliant with iOS requirements
- [ ] Terms of service included
- [ ] App screenshots captured (iPhone + iPad)
- [ ] App preview video (optional)
- [ ] Localization (en-US minimum)
- [ ] Content rating questionnaire completed
- [ ] Export compliance review (encryption/export control)
- [ ] Pricing tier selected
- [ ] Bundle ID registered in Apple Developer
- [ ] Provisioning profile + signing certificate active
- [ ] App reviewed and approved by Apple App Review

(Moved to Phase E — not in scope for Phase C.)

---

## Development Workflows

### Web-Only Development (Fastest)

```bash
npm run dev
# Opens http://localhost:3000
# Hot reload for all changes
```

### iOS-Focused Development

```bash
VITE_PUBLIC_URL=https://www.refurbgenius.info \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios && pnpm exec cap open ios
# Authorised iOS prepare → dist/ios/client/ + verified ios/App/App/public/
# Open in Xcode for debugging
```

### Full Workflow (Web + iOS)

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: iOS project
npx cap open ios
# Xcode opens, select simulator, press Play (Cmd+R)
```

---

## Troubleshooting

### "Web assets directory not found"

**Cause:** `pnpm build:ios` failed or `dist/ios/client/` missing. Normal `pnpm build` does **not** produce the Capacitor shell `index.html`.

**Fix:**

```bash
VITE_PUBLIC_URL=https://www.refurbgenius.info \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios
ls dist/ios/client/index.html  # Should exist
ls ios/App/App/public/ios-build-provenance.json
```

### "Bundle identifier mismatch"

**Cause:** Xcode project bundle ID ≠ `com.refurbgenius.app`.

**Fix:**

1. Open Xcode
2. Select **App** target
3. Go to **Build Settings**
4. Search for `PRODUCT_BUNDLE_IDENTIFIER`
5. Set to `com.refurbgenius.app`

### "App crashes on startup in simulator"

**Cause:** Web assets not synced (or shell not rebuilt after UI changes).

**Fix:**

```bash
VITE_PUBLIC_URL=https://www.refurbgenius.info \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios
# Check Xcode console for errors (Window → Devices and Simulators)
```

### "Auth redirects to wrong URL"

**Cause:** Supabase redirect URL not configured for `capacitor://localhost`.

**Fix:** (In production, configure Supabase redirect URLs in console; for dev, Capacitor handles this.)

---

## Next Phases

### Phase D: Android Wrapper

- Install `@capacitor/android`
- Mirror iOS setup for Android
- Target Google Play Store

### Phase E: App Store Submission

- Configure TestFlight distribution
- Prepare App Store metadata
- Submit for Apple App Review
- Handle review feedback

### Phase F: Photo Analysis Features

- Add camera plugin: `@capacitor/camera`
- Add photo processing: Capacitor Camera API
- Maintain deterministic financial invariant

### Phase G: Push Notifications

- Add push plugin: `@capacitor/push-notifications`
- Server-side notification queue (Nitro)
- Opt-in user preferences

---

## Reference

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Xcode Signing Guide:** https://developer.apple.com/support/xcode/
- **Refurb Genius Architecture:** `docs/architecture/overview.md`
- **Mobile Readiness:** `docs/mobile-readiness.md`
- **Financial Invariant:** `docs/invariant-protection-report.md`

---

**Phase C Complete.** Ready for Phase D (Android) or Phase E (App Store submission).
