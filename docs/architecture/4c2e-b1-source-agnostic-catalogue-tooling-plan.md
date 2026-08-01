# 4C2E-B1A — Source-Agnostic Catalogue Manifest and Deterministic Dry-Run Tooling Plan

```text
Status: 4C2E-B1A PLAN COMPLETE
Decision: READY FOR B1 IMPLEMENTATION APPROVAL
Parent contracts:
  - docs/architecture/4c2e-production-catalogue-data-gate-plan.md (4C2E-A, merged)
  - docs/architecture/l3-measured-boq-catalogue-foundation-plan.md
  - packages/services/src/measured-boq/catalogue/*
Ticket: 4C2E-B1A (planning only)
Base SHA at planning: f9b0f5b0a0a2bf447a23a72bc4253746cce9c991
Branch: docs/4c2e-b1-source-agnostic-tooling-plan
```

This document is the **implementation-ready plan** for **4C2E-B1**: source-agnostic
manifest parsing, deterministic unit normalisation, synthetic fixtures, stable
checksums, structural/semantic validation, and a dry-run-only CLI.

It does **not** implement tooling, add production rates, write to the database,
create migrations, publish revisions, activate runtime readers, or integrate
builders.

Evidence labels used throughout:

```text
[Repository-confirmed]     — verified in code, schema, tests, or committed docs
[Merged 4C2E-A requirement] — required by the merged data-gate plan
[Reasoned B1 recommendation] — planning recommendation from evidence
[Unresolved decision]      — needs explicit product/engineering choice
[Future B2 or B0 concern]  — out of B1 scope
```

---

## 1. Status and recommendation

### Verdict

```text
READY FOR B1 IMPLEMENTATION APPROVAL
```

This readiness verdict **does not** authorise:

```text
production or licensed catalogue data
source-specific adapters
database writes / draft upserts
migrations
publication or retirement tooling
production publication
runtime reader activation
estimate-builder integration
4C2F implementation
```

### One-paragraph summary

[Repository-confirmed] The 4C2C catalogue module already provides pure snapshot
validation (`validateCatalogueSnapshot`), deterministic content checksums
(`computeCatalogueContentChecksum` / SHA-256), revision and rate-key grammars,
canonical units/cost types/currency/VAT/regional basis, and import-time unit
aliases (`UNIT_IMPORT_ALIASES`) that are **defined but not applied**. Synthetic
fixtures exist under `tests/fixtures/measured-boq-catalogue/`. No import CLI or
normaliser pipeline exists. [Merged 4C2E-A requirement] B1 is the first safe
implementation step: source-agnostic manifest + dry-run only.
[Reasoned B1 recommendation] Implement one vertical B1 ticket: pure normaliser
+ package reader in `@repo/services` catalogue, thin dry-run CLI under
`scripts/`, synthetic on-disk package under `catalogue-sources/`, tests and
invariants proving no Supabase / no production data / no B2 modes.

---

## 2. Exact repository baseline

| Item | Value |
| --- | --- |
| Repository | `glkglob/refurb-genius` |
| Branch at planning | `main` |
| Exact HEAD | `f9b0f5b0a0a2bf447a23a72bc4253746cce9c991` |
| `origin/main` | identical |
| Divergence | `0 0` |
| Working tree | clean |
| Merge / rebase | none |

### Completed programme work

| Ticket / PR | Meaning |
| --- | --- |
| 4C2B | Estimate authority persistence foundation |
| #90 / #93 | Reproducible PostgreSQL 17 public-schema baseline |
| 4C2C | Measured-BOQ catalogue foundation (tables, pure validation, checksum) |
| 4C2D | Server-only catalogue reader composition |
| 4C2E-A / #96 | Production catalogue data-gate plan (merged at `f9b0f5b`) |

### B1 boundary (authoritative)

[Merged 4C2E-A requirement]

| In B1 | Out of B1 |
| --- | --- |
| Manifest schema (VCS) | Production / licensed rates |
| Deterministic unit normalisation | Source-specific adapters |
| Synthetic catalogue fixtures | Database writes |
| Stable input + output checksums | Migrations |
| Structural + semantic validation | Draft upserts |
| Deterministic dry-run reports | Publication / retirement |
| CLI or repository script (dry-run only) | Production publication |
| Tests + architecture invariants | Runtime reader activation |
| | Estimate-builder integration |
| | 4C2F |

---

## 3. Investigation evidence

### 3.1 Existing reusable catalogue contracts

[Repository-confirmed] Module:
`packages/services/src/measured-boq/catalogue/`

| Export / API | Role |
| --- | --- |
| `MeasuredBoqCatalogueSourceSnapshot` | Untrusted snapshot input type |
| `MeasuredBoqCatalogueSourceEntry` | Untrusted entry input type |
| `MeasuredBoqCatalogueValidatedSnapshot` | Narrowed post-validation snapshot |
| `MeasuredBoqCatalogueValidatedEntry` | Narrowed post-validation entry |
| `validateCatalogueSnapshot` | Pure structural + semantic validation; recomputes checksum |
| `computeCatalogueContentChecksum` | SHA-256 of canonical serialisation |
| `canonicalCatalogueSerialisation` | Deterministic JSON (entries sorted by `rateKey`) |
| `sha256Hex` | Pure SHA-256 UTF-8 → lowercase hex (no Node builtins) |
| `UNIT_IMPORT_ALIASES` | Import-time unit map; **not applied anywhere yet** |
| `CANONICAL_MEASURED_BOQ_UNITS` | `m2` \| `m` \| `item` \| `hr` \| `day` |
| `MEASURED_BOQ_COST_TYPES` | `labour` \| `materials` \| `combined` |
| `CATALOG_CURRENCIES` | `GBP` only |
| `CATALOG_VAT_BASES` | `exclusive` only |
| `CATALOG_REGIONAL_BASES` | `uk-region-multipliers-v1` only |
| `CATALOG_REVISION_PATTERN` | `^mboq-[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$` |
| `RATE_KEY_PATTERN` | `^[a-z0-9_]+(\.[a-z0-9_]+){2,}$` |
| `CatalogueValidationCode` / `CatalogueValidationIssue` | Structured error model |
| `assertSingleCatalogRevision` | Mixed-revision gate (engine input; not B1 CLI core) |

