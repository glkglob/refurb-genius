# Apple compliance register (refresh)

**Status:** Documentation-only evidence refresh
**Mode:** Inventory and labelled evidence capture
**Not:** App Store readiness, legal sufficiency, privacy certification, or release authorisation

| Field | Value |
| ----- | ----- |
| **Current BASE SHA** | `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7` |
| **BASE identity** | `origin/main` at refresh time; merge of PR #175 (`fix/native-scope-analysis-1`) |
| **Refresh date** | 2026-08-20 |
| **Worktree** | `/Users/dev/workspace/refurb-genius-apple-compliance-refresh-1` |
| **Branch** | `docs/apple-compliance-refresh-1` |
| **Mutation owner** | Grok Build only |
| **Authorised path** | `docs/compliance/apple/**` (all seven files are **additions** on this BASE) |

This register does **not** declare Apple compliance, App Store acceptance, privacy correctness, or TestFlight/Production readiness.

---

## Historical pack (not the implementation base)

**HISTORICAL FACT.** PR #173 (`docs/apple-compliance-1`, head `78b3a6422914de31484bed527f7c7b80701e9ba3`) is CLOSED / UNMERGED. Its pack base was `b5999318375d087c1469dd7f1f0b6e1bfcdc0588`. That commit never landed on `main`. Files `00/03/04/05` in this refresh are conceptual reconciliations of those historical blobs, authored as **new files** on current main.

Evidence: GitHub PR #173 closed/unmerged; `git ls-tree` of BASE has no `docs/compliance/apple/**` · verified 2026-08-20.

The historical branch and worktree `docs/apple-compliance-1` remain protected. This refresh does not merge, cherry-pick, rebase, or build from `78b3a64`.

Resolved findings use:

```text
HISTORICAL FACT → CURRENT STATUS → evidence locator
```

---

## 1. Purpose

Record what the repository at current BASE can prove about the iOS/Capacitor product surface, native permissions, SDKs, personal data, account deletion, Sign in with Apple revocation, and App Privacy worksheet inputs, so later Apple review and legal work have a labelled evidence base.

This phase does **not** remediate `src/**`, `ios/**`, `supabase/**`, tests, config, Production, App Store Connect, or TestFlight.

---

## 2. Evidence vocabulary

Use these labels exactly. Never promote a weaker class into a stronger one.

| Label | Meaning | Allowed use |
| ----- | ------- | ----------- |
| **VERIFIED REPOSITORY FACT** | Directly supported by source, config, or committed docs at BASE SHA, with a reproducible locator. Applied only after the cited path was re-read at this BASE. | Architecture, identifiers, declared permissions, code paths, migrations. |
| **EXTERNAL FACT** | Apple or Supabase published documentation, with URL and verification date **2026-08-20**. | Guidelines, TN3194, listed SDKs, Storage API docs. |
| **HISTORICAL FACT** | True of a cited prior SHA (`78b3a64`, `b599931`, `eed0570`, …), not claimed as current-main behaviour. | Pre-#174 deletion; historical pack text. |
| **PENDING VERIFICATION** | Relevant, but not proven from this tree (runtime, archive, App Store Connect, Production live state, device, mailbox). | Unknowns, IPA contents, live provider config. |
| **LEGAL CONFIRMATION REQUIRED** | Legal, privacy-policy, contract, or controller/processor determination. Engineering evidence is not sufficient. | Lawful basis, 5.1.2(i) permission, nutrition-label finals, F04 placeholders. |
| **AGENT CLAIM** | Agent synthesis, not a locator. | Cross-document summaries. |
| **INFERENCE** | Reasonable but not directly proven. | Possible WKWebView picker behaviour. |
| **RECOMMENDATION** | Next-slice advice only. | Not an implementation order. |

Finding status words (RESOLVED, WATCH ITEM, PENDING LIVE VERIFICATION) are **not** extra evidence classes.

### VERIFIED REPOSITORY FACT locator shape

```text
git blob @ 1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7
path: …
query: …
verified: 2026-08-20
```

Do not attach `.env` values, service-role keys, anon keys, DSN values, or signed URL strings to locators.

Historical `VERIFIED FACT` in the #173 pack maps to **VERIFIED REPOSITORY FACT** when re-proven at this BASE, otherwise to **HISTORICAL FACT**.

---

## 3. Observation vs remediation authority

