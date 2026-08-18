# iOS build provenance (IOS-BUILD-PROVENANCE-1)

**Status:** In force for any native iOS bundle that will be packaged, installed, or physically tested.

## Why this exists

`pnpm build:ios` writes `dist/ios/client/`. Xcode packages `ios/App/App/public/`. Those trees are only the same after Capacitor copies the webDir.

A separate `pnpm exec cap sync ios` is easy to skip. When it is skipped, Xcode can ship a stale web bundle while the operator believes they certified the current source SHA.

`VITE_PUBLIC_URL` is a **build-time** input. Vite inlines it. The same Git SHA can therefore bake Production, a Preview host, or an unset origin depending on the environment. Runtime `resolveProductionApiOrigin()` is too late to stop packaging.

## Authorised chain

```text
explicit source SHA
  → explicit API origin
  → input validation
  → Vite iOS build (explicit child env)
  → provenance generation
  → cap copy ios
  → deterministic copied-bundle verification
  → (later) Xcode
  → pnpm ios:verify-app-bundle -- --app <App.app>
  → (later, separate authority) physical test
```

## Authorised command

Production:

```bash
VITE_PUBLIC_URL=https://www.refurbgenius.info pnpm prepare:ios
```

Explicit HTTPS Preview (authorised pre-merge mobile testing):

```bash
VITE_PUBLIC_URL=https://<preview-host>.vercel.app pnpm prepare:ios
```

`prepare:ios` is atomic from the operator's perspective. It:

1. Validates and **normalizes** process-env `VITE_PUBLIC_URL` (HTTPS origin only).
2. Reads `git rev-parse HEAD` and fails if the SHA is not a full 40-character hex.
3. Fails if there are tracked modifications or non-ignored untracked source files. Ignored generated outputs (`dist/`, `ios/App/App/public/`, generated `capacitor.config.json`) do not themselves block preparation.
4. Spawns `pnpm build:ios` with an **explicit child environment** whose `VITE_PUBLIC_URL` is the normalized origin. It does not mutate the parent process/shell env.
5. Writes `ios-build-provenance.json` after Vite (`emptyOutDir` would wipe a pre-build file) to:
   - `dist/ios/client/ios-build-provenance.json` (packaged with the webDir)
   - `dist/ios/ios-build-provenance.json` (operator expected copy)
6. Runs `pnpm exec cap copy ios` (not `cap sync`).
7. Verifies `ios/App/App/public` against the SHA-256 file map.
8. Fails if generated `ios/App/App/capacitor.config.json` contains `server.url`.

Certification identity is:

```text
HEAD SHA + bundle fingerprint + effective API origin
```

## Commands

| Script | Role |
|--------|------|
| `pnpm prepare:ios` | Authorised prepare (build + copy + verify) |
| `pnpm ios:verify-copied` | Re-check `dist/ios/client` vs `ios/App/App/public` + no `server.url` |
| `pnpm ios:verify-app-bundle -- --app /path/to/App.app` | Check a **local packaged `App.app`** + no `server.url` |
| `pnpm test:ios-provenance` | Focused unit tests |
| `pnpm build:ios` | Lower-level Vite only — **not** certifiable alone |

`ios:verify-app-bundle` does **not** certify what is installed or running on a physical iPhone. IPA support is out of this slice.

`cap sync ios` remains the plugin / native-dependency update tool. It is not the authorised packaging path.

## Origin fail-fast

Governed input is **only** `process.env.VITE_PUBLIC_URL`. `.env*` files are not the governed source.

| Input | Result |
|-------|--------|
| missing / blank / whitespace | fail `origin_missing` before Vite |
| malformed URL | fail `origin_invalid` |
| `http://…` | fail `origin_not_https` |
| userinfo / credentials | fail `origin_invalid` |
| `https://www.refurbgenius.info` | pass; store `url.origin` |
| explicit HTTPS Preview host | pass; no Production-only hostname allowlist |

Manifest `apiOrigin` must equal exactly that normalized value.

## Provenance schema

File: `ios-build-provenance.json`

```json
{
  "schemaVersion": 1,
  "sourceSha": "<full git sha>",
  "apiOrigin": "https://www.refurbgenius.info",
  "buildIdentity": "ios-capacitor-spa",
  "buildMode": "production",
  "viteConfig": "vite.ios.config.ts",
  "webDir": "dist/ios/client",
  "nativePublicDir": "ios/App/App/public",
  "files": {
    "index.html": "<sha256>",
    "assets/…": "<sha256>"
  },
  "bundleFingerprint": "<sha256>"
}
```

Rules:

- Files are hashed as raw bytes (SHA-256).
- `files` and `bundleFingerprint` cover the Vite webDir **excluding** `ios-build-provenance.json` (no self-hash).
- `bundleFingerprint` is SHA-256 of the canonical JSON of `{ schemaVersion, sourceSha, apiOrigin, buildIdentity, buildMode, files }`.
- Timestamps are not authority and are not present.
- No env dumps, tokens, keys, or `service_role`.

Capacitor extras allowed in `ios/App/App/public` after copy, and not part of the fingerprint:

- `cordova.js`
- `cordova_plugins.js`

Any other extra hashed web asset fails as `stale_native_assets`.

## `server.url`

Do not add `server.url` to `capacitor.config.ts`.

After `cap copy ios`, generated `ios/App/App/capacitor.config.json` is inspected. If `server.url` exists, prepare fails.

`ios:verify-app-bundle` inspects `App.app/capacitor.config.json` the same way.

## Future physical certification (not this slice)

Record separately from the provenance file (the file remains the authority for SHA / origin / fingerprint):

- Xcode version
- exact Xcode build number
- SDK version
- device iOS version
- source SHA
- provenance `bundleFingerprint`
- effective API origin

Xcode 27 beta 5 is the current device-testing lane. It is **not** the canonical TestFlight / release toolchain.

## What this slice does not do

- No forensic worktree-name hardcoding
- No IPA verification
- No signing / `DEVELOPMENT_TEAM` / `ios/**` project edits
- No `origin.ts` or `capacitor.config.ts` or `vite.ios.config.ts` changes
- No Production / TestFlight / physical-device certification