### 3.2 Canonical validated entry fields

[Repository-confirmed] From `types.ts` + `validateCatalogueSnapshot.ts`:

| Field | Required | Constraints |
| --- | --- | --- |
| `rateKey` | yes | grammar, ≤ 160 |
| `displayName` | yes | non-empty trim, ≤ 200 |
| `description` | optional | string ≤ 2000 or null |
| `tradeOrDomain` | yes | non-empty trim, ≤ 100 |
| `unit` | yes | canonical enum only (aliases **not** applied in validator) |
| `costType` | yes | labour \| materials \| combined |
| `baseUnitRate` | yes | finite number `> 0` |
| `currency` | yes | `GBP` |
| `vatBasis` | yes | `exclusive` |
| `sourceReference` | optional; **required if `production: true`** | non-empty ≤ 500 |
| `status` | yes | `active` \| `deprecated` |
| `replacementRateKey` | optional | grammar; ≠ rateKey; only when deprecated |

### 3.3 Canonical validated snapshot fields

| Field | Required | Constraints |
| --- | --- | --- |
| `schemaVersion` | yes | non-empty ≤ 64 (fixtures use `mboq-catalogue-v1`) |
| `catalogRevision` | yes | revision grammar, ≤ 64 |
| `currency` / `vatBasis` / `regionalBasis` | yes | locked enums |
| `effectiveFrom` | yes | ISO date `YYYY-MM-DD` |
| `sourceDescription` | yes | non-empty ≤ 1000 |
| `entryCount` | yes | integer = `entries.length` |
| `entries` | yes | array ≤ 50_000 |
| `contentChecksum` | optional input | if present must match recomputed |
| `status` | optional | draft \| published \| retired |
| `createdBy` / `releaseNotes` | optional | bounds apply |
| `production` | optional boolean | when true enforces sourceReference |

### 3.4 Checksum behaviour (existing)

[Repository-confirmed] `checksum.ts`:

* Algorithm: pure SHA-256 → lowercase 64-char hex.
* Canonical payload fields (fixed key order via object literal + `JSON.stringify`):
  `schemaVersion`, `catalogRevision`, `currency`, `vatBasis`, `regionalBasis`,
  `effectiveFrom`, `entries`.
* Entries sorted by `rateKey` ascending before hash.
* Per-entry fields: `rateKey`, `displayName`, `description` (null-coalesced),
  `tradeOrDomain`, `unit`, `costType`, `baseUnitRate`, `currency`, `vatBasis`,
  `sourceReference` (null-coalesced), `status`, `replacementRateKey` (null-coalesced).
* **Excluded** from content checksum: revision lifecycle timestamps,
  `createdBy`, `releaseNotes`, `production`, `sourceDescription`,
  `entryCount`, MANIFEST governance envelope.
* Reordering entries with identical content **does not** change the checksum
  (sort by rateKey). Duplicate rateKeys fail validation before checksum.

### 3.5 Unit aliases (defined, unused)

[Repository-confirmed] `UNIT_IMPORT_ALIASES` in `constants.ts`:

```text
sqm → m2
m²  → m2
lm  → m
each → item
ea → item
hour → hr
hours → hr
```

Not present (and must **not** be invented without explicit plan approval):

```text
linear_metre, days, day (as alias — day is already canonical), nos, nr, etc.
```

[Reasoned B1 recommendation] Apply **only** the existing `UNIT_IMPORT_ALIASES`
map at import-normalise time. Unknown units fail. Do not expand the map in B1
unless a synthetic fixture proves an alias gap that is already documented
elsewhere; prefer adding aliases in a follow-up with tests.

### 3.6 Source tree conventions

[Repository-confirmed]

| Path | Role today |
| --- | --- |
| `catalogue-sources/measured-boq/README.md` | Source contract rules; no production rates |
| `catalogue-sources/measured-boq/schema.ts` | Doc-only contract version constant |
| `tests/fixtures/measured-boq-catalogue/*.ts` | Synthetic TypeScript snapshots (A/B) |
| `scripts/*.mjs` / `scripts/*.ts` | Node CLI utilities via `node` or `tsx` |
| `package.json` scripts | `tsx` available; `admin:bootstrap` uses tsx; verify scripts use plain `node` |
| Dependencies | `zod` and `tsx` already installed; **no new deps required** for B1 |
| `@repo/services` | Pure catalogue exports; **must remain free of Supabase** (invariant) |

### 3.7 Gaps (B1 fills)

[Repository-confirmed]

```text
no manifest JSON schema / package reader
no normalise pipeline applying UNIT_IMPORT_ALIASES
no input-package checksum
no dry-run CLI
no on-disk synthetic revision package (MANIFEST + snapshot)
UNIT_IMPORT_ALIASES unused in runtime or tooling
```

