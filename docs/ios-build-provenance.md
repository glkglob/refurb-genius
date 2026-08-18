# iOS build provenance (IOS-BUILD-PROVENANCE-1)

**Status:** In force for any native iOS bundle that will be packaged, installed, or physically tested.

## Why this exists

`pnpm build:ios` writes `dist/ios/client/`. Xcode packages `ios/App/App/public/`. Those trees are only the same after Capacitor copies the webDir.

A separate `pnpm exec cap sync ios` is easy to skip. When it is skipped, Xcode can ship a stale web bundle while the operator believes they certified the current source SHA.

`VITE_PUBLIC_URL` is a **build-time** input. Vite inlines it. The same Git SHA can therefore bake Production, a Preview host, or an unset origin depending on the environment. Runtime `resolveProductionApiOrigin()` is too late to stop packaging.

Native auth and data also require build-time Supabase public client configuration. `packages/supabase/src/env.ts` reads `import.meta.env.VITE_SUPABASE_URL` and a public client key. A provenance-PASS bundle can still fail Google auth at runtime if those values were never supplied. Governed prepare therefore requires them **before Vite**, proves they were baked into the packaged client, and records only a non-secret runtime identity.

## Authorised chain

```text
explicit source SHA
  → explicit API origin
  → explicit Supabase public runtime config
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
VITE_PUBLIC_URL=https://www.refurbgenius.info \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios
```

`VITE_SUPABASE_PUBLISHABLE_KEY` is accepted as an input alias when the anon key is absent, or when both are present and equal. The child environment always exposes the selected value as `VITE_SUPABASE_ANON_KEY`. The unused names `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_SERVICE_ROLE_KEY` are set to empty strings (not deleted) so Vite process-env precedence suppresses ignored `.env*` values of the same name.

Explicit HTTPS Preview (authorised pre-merge mobile testing):

```bash
VITE_PUBLIC_URL=https://<preview-host>.vercel.app \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<public-client-key> \
pnpm prepare:ios
```

`prepare:ios` is atomic from the operator's perspective. It:

1. Validates and **normalizes** process-env `VITE_PUBLIC_URL` (HTTPS origin only).
2. Validates process-env `VITE_SUPABASE_URL` (HTTPS origin only) and exactly one public client key from `VITE_SUPABASE_ANON_KEY` and/or `VITE_SUPABASE_PUBLISHABLE_KEY`. Missing/blank URL, non-HTTPS URL, missing/blank key, conflicting keys, a `service_role` / secret-form selected key, or `VITE_SUPABASE_SERVICE_ROLE_KEY` fail before Vite. `SUPABASE_SERVICE_ROLE_KEY` is never a fallback. `.env*` files are not certification authority.
3. Reads `git rev-parse HEAD` and fails if the SHA is not a full 40-character hex.
4. Fails if there are tracked modifications or non-ignored untracked source files. Ignored generated outputs (`dist/`, `ios/App/App/public/`, generated `capacitor.config.json`) do not themselves block preparation.
5. Spawns `scripts/run-ios-vite-build.mjs` with an **explicit child environment** whose `VITE_PUBLIC_URL` is the normalized API origin, `VITE_SUPABASE_URL` is the normalized Supabase URL, and `VITE_SUPABASE_ANON_KEY` is the selected public key. `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_SERVICE_ROLE_KEY` are empty-string tombstones on the child so Vite cannot refill them from ignored dotenv files. The runner also applies those tombstones to its own `process.env` before `createBuilder`. The runner deletes this worktree's `dist/ios`, then uses Vite's public environment-aware API: `createBuilder({ configFile: vite.ios.config.ts })` followed by `await builder.buildApp()`. That is what runs TanStack Start's client and server environments and the post-build SPA prerender that writes `dist/ios/client/index.html`. Legacy Vite `build()` is not a governed iOS success path.
6. During `generateBundle`, a capture plugin records origin-module and Supabase-module chunks in state isolated per actual `this.environment`. A matching environment must have `environment.config.consumer === "client"` **and** an exact resolved `environment.config.build.outDir` equal to the packaged client root (`dist/ios/client`). Origin (`src/platform/http/origin.ts`) and Supabase (`packages/supabase/src/env.ts`) are selected independently. After deduplication by emitted `fileName`: 0 matches fail `origin_module_unmapped` / `supabase_module_unmapped`; more than one fail `origin_authority_ambiguous` / `supabase_authority_ambiguous`. The two modules may legitimately land in the same emitted file. Each selected chunk is independently re-read from disk. The origin chunk must contain the exact normalized `apiOrigin`. The Supabase chunk must contain the normalized `supabaseUrl` **and** the exact selected public key. Only then is the temporary Rollup sidecar written. The sidecar is handoff evidence, not certification authority, and never stores the raw key. `process.exit(0)` happens only after those writes.
7. A resolved `buildApp()` plus runner exit 0 is the only Vite success event. SIGTERM, SIGKILL, timeout, crash without an exit code, external/unexpected signals, nonzero exit, and `buildApp()` rejection are always FAIL. File presence cannot upgrade those outcomes.
8. After runner exit 0: validate the sidecar (`schemaVersion === 2`, both module names, baked flags, safe relative authority paths), HTML local-reference completeness, re-check of the mapped origin chunk for `apiOrigin`, re-check of the mapped Supabase chunk for URL **and** the exact selected public key, then write schema v3 `ios-build-provenance.json` (includes `originAuthorityChunk`, `supabaseUrl`, `supabasePublicKeySha256`, and `supabaseAuthorityChunk` in the fingerprint; those chunks must exist in `files`) to:
   - `dist/ios/client/ios-build-provenance.json`
   - `dist/ios/ios-build-provenance.json`
