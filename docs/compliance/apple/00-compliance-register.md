# Apple compliance register

**Status:** Foundation inventory (phase 1 of 1 authorised in this slice)
**Mode:** Evidence capture and inventory
**Not:** App Store readiness, legal sufficiency, privacy certification, or release authorisation

| Field | Value |
| ----- | ----- |
| **BASE SHA (frozen)** | `b5999318375d087c1469dd7f1f0b6e1bfcdc0588` |
| **BASE identity** | `origin/main` at audit time; merge of PR #172 (`fix/ios-native-photo-delete-v2`) |
| **Audit date** | 2026-08-19 |
| **Worktree** | `/Users/dev/workspace/refurb-genius-apple-compliance-1` |
| **Branch** | `docs/apple-compliance-1` |
| **Mutation owner** | Grok Build only |
| **Authorised path** | `docs/compliance/apple/**` |

This register does **not** declare Apple compliance, App Store acceptance, privacy correctness, or TestFlight/Production readiness.

Closed product gates and merged PR #172 are historical facts of this BASE SHA. They are **not** reopened or altered by this documentation pack.

---

## 1. Purpose

Record what the repository can prove about the iOS/Capacitor product surface, native permissions, SDKs, and personal data, so later Apple review, privacy nutrition-label, and legal work have a labelled evidence base.

This phase:

- inventories architecture, SDKs/permissions, and data classes;
- labels every material claim;
- records gaps instead of guessing.

This phase does **not**:

- remediate code, config, schema, RLS, Storage, or signing;
- implement missing usage strings, privacy manifests, or account-deletion completeness;
- start TestFlight, App Store Connect, or Production mutation.

---

## 2. Evidence vocabulary

Use these labels exactly. Do not convert a weaker label into **VERIFIED FACT**.

| Label | Meaning | Allowed use |
| ----- | ------- | ----------- |
| **VERIFIED FACT** | Directly supported by repository source, config, or committed docs at BASE SHA, with a reproducible locator. | Architecture, identifiers, declared permissions, code paths, migrations. |
| **PENDING VERIFICATION** | Relevant, but not proven from this tree (runtime, archive, App Store Connect, Production DB live state, signing, physical device). | Unknowns, archive-only artefacts, live processor behaviour. |
| **LEGAL CONFIRMATION REQUIRED** | Legal, privacy-policy, contract, or controller/processor determination. Engineering evidence is not sufficient. | Lawful basis, policy completeness, App Store legal text, age gates. |
| **FUTURE REQUIREMENT** | Typically required for App Store / Apple review / later submission, not claimed as already implemented. | Privacy manifests, export compliance answers, ATT if tracking is later classified. |
| **WATCH ITEM** | Drift, stale docs, incomplete product claims, or a risk that is not yet a verified defect. | Policy vs code mismatches; outdated Phase C docs. |

### VERIFIED FACT locator shape

Where practical, every **VERIFIED FACT** includes:

```text
source type + exact SHA + path and/or query + verification date
```

Example:

```text
git blob @ b5999318375d087c1469dd7f1f0b6e1bfcdc0588
path: capacitor.config.ts
query: appId
verified: 2026-08-19
```

`source type` is one of: `git blob`, `git tree`, `committed doc`, `migration`, `invariant config`.

Do not attach `.env` values, service-role keys, anon keys, DSN values, or other secrets to locators.

---

## 3. Observation vs remediation authority

| Kind | This phase | Later phase (not authorised here) |
| ---- | ---------- | --------------------------------- |
| Observation | Record labelled findings | — |
| Remediation | **Forbidden** | Requires a distinct implementation/repair authority and allowlist |
| Legal drafting | Record gaps only | Counsel / owner |
| App Store Connect / TestFlight | **Forbidden** | Distinct release authority |
| Production / Supabase apply | **Forbidden** | Model B `db-release` or equivalent |

A finding in this pack is a **compliance observation**. It is not a ticket to change `src/**`, `ios/**`, `supabase/**`, or config.

---

## 4. Document set

| ID | Path | Status in this phase | Role |
| -- | ---- | -------------------- | ---- |
| 00 | `docs/compliance/apple/00-compliance-register.md` | **Present** | Vocabulary, SHA lock, register, gaps |
| 02 | — | **Not written** (out of scope) | Reserved |
| 03 | `docs/compliance/apple/03-technical-baseline.md` | **Present** | Architecture / build / API baseline |
| 04 | `docs/compliance/apple/04-sdk-and-permissions-inventory.md` | **Present** | Native SDKs, plugins, Info.plist |
| 05 | `docs/compliance/apple/05-data-inventory.md` | **Present** | Data classes and processors |
| 06–13 | — | **Not written** (out of scope) | Reserved for later authorised phases |

Do not treat missing 02 / 06–13 as implied complete.

---

## 5. Frozen security invariants (context, not re-declared as new design)

These remain programme constraints. This pack does not weaken them.

| Invariant | Register note |
| --------- | ------------- |
| No `service_role` in browser/native | Cited from `AGENTS.md` and `tests/invariants/auth-env.invariant.test.ts` |
| No persisted signed private Storage URLs | Display/AI signed URLs are TTL-bounded in source; persistence of those URLs is not evidenced as a product feature |
| No public Storage workaround for private project photos | Latest migration sets `project-photos.public = false` |
| No RLS/Storage weakening | This documentation slice does not change schema or policies |

---

## 6. Finding severity (observations only)