---

## 4. Ownership and dependency boundaries

### 4.1 Ownership matrix

| Concern | Owner | Rationale |
| --- | --- | --- |
| Manifest + raw entry types | `packages/services/src/measured-boq/catalogue/` | Same pure domain as snapshot validation |
| Unit normalisation | same catalogue module | Beside `UNIT_IMPORT_ALIASES` + validator |
| Package parse + dry-run pipeline | same catalogue module (pure) | Testable without Node FS if FS injected; default pure from objects |
| Content checksum | **reuse** existing `checksum.ts` | Do not fork |
| CLI argument parsing + FS I/O | `scripts/import-measured-boq-catalogue.ts` | Matches 4C2E-A expected file; scripts already host CLIs |
| Synthetic on-disk package | `catalogue-sources/measured-boq/revisions/<rev>/` | Matches 4C2E-A hybrid model |
| Unit / pipeline tests | co-located `*.test.ts` under catalogue + script smoke if needed | Existing vitest pattern |
| Architecture invariants | `tests/invariants/` | Existing catalogue invariant suite |
| Ops notes (optional) | `docs/operations/` only if CLI UX needs operator docs | Prefer architecture plan + script header for B1 |

### 4.2 Import rules

[Reasoned B1 recommendation]

```text
ALLOWED:
  scripts/import-measured-boq-catalogue.ts
    → @repo/services (catalogue pure APIs only)
    → node:fs, node:path, node:process, node:url

  packages/services/.../catalogue/normalise*
    → sibling catalogue modules only
    → NO @supabase/*, NO createClient, NO service-role helpers
    → NO src/features/**, NO routes, NO presentation, NO builders

FORBIDDEN in B1:
  any import of measuredBoqCatalogue.repository.server
  any import of repriceMeasuredBoqWithCatalogue.server
  any import of createServiceRoleSupabase / createClient
  any CLI path that calls upsert/publish/retire
  exposing dry-run pipeline from a browser-facing feature barrel
```

### 4.3 Public barrel

[Reasoned B1 recommendation]

* Export pure B1 APIs from `packages/services/src/measured-boq/catalogue/index.ts`
  (and thus `@repo/services`) so tests and CLI share one implementation.
* Do **not** add a separate browser-facing feature export.
* Pure module remains isomorphic (no Node builtins in catalogue normaliser),
  matching existing `sha256.ts` / `checksum.ts` discipline.
* CLI-only FS helpers stay in `scripts/`.

### 4.4 Package script

[Reasoned B1 recommendation] Add to root `package.json` (implementation phase):

```json
"catalogue:dry-run": "tsx scripts/import-measured-boq-catalogue.ts --mode dry-run"
```

Alternative name `catalogue:validate` is acceptable if preferred at implementation,
but **`--mode dry-run`** must remain the only functional mode in B1 to match
4C2E-A CLI shape and leave B2 modes as hard stubs.

---

## 5. Proposed package layout (on disk)

[Merged 4C2E-A requirement] Hybrid model:

```text
catalogue-sources/measured-boq/revisions/<catalog_revision>/
  MANIFEST.json      # governance envelope (NOT in content_checksum)
  snapshot.json      # body aligned to MeasuredBoqCatalogueSourceSnapshot
                     #   AFTER normalisation, or raw-before-normalise
                     #   (see §6 — B1 chooses explicit raw vs normalised stages)
  evidence/          # optional dry-run reports (gitignored or synthetic only)
```

### 5.1 Stage model

[Reasoned B1 recommendation] Two-stage pipeline:

```text
1) RAW PACKAGE
   MANIFEST.json  — governance + transformation metadata
   snapshot.json  — RAW source-neutral snapshot (may contain unit aliases,
                    optional entry field aliases documented below)

2) NORMALISE (pure)
   raw snapshot → canonical MeasuredBoqCatalogueSourceSnapshot
   (units via UNIT_IMPORT_ALIASES; strings trimmed per policy;
    decimal normalisation; entry defaults)

3) VALIDATE (pure, existing)
   validateCatalogueSnapshot(canonical) → ok + contentChecksum | issues

4) REPORT (CLI)
   deterministic JSON/text report; optional expected checksum checks
```

`snapshot.json` on disk for synthetic fixtures should store the **raw** input
(so alias paths are exercised). Expected normalised checksums live in fixtures /
report golden files, not as silent mutation of the source file.

---

## 6. Manifest contract (source-neutral)

### 6.1 Top-level shape (proposed exact)

```json
{
  "manifest_version": "1",
  "catalog_revision": "mboq-2099.01.01",
  "source": {
    "id": "synthetic-test-source",
    "name": "Synthetic Test Source",
    "version": "1",
    "effective_date": "2099-01-01",
    "retrieved_at": "2099-01-01T00:00:00Z",
    "licence_reference": "synthetic-only",
    "licence_status": "synthetic"
  },
  "transformation": {
    "schema_version": "1",
    "normaliser_version": "1"
  },
  "package": {
    "snapshot_path": "snapshot.json",
    "production": false
  }
}
```

Field classification:

| Field | Required | Classification |
| --- | --- | --- |
| `manifest_version` | yes | required; B1 supports `"1"` only |
| `catalog_revision` | yes | required; must match snapshot after normalise |
| `source.id` | yes | required; free id ≤ 100; synthetic fixtures use `synthetic-*` |
| `source.name` | yes | required; display only |
| `source.version` | yes | required; source package version string ≤ 64 |
| `source.effective_date` | yes | required; ISO date |
| `source.retrieved_at` | optional | report-only; **excluded** from content checksum |
| `source.licence_reference` | yes | required string; **not** legal approval |
| `source.licence_status` | yes | enum (below) |
| `transformation.schema_version` | yes | manifest schema version of transformation block |
| `transformation.normaliser_version` | yes | code path version; B1 = `"1"` |
| `package.snapshot_path` | yes | relative path; default `snapshot.json` |
| `package.production` | yes | boolean; must be `false` for synthetic licence_status |

### 6.2 `licence_status` enum (B1)

```text
synthetic          — test / dry-run only; production MUST be false
unapproved         — real source metadata present but not approved (B1 may parse
                     for dry-run structure tests ONLY with production:false;
                     never ship real rates in-repo)
approved           — [Future B2 concern] legal approval recorded; still does NOT
                     alone authorise DB publish without B2 gates
```

[Reasoned B1 recommendation]

* B1 **accepts** `synthetic` for all committed fixtures.
* B1 **rejects** `licence_status: "approved"` combined with any production path
  in dry-run success messaging that implies publication readiness.
* B1 **rejects** `production: true` unless `licence_status` is not `synthetic`
  **and** every entry has `sourceReference` (existing validator). Committed
  fixtures must keep `production: false` and `licence_status: "synthetic"`.
* Manifest licence fields **never** constitute legal approval.
  [Merged 4C2E-A requirement]

### 6.3 Forbidden in B1 MANIFEST

```text
publish_at / published_by
approval_id / legal_signoff
db_target / supabase_url
service_role references
password / secrets
source adapter identifiers for commercial vendors (bcis, spons, etc.)
coverage_threshold overrides that activate product readers
```

### 6.4 Forward compatibility

* Unknown **top-level** keys: fail in `--strict` (default for B1); optional
  non-strict mode may warn — [Reasoned B1 recommendation] **default strict**.
* Unsupported `manifest_version`: exit code 4 (see §13).
* Nested unknown keys under `source` / `transformation`: strict fail.

### 6.5 Relationship to snapshot `schemaVersion`

* MANIFEST `transformation.schema_version` = **manifest/tooling** contract (`"1"`).
* Snapshot `schemaVersion` = **catalogue domain** contract (`mboq-catalogue-v1`).
* Both required; do not conflate.

---

## 7. Raw entry contract (source-neutral)

Raw `snapshot.json` entries accept the **camelCase** shape already used by
`MeasuredBoqCatalogueSourceEntry`, plus optional documented aliases for
snake_case keys at the normaliser boundary only.

### 7.1 Field table

| Raw field (canonical) | Type | Req | Aliases (normaliser only) | Canonical after normalise | Validation owner |
| --- | --- | --- | --- | --- | --- |
| `rateKey` | string | yes | `rate_key` | trimmed lower? **no** — must already match grammar | existing |
| `displayName` | string | yes | `display_name` | trim ends only | existing |
| `description` | string\|null | no | — | trim ends; empty → null | existing |
| `tradeOrDomain` | string | yes | `trade_or_domain`, `trade` | trim ends | existing |
| `unit` | string | yes | — | alias map → canonical | normaliser + existing |
| `costType` | string | yes | `cost_type` | exact enum | existing |
| `baseUnitRate` | number \| decimal string | yes | `base_unit_rate` | finite number > 0, ≤ 4 dp | normaliser + existing |
| `currency` | string | yes* | — | `GBP` | existing |
| `vatBasis` | string | yes* | `vat_basis` | `exclusive` | existing |
| `sourceReference` | string\|null | no† | `source_reference` | trim; empty → null | existing |
| `status` | string | yes | `entry_status` | active \| deprecated | existing |
| `replacementRateKey` | string\|null | no | `replacement_rate_key` | grammar rules | existing |

\* Entry-level currency/VAT may be **omitted** in raw form when snapshot-level
values are present; normaliser **fills** from snapshot header.
[Reasoned B1 recommendation]

† Required when `production: true` (existing validator).

### 7.2 Explicitly out of B1 raw contract

```text
category (use tradeOrDomain)
notes (use description)
region multipliers per entry
VAT-inclusive rates
multi-currency
supplier SKU maps
commercial source row IDs beyond free-text sourceReference
```

Do not add fields for hypothetical commercial sources.

### 7.3 Snapshot-level raw fields

Same as `MeasuredBoqCatalogueSourceSnapshot` (camelCase), with optional
snake_case aliases for:

```text
schema_version, catalog_revision, vat_basis, regional_basis, effective_from,
source_description, entry_count, content_checksum, created_by, release_notes
```

[Reasoned B1 recommendation] Prefer camelCase in synthetic fixtures to match
existing TypeScript fixtures; support snake_case only as a documented
source-neutral import convenience.

---

## 8. Deterministic normalisation rules

Module (proposed): `packages/services/src/measured-boq/catalogue/normaliseCataloguePackage.ts`
(name flexible; keep under catalogue/).

### 8.1 Strings

| Rule | Policy |
| --- | --- |
| Unicode | NFC not required; process UTF-8 as-is (checksum uses UTF-8 bytes) |
| Trim | leading/trailing whitespace on all string fields that are retained |
| Internal whitespace | preserve for `displayName` / `description`; **reject** rateKey / trade if internal runs need collapsing — rateKey must already match grammar (no spaces) |
| Case | `rateKey` must already be lowercase (grammar); **do not** auto-lowercase rate keys (fail instead) |
| Empty string | required fields: fail; optional: → `null` where schema allows |