9. Runs `pnpm exec cap copy ios` (not `cap sync`).
10. Verifies `ios/App/App/public` against the SHA-256 file map, HTML refs, authority-chunk origin, stored Supabase URL in the certified Supabase authority bytes, and no `server.url`. Copied/App verification does **not** re-require process env or the raw public key. The key remains bound by the prepare-time bake proof plus exact certified authority-chunk bytes.

Certification identity is:

```text
HEAD SHA + bundle fingerprint + effective API origin + Supabase URL + public-key SHA-256
```

## Commands

| Script                                                 | Role                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm prepare:ios`                                     | Authorised prepare (build + copy + verify)                           |
| `pnpm ios:verify-copied`                               | Re-check `dist/ios/client` vs `ios/App/App/public` + no `server.url` |
| `pnpm ios:verify-app-bundle -- --app /path/to/App.app` | Check a **local packaged `App.app`** + no `server.url`               |
| `pnpm test:ios-provenance`                             | Focused unit tests                                                   |
| `pnpm build:ios`                                       | Lower-level Vite only — **not** certifiable alone                    |

`ios:verify-app-bundle` does **not** certify what is installed or running on a physical iPhone. IPA support is out of this slice. A leftover bare `--` forwarded by pnpm is ignored so the documented `-- --app` form works.

`cap sync ios` remains the plugin / native-dependency update tool. It is not the authorised packaging path.

## Origin fail-fast

Governed input is **only** `process.env.VITE_PUBLIC_URL`. `.env*` files are not the governed source.

| Input                           | Result                                      |
| ------------------------------- | ------------------------------------------- |
| missing / blank / whitespace    | fail `origin_missing` before Vite           |
| malformed URL                   | fail `origin_invalid`                       |
| `http://…`                      | fail `origin_not_https`                     |
| userinfo / credentials          | fail `origin_invalid`                       |
| `https://www.refurbgenius.info` | pass; store `url.origin`                    |
| explicit HTTPS Preview host     | pass; no Production-only hostname allowlist |

Manifest `apiOrigin` must equal exactly that normalized value.

## Supabase fail-fast