| Kind | This phase | Later phase (not authorised here) |
| ---- | ---------- | --------------------------------- |
| Observation | Record labelled findings | — |
| Remediation | **Forbidden** | Distinct implementation/repair authority |
| Legal drafting | Record gaps only | Counsel / owner |
| App Store Connect / TestFlight | **Forbidden** | Distinct release authority |
| Production / Supabase apply | **Forbidden** | Model B `db-release` or equivalent |

A finding in this pack is a **compliance observation**. It is not a ticket to change `src/**`, `ios/**`, `supabase/**`, or config.

---

## 4. Document set

All seven paths are **additions** relative to current main. `00/03/04/05` conceptually reconcile historical `78b3a64` files; they did not exist on BASE.

| ID | Path | Status in this phase | Role |
| -- | ---- | -------------------- | ---- |
| 00 | `docs/compliance/apple/00-compliance-register.md` | **Added** | Vocabulary, SHA lock, register, gaps |
| 02 | — | **Not written** (out of scope) | Reserved |
| 03 | `docs/compliance/apple/03-technical-baseline.md` | **Added** | Architecture / build / API baseline |
| 04 | `docs/compliance/apple/04-sdk-and-permissions-inventory.md` | **Added** | Native SDKs, plugins, Info.plist |
| 05 | `docs/compliance/apple/05-data-inventory.md` | **Added** | Data classes and processors |
| 06 | `docs/compliance/apple/06-account-deletion-evidence.md` | **Added** | Current deletion runner evidence |
| 07 | `docs/compliance/apple/07-sign-in-with-apple-revocation-worksheet.md` | **Added** | **WORKSHEET**, not a final declaration |
| 08 | `docs/compliance/apple/08-app-privacy-declarations-worksheet.md` | **Added** | **WORKSHEET**, not a final App Store Connect declaration |
| 09–13 | — | **Not written** (out of scope) | Reserved |

Do not treat missing 02 / 09–13 as implied complete.

---

## 5. Frozen security invariants (context, not re-declared as new design)

These remain programme constraints. This pack does not weaken them.

| Invariant | Register note |
| --------- | ------------- |
| No `service_role` in browser/native | Cited from `AGENTS.md` and `tests/invariants/auth-env.invariant.test.ts` |
| No persisted signed private Storage URLs | Display/AI signed URLs are TTL-bounded in source; exhaustive non-persistence is **PENDING VERIFICATION** (see `05`) |
| No public Storage workaround for private project photos | Latest committed private-bucket migration remains in tree |
| No RLS/Storage weakening | This documentation slice does not change schema or policies |

---

## 6. Finding severity (observations only)

| Severity | Meaning in this pack |
| -------- | -------------------- |
| **P0** | Evidence of a live security invariant break or secret in client/native. None identified from this documentation review. |
| **P1** | Material Apple-submission or privacy-claim gap that later review will almost certainly require closing, but is **not remediated here**. |
| **P2** | Completeness, drift, or archive-only unknown. |

---

## 7. Open evidence gaps

These stay **PENDING VERIFICATION** until a later authorised probe (archive, App Store Connect, device, counsel, Production).

1. Xcode archive / IPA contents vs this source tree (linked frameworks, privacy manifests from SPM, symbols).
2. Apple Developer Team ID, provisioning profiles, and `DEVELOPMENT_TEAM` (not present in `project.pbxproj`).
3. Whether Universal Links / `apple-app-site-association` are published in Production.
4. Whether the WKWebView HTML library file picker independently requires `NSPhotoLibraryUsageDescription`.
5. App Store Connect export-compliance answers and encryption classification.
6. Current-SHA physical EMAIL/PASSWORD account deletion, including Storage object removal on device.
7. Live Production processor list vs `/privacy` copy (PostHog, Sentry, Hugging Face, Resend, Vercel).
8. Whether Production/native builds have `VITE_APPLE_CLIENT_ID` set; whether native sign-in uses the browser JS SDK, Supabase OAuth, or a Sign in with Apple entitlement.
9. ATT / tracking classification of PostHog + Sentry Replay on iOS.
10. Physical iPhone permission prompts and Info.plist effective merge from SPM packages at this SHA.
11. App Store age rating, nutrition labels, and reviewer notes currently on file in App Store Connect.
12. Mailbox liveness of `support@refurbgenius.co.uk`.
13. Whether Capacitor 8.3.4 (or Aparajita Secure Storage) ships a privacy manifest that Xcode copies into the archive.