### 8.2 Revision and keys

* `catalog_revision` in MANIFEST must equal snapshot `catalogRevision` after normalise.
* No automatic revision generation.
* Rate keys: validate grammar only; no rewriting.
* Duplicate detection:
  1. After alias key mapping (snake→camel), collect raw `rateKey`s.
  2. After full normalise, collect canonical `rateKey`s.
  3. Any collision → `CATALOG_DUPLICATE_RATE_KEY` (or B1 code
     `CATALOG_NORMALISE_DUPLICATE_RATE_KEY` if pre-validation). Prefer reusing
     existing code when possible.

### 8.3 Units

```text
1. If unit is already in CANONICAL_MEASURED_BOQ_UNITS → keep.
2. Else if unit is a key in UNIT_IMPORT_ALIASES → replace with mapped value.
3. Else → CATALOG_UNIT_INVALID (unknown units must not be guessed).
```

Apply **once**. Do not re-alias canonical values.

Alias keys should be matched after trim; case policy for aliases:
[Reasoned B1 recommendation] alias lookup on **exact** keys as defined
(`sqm`, `m²`, …). Optionally accept uppercase of ASCII aliases (`SQM`, `LM`)
via a single `toLowerCase` for ASCII-only keys — document and test. Do **not**
locale-lower `m²`.

### 8.4 Money and decimals

DB: `numeric(14, 4)`; validator today accepts any finite `number > 0`.

[Reasoned B1 recommendation]

| Input | Policy |
| --- | --- |
| JSON number | accept if finite, `> 0`, and has ≤ 4 decimal places when serialised in canonical form |
| Decimal string | accept `/^\d+(\.\d{1,4})?$/` or `/^\d+\.\d{5,}$/` **reject** (no silent round) |
| Scientific notation | reject (`1e3`, `1E-2`) |
| Negative / zero / NaN / Infinity | reject |
| Rounding | **no rounding in B1**; reject excess precision |
| Max magnitude | reject if integer part would overflow `numeric(14,4)` (10 digits before decimal + 4 after) |

Canonical number for checksum: JSON number as produced by `JSON.stringify`
(existing behaviour). Tests must golden-lock known values.

### 8.5 Currency, VAT, regional basis

* Reject unsupported values; **no currency conversion**.
* Reject VAT-inclusive → exclusive conversion.
* Snapshot header must be GBP / exclusive / uk-region-multipliers-v1.

### 8.6 Ordering

| Stage | Order policy |
| --- | --- |
| Raw entries | preserve file order for error paths |
| Validated snapshot entries | preserve input order in `snapshot.entries` (existing validator) |
| Content checksum | sort by `rateKey` (existing) |
| Report accepted list | sort by `rateKey` for determinism |
| Report issues | stable sort by `path` then `code` |

Reordered raw input with same keys/content → **same** content checksum.

### 8.7 Defaults applied by normaliser

| Field | Default when absent |
| --- | --- |
| entry `currency` | snapshot.currency |
| entry `vatBasis` | snapshot.vatBasis |
| entry `status` | **no default** — required |
| entry `description` | null |
| entry `sourceReference` | null |
| entry `replacementRateKey` | null |
| snapshot `production` | from MANIFEST `package.production` if snapshot omits |
| snapshot `entryCount` | set to `entries.length` after normalise if omitted |

### 8.8 Unsupported / extra entry fields

Strict mode: reject unknown entry keys.

---

## 9. Checksum model

### 9.1 Output content checksum (existing)

* Reuse `computeCatalogueContentChecksum` on normalised validated snapshot.
* Encoding: lowercase hex SHA-256.
* Stable across entry reorder.
* Contaminants excluded: timestamps, MANIFEST governance, `retrieved_at`.

### 9.2 Input package checksum (new, B1)

[Reasoned B1 recommendation]

```text
input_checksum = sha256Hex(
  "mboq-package-v1\n" +
  "MANIFEST.json\n" + <raw file bytes as UTF-8 string> + "\n" +
  "snapshot.json\n" + <raw file bytes as UTF-8 string> + "\n"
)
```

Rules:

* Use **raw file text** after read as UTF-8 (LF preferred).
* Reject CRLF in committed fixtures (or normalise CRLF→LF **before** hash and
  document; prefer commit LF-only and fail on CR).
* Do not pretty-print re-serialise before input hash (byte-stable).
* CLI `--expected-input-checksum` compares this value.
* Mismatch → exit 3; never silent overwrite.

### 9.3 Expected output checksum

* CLI `--expected-output-checksum` compares `contentChecksum` from validation.
* Mismatch → exit 3 with both expected and actual in report (no full rate dump).

### 9.4 Reuse for B2

[Future B2 or B0 concern] B2 draft write will recompute content checksum with
the same function before insert. B1 must not implement writes but must not fork
checksum logic.

---

## 10. Synthetic fixture strategy

### 10.1 Principles

```text
no real commercial pricing
fictional revisions mboq-2099.*
clear SYNTHETIC labels in displayName / sourceDescription
no realistic supplier names or proprietary references
small enough for code review
stable golden checksums
```

### 10.2 Proposed paths

**On-disk dry-run package (new in B1 implementation):**

```text
catalogue-sources/measured-boq/revisions/mboq-2099.01.01/
  MANIFEST.json
  snapshot.json
```