Governed inputs are **only** process-environment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` and/or `VITE_SUPABASE_PUBLISHABLE_KEY`

| Input | Result |
| ----- | ------ |
| missing / blank URL | fail `supabase_url_missing` before Vite |
| malformed URL | fail `supabase_url_invalid` |
| `http://…` | fail `supabase_url_not_https` |
| missing / blank both public keys | fail `supabase_key_missing` |
| both public keys present and unequal | fail `supabase_key_conflict` |
| both public keys present and equal | pass; one selected value |
| selected key contains `service_role` or `sb_secret_` | fail `supabase_key_forbidden` |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` set | fail `supabase_service_role_forbidden` |
| `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_*` / unprefixed names only | not certification authority |

The raw selected public key is proven present in the emitted Supabase authority chunk during prepare. Provenance stores only `supabaseUrl` and `SHA-256(selected public key)`. It does not store the raw key or the input alias (`anon` vs `publishable`).

## Provenance schema

File: `ios-build-provenance.json`

```json
{
  "schemaVersion": 3,
  "sourceSha": "<full git sha>",
  "apiOrigin": "https://www.refurbgenius.info",
  "buildIdentity": "ios-capacitor-spa",
  "buildMode": "production",
  "viteConfig": "vite.ios.config.ts",
  "webDir": "dist/ios/client",
  "nativePublicDir": "ios/App/App/public",
  "originAuthorityChunk": "assets/<chunk>.js",
  "supabaseUrl": "https://<project-ref>.supabase.co",
  "supabasePublicKeySha256": "<sha256 of selected public client key>",
  "supabaseAuthorityChunk": "assets/<chunk>.js",
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
- `originAuthorityChunk` and `supabaseAuthorityChunk` are safe relative paths under `webDir` (no absolute, scheme, or `..` paths). They name the emitted client chunks that contain `src/platform/http/origin.ts` and `packages/supabase/src/env.ts`. They may be the same file.
- Provenance validation requires both authority chunks to exist as keys in `files` before copied-bundle or App.app verification.
- `bundleFingerprint` is SHA-256 of the canonical JSON of `{ schemaVersion, sourceSha, apiOrigin, buildIdentity, buildMode, originAuthorityChunk, supabaseUrl, supabasePublicKeySha256, supabaseAuthorityChunk, files }`.
- `verify-copied` and `verify-app-bundle` re-read those exact chunks, require `apiOrigin` and `supabaseUrl` inside them, and require the packaged bytes to equal the certified file-map hashes. They do not reverse `supabasePublicKeySha256` and do not require the raw key again.
- The Rollup sidecar is schema version 2 and is never certification authority. It records both chunk mappings and boolean bake flags only.
- Timestamps are not authority and are not present.
- No env dumps, tokens, raw keys, or `service_role`.

Capacitor extras allowed in `ios/App/App/public` after copy, and not part of the fingerprint:

- `cordova.js`
- `cordova_plugins.js`

Any other extra hashed web asset fails as `stale_native_assets`.

## `server.url`

Do not add `server.url` to `capacitor.config.ts`.

After `cap copy ios`, generated `ios/App/App/capacitor.config.json` is inspected. If `server.url` exists, prepare fails.

`ios:verify-app-bundle` inspects `App.app/capacitor.config.json` the same way.

## Future physical certification (not this slice)

Record separately from the provenance file (the file remains the authority for SHA / origin / Supabase identity / fingerprint):

- Xcode version
- exact Xcode build number
- SDK version
- device iOS version
- source SHA
- provenance `bundleFingerprint`
- effective API origin
- provenance `supabaseUrl` and `supabasePublicKeySha256`

Xcode 27 beta 5 is the current device-testing lane. It is **not** the canonical TestFlight / release toolchain.

## What this slice does not do

- No forensic worktree-name hardcoding
- No IPA verification
- No signing / `DEVELOPMENT_TEAM` / `ios/**` project edits
- No `origin.ts`, `env.ts`, `native.ts`, `capacitor.config.ts`, or `vite.ios.config.ts` changes
- No Production / TestFlight / physical-device certification
- No Storage / RLS weakening
- No `server.url`