| Severity | Meaning in this pack |
| -------- | -------------------- |
| **P0** | Evidence of a live security invariant break or secret in client/native. None identified from this documentation review. |
| **P1** | Material Apple-submission or privacy-claim gap that later review will almost certainly require closing, but is **not remediated here**. |
| **P2** | Completeness, drift, or archive-only unknown. |

Observations discovered in this inventory are listed in §8. They are **not** implementation tasks under this authority.

---

## 7. Open evidence gaps

These stay **PENDING VERIFICATION** until a later authorised probe (archive, App Store Connect, device, counsel).

1. Xcode archive / IPA contents vs this source tree (linked frameworks, privacy manifests from SPM, bitcode, symbols).
2. Apple Developer Team ID, provisioning profiles, and `DEVELOPMENT_TEAM` (not present in `project.pbxproj`).
3. Whether Universal Links / `apple-app-site-association` are published in Production.
4. Whether `NSPhotoLibraryUsageDescription` is required at runtime for the HTML library file picker in WKWebView.
5. App Store Connect export-compliance answers and encryption classification.
6. Whether native WKWebView account deletion via `deleteAccountServerFn` (cookie `createServerFn`) succeeds on device.
7. Whether `auth.users` delete cascades Storage objects under `project-photos` (row cascade is evidenced; object cleanup is not).
8. Live Production processor list vs `/privacy` copy (PostHog, Sentry, Hugging Face, Resend, Vercel).
9. Whether Apple Sign In on native uses the browser JS SDK, Supabase OAuth only, or Sign in with Apple entitlement.
10. ATT / tracking classification of PostHog + Sentry Replay on iOS.
11. Physical iPhone permission prompts and Info.plist effective merge from SPM packages.
12. App Store age rating, nutrition labels, and reviewer notes.

---

## 8. Findings discovered (do not fix in this phase)

| ID | Sev | Label | Observation |
| -- | --- | ----- | ----------- |
| AC1-F01 | P1 | FUTURE REQUIREMENT | No `PrivacyInfo.xcprivacy` (or other `.xcprivacy`) in the repository tree. |
| AC1-F02 | P1 | PENDING VERIFICATION | `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription` are absent while the upload UI offers a multi-file library picker. |
| AC1-F03 | P1 | PENDING VERIFICATION | `ITSAppUsesNonExemptEncryption` is absent; App Store export compliance is not answered in-repo. |
| AC1-F04 | P1 | LEGAL CONFIRMATION REQUIRED | `/privacy` contains unfilled legal identity fields (company number, registered office, ICO number) and “Last updated: June 2026”. |
| AC1-F05 | P1 | WATCH ITEM | Settings + privacy copy claim full project/photo/analysis deletion; `deleteAccountServerFn` deletes `profiles` then `auth.admin.deleteUser`. Table FKs cascade; Storage object deletion is not in that function. |
| AC1-F06 | P2 | WATCH ITEM | `docs/capacitor-ios.md` still lists Phase C constraints (no native auth, no camera plugins, no analytics SDKs) that are stale relative to current source. |
| AC1-F07 | P2 | PENDING VERIFICATION | Associated Domains entitlement is scaffold-only; AASA is not in `public/` and is documented as not operational. |
| AC1-F08 | P2 | WATCH ITEM | Privacy policy states non-essential cookies need consent; no cookie-consent UI was found under `src/`. PostHog uses `localStorage+cookie` when a public token is present. |
| AC1-F09 | P2 | PENDING VERIFICATION | `DEVELOPMENT_TEAM` is not set in `project.pbxproj`; signing identity is `"iPhone Developer"` + Automatic. |
| AC1-F10 | P2 | WATCH ITEM | Marketing version `1.0` / project version `1` are Xcode defaults; they are not an App Store release number. |

**P0:** none from this inventory.

---

## 9. Label counts (this pack)

Counts are substring matches of the five labels across the four authorised documents as of this commit (`rg -F`, 2026-08-19). A line that contains two labels is counted in both. Recheck after edits.

| Label | Count |
| ----- | ----- |
| VERIFIED FACT | 98 |
| PENDING VERIFICATION | 51 |
| LEGAL CONFIRMATION REQUIRED | 9 |
| FUTURE REQUIREMENT | 8 |
| WATCH ITEM | 17 |

---

## 10. Related programme facts (context only)

**VERIFIED FACT.** This BASE SHA is the merge of PR #172 into `main`.
Evidence: `git log` / merge commit `b5999318375d087c1469dd7f1f0b6e1bfcdc0588` · verified 2026-08-19.

**VERIFIED FACT.** Controlled Public Beta is a separate, earlier programme decision (GO 2026-08-09) with product baseline `8e181527f2c73f81554121c7ed517f24500366a6`. It does not authorise Apple submission.
Evidence: committed doc `docs/operations/public-beta-launch-authorization.md` @ BASE SHA · verified 2026-08-19.

**VERIFIED FACT.** Production database delivery is Model B: merge ≠ Production DB apply; Production project ref `sxhzjmzfkgbogmlsbeju`.
Evidence: `AGENTS.md` · `docs/operations/database-delivery-model-b.md` @ BASE SHA · verified 2026-08-19.

---

## 11. Next phase (recommendation only — not authorised)

A later owner-authorised phase may write remaining Apple pack IDs (privacy nutrition, ATT, App Review notes, account-deletion completeness, legal review). That phase must not start from this document alone.