Optional second package for reorder/determinism:

```text
catalogue-sources/measured-boq/revisions/mboq-2099.01.02/
  MANIFEST.json
  snapshot.json
```

**Unit-test fixtures (extend existing):**

```text
tests/fixtures/measured-boq-catalogue/
  synthetic-revision-a.ts          # existing (keep)
  synthetic-revision-b.ts          # existing (keep)
  # optional JSON fixtures for CLI integration tests:
  packages/valid-minimum/
  packages/valid-comprehensive/
  packages/invalid-duplicate/
  packages/invalid-unit/
  packages/invalid-money/
  packages/invalid-revision/
  packages/invalid-checksum/
  packages/invalid-production-licence/
```

[Reasoned B1 recommendation] Prefer embedding small JSON under
`packages/services/src/measured-boq/catalogue/__fixtures__/` for unit tests
(co-located, no Vite asset issues) **and** one committed on-disk package under
`catalogue-sources/` for CLI smoke.

### 10.3 Fixture classes

| Class | Purpose |
| --- | --- |
| valid minimum | 1 entry, all required fields, canonical units |
| valid comprehensive | all 5 units, all 3 cost types, active + deprecated+replacement, unit aliases |
| invalid duplicate | same rateKey twice |
| invalid unit | unknown unit `sqft` |
| invalid money | `0`, negative, `1e3`, 5+ dp string |
| invalid revision | `latest`, `mboq-99` |
| invalid checksum | wrong `contentChecksum` on snapshot |
| invalid production/licence | `production:true` + `licence_status:synthetic` |
| invalid manifest version | `manifest_version: "99"` |

Rates in fixtures: tiny integers (e.g. 10, 20, 33.3333 max 4 dp) labelled
SYNTHETIC.

---

## 11. Dry-run CLI interface

### 11.1 Command

[Merged 4C2E-A requirement] Expected:

```bash
pnpm catalogue:dry-run -- --path catalogue-sources/measured-boq/revisions/mboq-2099.01.01
```

Implementation file:

```text
scripts/import-measured-boq-catalogue.ts
```

### 11.2 Arguments (B1-justified only)

| Arg | Required | Meaning |
| --- | --- | --- |
| `--mode dry-run` | yes (or default) | only supported mode in B1 |
| `--path <dir>` | yes | directory containing MANIFEST.json |
| `--format text\|json` | no | default `text` for humans; `json` for CI |
| `--output <file>` | no | write report file; default stdout only |
| `--expected-input-checksum <hex>` | no | verify package input checksum |
| `--expected-output-checksum <hex>` | no | verify content checksum |
| `--strict` | no | default **true**; explicit flag for clarity |

Not in B1:

```text
--mode upsert-draft | publish | retire
--supabase-url | --service-role
--force | --yes for destructive ops
stdin package streams (optional later; file path is enough)
```

### 11.3 Behaviour

1. Parse argv; unknown args → exit 2.
2. If `--mode` present and not `dry-run` → exit 2 with message
   `mode not authorised in B1`.
3. Resolve `--path`; require `MANIFEST.json` + snapshot file.
4. Read files as UTF-8; reject if missing.
5. Parse JSON; on failure exit 2 with parse error (no stack secrets).
6. Call pure pipeline: parse manifest → normalise → validate.
7. Build deterministic report.
8. Compare expected checksums if provided.
9. Print report to stdout (`json` = single JSON object; `text` = stable lines).
10. Issues / diagnostics that are not the report body → stderr.
11. Exit per §13.

### 11.4 File write policy

* `--output` may create/overwrite **only** the report path.
* Never mutate MANIFEST.json or snapshot.json.
* Never write under `supabase/` or env files.

### 11.5 Safety: no database writes

Hard guarantees:

```text
1. Script must not import @supabase/* or createClient.
2. Script must not read SUPABASE_SERVICE_ROLE_KEY for any code path
   (if env is present, ignore it).
3. --mode upsert-draft|publish must fail closed without loading DB code.
4. Invariant test greps scripts/import-measured-boq-catalogue.ts for
   supabase / service_role / createClient.
5. Catalogue pure module already invariant-checked for no Supabase.
```

---

## 12. Exit-code contract

Smallest useful set:

| Code | Meaning |
| --- | --- |
| `0` | valid package; dry-run clean; expected checksums match (if provided) |
| `1` | structural or semantic validation / normalisation failure |
| `2` | invocation, FS, or JSON parse error |
| `3` | checksum mismatch (input or output) |
| `4` | unsupported `manifest_version` (or unsupported normaliser_version) |
| `5` | unexpected internal error (should be rare; message sanitized) |

Mapping:

| Failure class | Exit |
| --- | --- |
| missing --path / unknown arg | 2 |
| file not found / unreadable | 2 |
| invalid JSON | 2 |
| unsupported manifest version | 4 |
| unit / money / revision / duplicate / schema issues | 1 |
| licence/production policy reject | 1 |
| expected checksum mismatch | 3 |
| thrown unexpected | 5 |

Do not print secrets, full env, or entire commercial payloads in logs.

---

## 13. Deterministic report contract

### 13.1 JSON report (stable key order)

```json
{
  "ok": true,
  "mode": "dry-run",
  "manifest_version": "1",
  "normaliser_version": "1",
  "catalog_revision": "mboq-2099.01.01",
  "source_id": "synthetic-test-source",
  "licence_status": "synthetic",
  "production": false,
  "record_count": 2,
  "accepted_count": 2,
  "rejected_count": 0,
  "input_checksum": "…64 hex…",
  "output_checksum": "…64 hex…",
  "unit_alias_applications": [
    { "path": "entries[0].unit", "from": "sqm", "to": "m2" }
  ],
  "issues": [],
  "warnings": []
}
```

