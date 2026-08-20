# Account deletion evidence

**Parent:** [00-compliance-register.md](./00-compliance-register.md)
**Current BASE SHA:** `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`
**Verified:** 2026-08-20
**Scope:** Repository evidence for in-app account deletion at current BASE.
**Not:** Production residue proof, physical device proof, legal sufficiency, or Sign in with Apple revocation (see [`07`](./07-sign-in-with-apple-revocation-worksheet.md)).

This file is an **addition** on current main. It did not exist in the historical #173 pack.

---

## 1. Apple requirement (external)

**EXTERNAL FACT.** If an app supports account creation, it must also offer account deletion within the app (App Review Guideline 5.1.1(v)).
Sources: https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/support/offering-account-deletion-in-your-app/ · verified 2026-08-20.

This pack does **not** claim App Store acceptance of the implemented path.

---

## 2. Historical state (do not treat as current)

**HISTORICAL FACT** @ pack base `b5999318375d087c1469dd7f1f0b6e1bfcdc0588` / pack head `78b3a6422914de31484bed527f7c7b80701e9ba3` (PR #173 CLOSED / UNMERGED):

- Settings + privacy copy claimed deletion of account, projects, properties, analysis history, uploaded photos and AI results.
- `deleteAccountServerFn` required cookie `requireUser()`, deleted `profiles`, then called `auth.admin.deleteUser`.
- Table FKs cascaded from `auth.users`.
- That function did **not** call Storage remove.
- Native Settings used the cookie serverFn rather than Bearer mobile transport.

Evidence: historical blob `docs/compliance/apple/05-data-inventory.md` §10.2 @ `78b3a64`; historical `src/serverFns/auth.ts` @ `b599931`.

**HISTORICAL FACT.** Do **not** resurrect that pre-#174 Storage-gap / cookie-only-native defect as current-main behaviour.

---

## 3. Current-main identity and transport

**VERIFIED REPOSITORY FACT.** Settings UI calls `deleteAccountForClient()`.

| Platform | Transport |
| -------- | --------- |
| Native (`Capacitor.isNativePlatform()`) | Bearer `POST /api/mobile/v1/account/delete` via `deleteAccountNative` — never the cookie serverFn |
| Web | Cookie `deleteAccountServerFn` |

Both wrap the result with `assertAccountDeletionSuccess`. Local sign-out is the caller’s responsibility **after** the function returns the strict success contract.
Evidence: git blob `src/features/account-deletion/presentation/deleteAccountForClient.ts` · `src/routes/_authed/settings.tsx` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Native handler `handleMobileAccountDelete` uses `requireMobileBearer` only. Body `userId` is ignored; token identity wins. Forged body identity cannot override the Bearer user.
Evidence: git blob `src/features/account-deletion/presentation/mobileAccountDelete.server.ts` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Strict success contract is only `{ success: true }`. A `Response` object is not success. HTTP 401 / non-matching bodies are not deletion success.
Evidence: git blob `src/features/account-deletion/domain/accountDeletionContract.ts` @ BASE SHA · verified 2026-08-20.

---

## 4. Current-main runner order

**VERIFIED REPOSITORY FACT.** Shared server-only `executeAccountDeletion` documents and implements:

```text
Storage cleanup → verify → auth.admin.deleteUser LAST
```

Identity is supplied by the caller after cookie `requireUser()` or Bearer verification. The module never reads request body/query identity.
Evidence: git blob `src/features/account-deletion/application/executeAccountDeletion.server.ts` header and `deleteOwnedStorageForUser` then `admin.auth.admin.deleteUser(userId)` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Live columns used to collect owned Storage paths:

| Table | Path column | Owner column |
| ----- | ----------- | ------------ |
| `photos` | `storage_path` | `user_id` |
| `opportunity_photos` | `storage_path` | `user_id` |
| `floorplan_models` | `storage_path` | `uploaded_by` |
| `pitch_deck_exports` | `storage_path` | `created_by` |

Evidence: `selectOwnedColumn` calls in the same file @ BASE SHA · verified 2026-08-20.

**WATCH ITEM (AC1-F14).** Those live columns are read through a structural client because generated `Database` types are described as stale for some tables. This pack describes the drift; it does not regenerate types.

**VERIFIED REPOSITORY FACT.** Implemented Storage buckets cleaned by the runner:

```text
project-photos, floorplans, pitch-decks, gallery
```

Audit-only buckets (no current-main writer in this module; **not** deleted here unless a later authorised investigation finds user-owned data):

```text
floorplan-models, gallery-assets
```

List page size 100; remove batch size 100; prefix-isolated to the user id. After remove, the runner re-enumerates owned objects under the user prefix and throws `AccountDeletionStorageError` if any remain. `auth.admin.deleteUser` is not called if cleanup verification fails.
Evidence: git blob `src/features/account-deletion/application/deleteOwnedStorage.server.ts` @ BASE SHA · query: `ACCOUNT_OWNED_STORAGE_BUCKETS`, `STORAGE_LIST_PAGE_SIZE`, `STORAGE_REMOVE_BATCH_SIZE`, `remaining` · verified 2026-08-20.

**EXTERNAL FACT.** Supabase documents that deleting an Auth user that owns Storage objects can fail; FK cascade behaviour depends on schema. Storage `list` supports limit/offset pagination. `remove()` deletes specified paths; current documented limit is 1000 objects per call (this repository uses 100).
Sources: https://supabase.com/docs/guides/auth/managing-user-data · https://supabase.com/docs/reference/javascript/storage-from-list · verified 2026-08-20.

**EXTERNAL FACT.** Preview branches are isolated and do not prove Production state.
Source: https://supabase.com/docs/guides/deployment/branching · verified 2026-08-20.

---

## 5. Finding AC1-F05

| Layer | Label | Statement |
| ----- | ----- | --------- |
| Historical | **HISTORICAL FACT** | Pre-#174 runner deleted `profiles` then `auth.admin.deleteUser` without Storage object cleanup; native used cookie serverFn. |
| Current code | code-level **RESOLVED** | Storage cleanup → verify → `deleteUser` last; native Bearer path present. Do not resurrect the historical defect as current. |
| Live Production residue | **PENDING VERIFICATION** | Whether Production Storage still contains objects after a real user delete. |
| Current-SHA physical EMAIL/PASSWORD delete | **PENDING VERIFICATION** | Not performed for this documentation SHA. |
| SIWA users | **PENDING VERIFICATION** | See AC1-F11 / [`07`](./07-sign-in-with-apple-revocation-worksheet.md). |
| Legal / App Store sufficiency | **LEGAL CONFIRMATION REQUIRED** | Engineering evidence is not a counsel determination. |

**HISTORICAL FACT.** Commit `eed0570` (`fix(native): align account-deletion metadata columns with live schema`) is an ancestor of this BASE and records the live-column alignment after a Preview metadata-select failure on an earlier #174 SHA. That earlier Preview 500 is **not** current-main behaviour.
Evidence: `git merge-base --is-ancestor eed0570 HEAD` · verified 2026-08-20.

---

## 6. Product copy vs code

**VERIFIED REPOSITORY FACT.** Settings: “Permanently delete your account, all projects, properties, and analysis history.” Privacy Account Deletion lists profile/credentials, projects/properties/analysis history, uploaded photos and AI-generated results, processed within 30 days.
Evidence: `src/routes/_authed/settings.tsx` · `src/routes/privacy.tsx` @ BASE SHA · verified 2026-08-20.

**PENDING VERIFICATION.** Whether audit-only buckets, logs, PostHog/Sentry, and processor-side copies are fully erased by the in-app path.

**LEGAL CONFIRMATION REQUIRED.** 30-day SLA and UK GDPR erasure completeness.

---

## 7. Explicit non-claims

This document does **not** claim:

- App Store acceptance of the deletion flow
- Production Storage is empty after delete
- physical device success at BASE SHA
- Sign in with Apple token revocation (separate worksheet)
- that `auth.admin.deleteUser` automatically calls Apple `/auth/revoke`