2026-08-19 physical-test device notes discussed in programme planning are **not** a git-blob locator in this repository or in historical pack commit `78b3a64`. Those observations are **omitted** here. They would not certify BASE `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7` or this documentation candidate SHA in any case.

---

## 8. Findings (do not fix in this phase)

Finding IDs **AC1-F01–F10** preserve historical identities from the #173 pack. **AC1-F11–F14** are the Control Plane freeze for this refresh (SIWA revocation, third-party AI sharing, App Privacy worksheet, generated-types/live-schema drift). Do not reuse the unused #173-R1 armv7/support-email numbering.

| ID | Sev | Status | Observation |
| -- | --- | ------ | ----------- |
| AC1-F01 | P1 | PENDING VERIFICATION | No repo-owned `PrivacyInfo.xcprivacy` (or other `.xcprivacy`) in the repository tree. Apple lists Capacitor among SDKs requiring privacy-manifest coverage (**EXTERNAL FACT**). Archive coverage remains **PENDING VERIFICATION**. This pack does **not** claim guaranteed App Review rejection. See `04`. |
| AC1-F02 | P1 | PENDING VERIFICATION | `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription` are absent while upload UI offers an HTML multi-file library picker. This pack does **not** assert that the usage string is required. Apple system-picker selected-item access is an **EXTERNAL FACT**; exact WKWebView HTML-input behaviour remains **PENDING VERIFICATION**. See `04`. |
| AC1-F03 | P1 | PENDING VERIFICATION | `ITSAppUsesNonExemptEncryption` is absent. That means the App Store Connect questionnaire remains; it is **not** itself proof of export-compliance failure. Do not blindly recommend setting the key to `false` without linked-crypto verification. See `04`. |
| AC1-F04 | P1 | LEGAL CONFIRMATION REQUIRED | `/privacy` contains unfilled legal identity fields (company number, registered office, ICO number) and “Last updated: June 2026”. See `05`. |
| AC1-F05 | P1 | code-level **RESOLVED** (historical preserved) | See stacked labels below and `06`. |
| AC1-F06 | P2 | WATCH ITEM | `docs/capacitor-ios.md` still lists Phase C constraints (no native auth, no camera plugins, no analytics SDKs) that are stale relative to current source. See `03`, `04`. |
| AC1-F07 | P2 | PENDING VERIFICATION | Associated Domains entitlement is scaffold-only; AASA is not in `public/` and is documented as not operational. See `03`. |
| AC1-F08 | P2 | WATCH ITEM | Privacy policy states non-essential cookies need consent; no cookie-consent UI was found under `src/`. PostHog uses `localStorage+cookie` when a public token is present. See `05`. |
| AC1-F09 | P2 | PENDING VERIFICATION | `DEVELOPMENT_TEAM` is not set in `project.pbxproj`; signing identity is `"iPhone Developer"` + Automatic. See `03`. |
| AC1-F10 | P2 | WATCH ITEM | Marketing version `1.0` / project version `1` are Xcode defaults; they are not an App Store release number. See `03`. |
| AC1-F11 | P1 | PENDING LIVE VERIFICATION | Sign in with Apple token revocation. Apple `/auth/revoke` requirement is an **EXTERNAL FACT** (TN3194). Repository search shows no explicit Apple `/auth/revoke` implementation. Production Apple-provider activation remains **PENDING VERIFICATION**. Do **not** claim active non-compliance until live applicability is established. See `07`. |
| AC1-F12 | P1 | PENDING VERIFICATION + LEGAL CONFIRMATION REQUIRED | Third-party AI data sharing. Guideline 5.1.2(i) (disclosure and explicit permission before sharing personal data with third parties, including third-party AI) is an **EXTERNAL FACT**. Repository AI/photo server paths exist (see `05`). This pack does **not** determine that every property image is personal data. |
| AC1-F13 | P1 | PENDING VERIFICATION | App Privacy declarations. `08` is a **WORKSHEET** only. Do not infer declarations from package names. Runtime/App Store Connect answers remain **PENDING VERIFICATION**. Final answers are **LEGAL CONFIRMATION REQUIRED**. |
| AC1-F14 | P2 | WATCH ITEM | Generated TypeScript types vs live schema reconciliation drift in account-deletion metadata reads (`floorplan_models.uploaded_by` / `pitch_deck_exports.created_by` vs generated `user_id` typings). Describe only; this slice does not regenerate types. See `05`, `06`. |