On failure, `ok: false`, counts reflect rejects, `issues` populated with
`{ code, path, message, class }` where `class` is one of:

```text
structural | semantic | policy | checksum | unsupported
```

### 13.2 Text report

Stable multi-line format:

```text
catalogue dry-run: PASS|FAIL
revision: mboq-2099.01.01
source: synthetic-test-source
records: 2 accepted / 0 rejected
input_checksum: …
output_checksum: …
issues: (none) | numbered list sorted by path
```

### 13.3 Timestamps

**Forbidden** in report body (destroy determinism). Optional stderr log line with
wall clock is allowed only outside `--format json` body.

---

## 14. Validation pipeline (ordered)

```text
1. CLI arg parse
2. Read MANIFEST.json + snapshot.json (UTF-8)
3. input_checksum over raw bytes
4. JSON.parse both
5. structural manifest validation (version, required fields, enums)
6. policy checks (synthetic ⇒ production false; no secrets keys)
7. normalise snapshot (aliases, defaults, unit map, decimals)
8. catalog_revision MANIFEST ↔ snapshot equality
9. validateCatalogueSnapshot(normalised)
10. output content_checksum from step 9
11. optional expected checksum compares
12. emit report + exit code
```

Error short-circuit: collect issues where cheap; fail-fast on unreadable files
and unsupported versions.

---

## 15. Licence and production policy handling

| Condition | B1 behaviour |
| --- | --- |
| `licence_status: synthetic` + `production: false` | allowed for fixtures |
| `licence_status: synthetic` + `production: true` | **reject** (policy) |
| `production: true` without sourceReference on entries | reject (existing validator) |
| `licence_status: approved` | allowed only as dry-run metadata; report warning that approval is not publish authorisation; **no production rates in-repo** |
| Committed commercial rates | **forbidden** by invariants / review |
| Manifest licence fields | **not** legal approval [Merged 4C2E-A] |

Coverage thresholds, runtime activation, and 4C2F remain **blocked** outside B1.

---

## 16. No-database-write proof

| Control | Mechanism |
| --- | --- |
| Code structure | pure pipeline in `@repo/services` catalogue |
| CLI | dry-run only; B2 modes fail closed |
| Dependency | no supabase imports in new files |
| Invariant | extend `l3-measured-boq-catalogue.invariant.test.ts` |
| Unit test | assert module source text excludes `@supabase` / `createClient` |
| Ops | plan forbids linked/production Supabase for B1 |

B1 implementation validation commands must not start Supabase or apply
migrations.

---

## 17. Proposed implementation files

### 17.1 Add

```text
packages/services/src/measured-boq/catalogue/manifestTypes.ts
packages/services/src/measured-boq/catalogue/parseCatalogueManifest.ts
packages/services/src/measured-boq/catalogue/normaliseCatalogueSnapshot.ts
packages/services/src/measured-boq/catalogue/runCatalogueDryRun.ts
packages/services/src/measured-boq/catalogue/packageChecksum.ts
packages/services/src/measured-boq/catalogue/manifest.validation.test.ts
packages/services/src/measured-boq/catalogue/normalise.validation.test.ts
packages/services/src/measured-boq/catalogue/dryRun.pipeline.test.ts
scripts/import-measured-boq-catalogue.ts
catalogue-sources/measured-boq/revisions/mboq-2099.01.01/MANIFEST.json
catalogue-sources/measured-boq/revisions/mboq-2099.01.01/snapshot.json
```

(Exact filenames may vary slightly; keep under catalogue + scripts +
catalogue-sources.)

### 17.2 Modify

```text
packages/services/src/measured-boq/catalogue/index.ts   # export new pure APIs
package.json                                           # catalogue:dry-run script
tests/invariants/l3-measured-boq-catalogue.invariant.test.ts  # B1 boundary
catalogue-sources/measured-boq/README.md               # document package layout
```

### 17.3 Must not modify (B1)

```text
supabase/migrations/**
src/features/estimate/** (except none)
runtime loaders / reprice
estimate builders / ROI / UI / routes
lockfiles beyond package.json script-only change
database types
```

`package.json` script addition does not require lockfile change if no deps added.

---

## 18. Test plan

### 18.1 Unit (vitest)

| Area | Assertions |
| --- | --- |
| Manifest parse | required fields; version; unknown keys in strict |
| Normalise units | each UNIT_IMPORT_ALIASES mapping; unknown unit fails |
| Normalise decimals | accept 4 dp; reject 5 dp, sci-notation, ≤0 |
| Duplicates | pre/post normalise collisions |
| Ordering | reorder entries → same output_checksum |
| Checksums | golden digests for synthetic package |
| Production policy | synthetic + production true fails |
| validateCatalogueSnapshot | still passes on normalised output |
| No DB | source of pure modules has no supabase strings |

### 18.2 CLI smoke

```bash
pnpm catalogue:dry-run -- --path catalogue-sources/measured-boq/revisions/mboq-2099.01.01 --format json
# expect exit 0, stable JSON keys, non-empty output_checksum
```

### 18.3 Existing catalogue suite (must remain green)

```bash
pnpm exec vitest run \
  packages/services/src/measured-boq/catalogue/catalogue.validation.test.ts \
  packages/services/src/measured-boq/catalogue/reproduction.test.ts \
  src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.test.ts \
  src/features/estimate/application/measuredBoq/repriceMeasuredBoqWithCatalogue.server.test.ts
```

Prior baseline: **48/48** (may increase with new tests; zero failures required).

---

## 19. Invariant plan

Extend `tests/invariants/l3-measured-boq-catalogue.invariant.test.ts` (or add
`l3-measured-boq-catalogue-tooling.invariant.test.ts`):

```text
1. scripts/import-measured-boq-catalogue.ts exists
2. script source matches /dry-run/ and does not match /createClient|@supabase/
3. script does not reference upsert-draft|publish implementation bodies
   (or only hard-fail stubs)
4. catalogue module files still have zero @supabase imports
5. committed catalogue-sources revisions contain only licence_status synthetic
   and production false
6. no numeric rate package under catalogue-sources claiming production approval
7. UNIT_IMPORT_ALIASES applied only in normalise module (not in repository.server)
8. loader still forbids latest/current
```

Invariants baseline prior: **508/508** (may increase).

---

## 20. Validation commands (B1 implementation phase)

```bash
pnpm install --frozen-lockfile
git diff --check
pnpm lint
pnpm typecheck
pnpm test:invariants
pnpm exec vitest run packages/services/src/measured-boq/catalogue/
pnpm catalogue:dry-run -- --path catalogue-sources/measured-boq/revisions/mboq-2099.01.01 --format json
pnpm build
```

Do **not** use linked or production Supabase.

---

## 21. Implementation slicing recommendation

### Recommendation

```text
SINGLE B1 IMPLEMENTATION TICKET
```

Rationale:

* Scope is one vertical slice (parse → normalise → validate → report → CLI).
* Existing validator/checksum already exist; B1 is thin orchestration + aliases.
* Splitting CLI from normaliser risks two PRs that cannot be demonstrated
  end-to-end.
* File count is modest (~10–15 files).

### Optional micro-slices (only if review bandwidth requires)

| Slice | Scope | Alone mergeable? |
| --- | --- | --- |
| B1.1 | pure normalise + manifest types + unit tests | yes (no CLI) |
| B1.2 | CLI + on-disk synthetic package + invariants | needs B1.1 |

[Reasoned B1 recommendation] Prefer **one PR** unless mid-implementation
review forces a split. Do **not** split B0 or B2 into B1.

---

## 22. Risks and open questions

| Item | Class | Notes |
| --- | --- | --- |
| Decimal string vs number only | Reasoned B1 recommendation | Plan accepts both; implementer must golden-test JSON number serialisation |
| Expanding UNIT_IMPORT_ALIASES | Unresolved if product wants `days`→`day` etc. | B1 uses existing map only |
| snake_case aliases surface area | Reasoned B1 recommendation | Support documented set; strict unknown keys |
| Input checksum format versioning | Reasoned B1 recommendation | prefix `mboq-package-v1\n` |
| Whether `approved` licence_status allowed in dry-run | Reasoned B1 recommendation | warn only; no in-repo production rates |
| B2 mode stubs in same script | Reasoned B1 recommendation | fail closed with exit 2 |
| Zod vs hand parsers | Reasoned B1 recommendation | hand parsers matching existing catalogue style; zod optional if it reduces code — **no new dependency** (zod already present) but consistency with hand validation preferred |

No unresolved decision blocks B1 implementation approval.

---

## 23. Explicit exclusions

```text
no production catalogue rates
no licensed / supplier-derived committed data
no source-specific adapters (BCIS, Spon's, OEM, …)
no migrations / schema changes
no database writes / draft upserts
no publication or retirement tooling
no production publication
no runtime reader activation
no estimate-builder integration
no 4C2F work
no ROI / pricing / UI / route changes
no new runtime dependencies (lockfile churn)
no linked or production Supabase usage
no B0 SQL provenance migration
no claim that manifest licence fields are legal approval
```

---

## 24. Schema-readiness consistency

[Merged 4C2E-A requirement] Remains:

```text
SCHEMA READY FOR PUBLICATION TOOLING WITH MANIFEST-ONLY PROVENANCE
```

Interpretation for B1:

* Schema can later accept draft writes of lawful rates **without migration**.
* B1 only prepares **manifest + dry-run**; does not write.
* Optional B0 SQL provenance remains deferred.
* Unresolved legal/product gates still block production publication and runtime
  activation.

---

## 25. Follow-up after B1 merge (not this phase)

```text
After B1 merges and independent verification:
  B2 planning/implementation remains separately authorised
  Production rates remain blocked on source/licensing
  Runtime activation remains blocked on coverage + lawful publication
  4C2F remains blocked
```

Recommended post-B1 verification ticket: **4C2E-B1C** (or programme C-series)
independent verification — out of scope here.

---

## 26. Final authorization recommendation

```text
READY FOR B1 IMPLEMENTATION APPROVAL
```

B1 implementation may proceed only when this planning document is merged (or
explicitly accepted) and a separate implementation ticket is authorised.

B1 implementation approval still **excludes** production data, database writes,
publication, and runtime activation.

---

## 27. Planning-phase self-check

This planning PR (4C2E-B1A) changes only:

```text
A docs/architecture/4c2e-b1-source-agnostic-catalogue-tooling-plan.md
```

No implementation files, no tests executed as mutations, no catalogue data, no
migrations, no database writes, no PR merge of B1 tooling.