**P0:** none from this inventory.

### AC1-F05 stacked labels

**HISTORICAL FACT** @ `b599931` / pack `78b3a64`: Settings + privacy copy claimed full project/photo/analysis deletion; `deleteAccountServerFn` deleted `profiles` then `auth.admin.deleteUser`; table FKs cascaded; Storage object deletion was not in that function; native Settings used the cookie serverFn.

**CURRENT STATUS (code-level RESOLVED)** @ `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7`: shared `executeAccountDeletion` performs Storage cleanup → re-enumerate verify → `auth.admin.deleteUser` last. Native uses Bearer `POST /api/mobile/v1/account/delete`. Web still uses cookie `deleteAccountServerFn`. Both converge on the same runner. Do **not** resurrect the pre-#174 defect as current.

**PENDING VERIFICATION:** live Production Storage residue; current-SHA physical EMAIL/PASSWORD deletion; SIWA applicability (AC1-F11).

**LEGAL CONFIRMATION REQUIRED:** whether the implemented path plus cascade satisfies UK GDPR erasure / App Store account-deletion expectations.

Evidence locators: [`06-account-deletion-evidence.md`](./06-account-deletion-evidence.md); git blobs `src/features/account-deletion/application/executeAccountDeletion.server.ts`, `deleteOwnedStorage.server.ts`, `presentation/deleteAccountForClient.ts` @ BASE · verified 2026-08-20.

---

## 9. Label counts (this pack)

Counts are substring matches of the eight labels across the seven authorised documents as of this commit (`rg -F`, 2026-08-20). A line that contains two labels is counted in both. Recheck after edits.

| Label | Count |
| ----- | ----- |
| VERIFIED REPOSITORY FACT | 98 |
| EXTERNAL FACT | 24 |
| HISTORICAL FACT | 13 |
| PENDING VERIFICATION | 69 |
| LEGAL CONFIRMATION REQUIRED | 18 |
| AGENT CLAIM | 2 |
| INFERENCE | 2 |
| RECOMMENDATION | 3 |

Recount command (2026-08-20), run after these totals were written so the table cells themselves are included:

```bash
rg -F --no-heading -c '<LABEL>' docs/compliance/apple
```

---

## 10. Related programme facts (context only)

**VERIFIED REPOSITORY FACT.** This BASE SHA is the merge of PR #175 into `main`.
Evidence: `git log` / merge commit `1ddc593c08e62caa65d3e8c411fa25ff6c1d66e7` · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** PR #174 (native account deletion + Storage cleanup) is an ancestor of this BASE (`920e257` / `eed0570`).
Evidence: `git merge-base --is-ancestor eed0570 HEAD` · verified 2026-08-20.

**HISTORICAL FACT.** Controlled Public Beta is a separate, earlier programme decision (GO 2026-08-09) with product baseline `8e181527f2c73f81554121c7ed517f24500366a6`. It does not authorise Apple submission.
Evidence: committed doc `docs/operations/public-beta-launch-authorization.md` @ BASE SHA · verified 2026-08-20.

**VERIFIED REPOSITORY FACT.** Production database delivery is Model B: merge ≠ Production DB apply; Production project ref `sxhzjmzfkgbogmlsbeju`.
Evidence: `AGENTS.md` · `docs/operations/database-delivery-model-b.md` @ BASE SHA · verified 2026-08-20.

**EXTERNAL FACT.** Since 2026-04-28, apps uploaded to App Store Connect must be built with Xcode 26 or later using an iOS 26-family SDK.
Source: https://developer.apple.com/news/upcoming-requirements/ · verified 2026-08-20.
This does **not** prove that an archive of this SHA was so built.

---

## 11. Native Scope Save (out of scope)

Native Scope Save (`saveScopeAnalysis` via the browser Supabase client) is a **separate P1 engineering slice**. It is not inspected, repaired, or expanded here beyond this identification.

---

## 12. Next phase (recommendation only — not authorised)

A later owner-authorised phase may remediate numbered findings, complete SIWA revocation if live-applicable, complete App Privacy declarations with counsel, or run archive/device/ASC probes. That phase must not start from this document alone.
