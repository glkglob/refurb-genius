# 4C2E-A — Production Catalogue Data-Gate Plan

```text
Status: 4C2E-A PLAN COMPLETE
Decision: BLOCKED — SOURCE OR LICENSING DECISION REQUIRED
         (secondary: product coverage activation thresholds remain open)
Parent contracts:
  - l3-estimate-authority-contract.md
  - l3-measured-boq-catalogue-foundation-plan.md
  - l3-save-seam-integration-plan.md
Ticket: 4C2E-A (planning only)
Base SHA at planning: da1f63454410d1cbae0c3ca4bde02dc63ed3302d
Branch: docs/4c2e-production-catalogue-data-gate
```

This document is the **implementation-ready data-gate plan** for production
measured-BOQ catalogue rates. It does **not** implement import tooling,
publish production rates, create migrations, activate product readers, or
integrate builders.

Evidence labels used throughout:

```text
[Repository-confirmed]  — verified in code, schema, tests, or committed docs
[External research]     — public licensing / vendor research (not legal advice)
[Reasoned recommendation] — planning recommendation from evidence
[Unresolved business/legal decision] — requires product/legal approval
```

---

## 1. Status and decision

### Decision outcome

```text
BLOCKED — SOURCE OR LICENSING DECISION REQUIRED
```

Secondary open gate (does not unblock production rates alone):

```text
PRODUCT COVERAGE DEFINITION REQUIRED for runtime activation thresholds
```

Schema capability is **not** a blocker for data-only import of content that
fits the existing contract:

```text
Schema: READY for draft→publish of lawful rates without migration
        (import tooling and production data are still missing)
```

### One-paragraph summary

[Repository-confirmed] The 4C2C catalogue mechanism (tables, immutability,
validation, checksum, server-only loader, 4C2D composition) is complete and
dormant. Production tables are intentionally empty; synthetic fixtures are
test-only. [External research] Standard UK commercial cost books and desk
subscriptions do not grant multi-tenant SaaS redistribution rights.
[Reasoned recommendation] Adopt a **blended** strategy (company-owned unit
rates + OGL indices + optional contracted suppliers + optional later OEM),
implemented under a **gated provisional path**. [Unresolved] No lawful
production rate package has been approved; therefore production publication
and runtime activation remain blocked.

---

## 2. Programme baseline

### Repository baseline (planning start)

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `da1f63454410d1cbae0c3ca4bde02dc63ed3302d` |
| Working tree | clean |
| Divergence | `0 0` |

### Completed foundations

| Ticket / PR | Commit | Meaning |
| --- | --- | --- |
| 4C2B authority persistence | `9408b20` | Estimate authority markers + category RPC path |
| Issue #90 PG17 baseline | `7e6464d` | Reproducible public schema baseline |
| 4C2C catalogue foundation | `4af3c1b` | Immutable catalogue tables + pure validation |
| 4C2D reader composition | `e8216a6` | Server-only exact-revision load + reprice |
| PR #95 photo reliability | `da1f634` | Unrelated to catalogue data |

### Programme numbering note

[Repository-confirmed] `l3-save-seam-integration-plan.md` uses:

| Label (save-seam) | Meaning |
| --- | --- |
| 4C2E | Manual and AI **builder** adapters |
| 4C2F | Safe **reader** cutover |

This ticket series **4C2E-A / 4C2E-B…** is the **production catalogue data-gate**
that was previously called the “acquisition / governance gate” under 4C2C.
Product-reader activation remains a **separate** later track (save-seam 4C2F /
this series 4C2F-A). Builder cutover remains save-seam 4C2E and is **out of
scope** here.

### Explicit non-goals of 4C2E-A

```text
no catalogue row inserts
no production seeds
no migrations
no schema changes
no type regeneration
no publish function calls
no product reader activation
no builder integration
no estimate formula changes
no ROI / report / UI changes
no linked or production Supabase
no 4C2E-B / 4C2F implementation
```

---

## 3. Existing catalogue contract

### Tables and identity

[Repository-confirmed] Migration
`supabase/migrations/20260731120000_measured_boq_catalogue_foundation.sql`:

| Table | Natural key | Access |
| --- | --- | --- |
| `measured_boq_catalog_revisions` | `catalog_revision` (unique) | service_role only; RLS enabled, no authenticated policies |
| `measured_boq_catalog_entries` | `(catalog_revision, rate_key)` unique | service_role only; FK → revisions |

Revision grammar:

```text
^mboq-[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$
length 15–64
```

Rate-key grammar:

```text
^[a-z0-9_]+(\.[a-z0-9_]+){2,}$
length 5–160
<trade-or-domain>.<work-item>.<unit>[.<variant>]
```

### Revision columns (selected)

| Column | Constraint highlights |
| --- | --- |
| `status` | `draft` \| `published` \| `retired` |
| `schema_version` | non-empty ≤ 64 |
| `currency` | `GBP` only |
| `vat_basis` | `exclusive` only |
| `regional_basis` | `uk-region-multipliers-v1` only |
| `source_description` | required ≤ 1000 |
| `entry_count` | `>= 0` |
| `content_checksum` | `^[0-9a-f]{64}$` |
| `effective_from` | date NOT NULL |
| `published_at` / `retired_at` | status-coupled CHECK |
| `created_by` | required ≤ 200 |
| `release_notes` | optional ≤ 4000 |

### Entry columns (selected)

| Column | Constraint highlights |
| --- | --- |
| `rate_key` | grammar above |
| `display_name` | required ≤ 200 |
| `trade_or_domain` | required ≤ 100 |
| `unit` | `m2` \| `m` \| `item` \| `hr` \| `day` |
| `cost_type` | `labour` \| `materials` \| `combined` |
| `base_unit_rate` | `numeric(14,4)` **> 0** |
| `currency` / `vat_basis` | GBP / exclusive |
| `source_reference` | optional ≤ 500 (required by pure validation when `production: true`) |
| `status` | `active` \| `deprecated` |
| `replacement_rate_key` | optional, ≠ `rate_key` |

### Lifecycle (DB)

| Transition | Allowed | Notes |
| --- | --- | --- |
| draft → draft | Yes | full edit of entries |
| draft → published | Yes | requires `published_at`; freezes entries |
| published → retired | Yes | only `status`, `retired_at`, `updated_at` |
| published → draft | **No** | immutable |
| retired → * | **No** | fully immutable |
| delete published/retired | **No** | `CATALOG_REVISION_IMMUTABLE` |

Entry mutations require parent status `draft` (`CATALOG_ENTRY_IMMUTABLE`).

### Authority vs reproduction (app loader)

[Repository-confirmed]
`loadMeasuredBoqCatalogueSnapshot` in
`src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts`:

| Purpose | Allowed statuses |
| --- | --- |
| `authority` | **published only** |
| `reproduction` | **published or retired** |

Rules:

```text
exact catalog_revision only
no latest / current aliases (rejected as NOT_FOUND)
no automatic newest-by-effective_from selection
checksum + entry_count revalidated on load
status always re-read (not taken from LRU entry cache)
```

### Pure validation contract

[Repository-confirmed] `@repo/services` catalogue module:

| Symbol | Role |
| --- | --- |
| `validateCatalogueSnapshot` | untrusted snapshot → validated + checksum |
| `computeCatalogueContentChecksum` | SHA-256 of canonical serialisation |
| `assertSingleCatalogRevision` | one library revision for authority commands |
| `UNIT_IMPORT_ALIASES` | defined; **not applied at runtime** (import-time only) |

Production flag: when `production: true`, every entry must have non-empty
`sourceReference` → `CATALOG_SOURCE_REFERENCE_REQUIRED`.

### Composition (dormant product path)

[Repository-confirmed] `repriceMeasuredBoqWithCatalogue`:

```text
assertSingleCatalogRevision
  → loadMeasuredBoqCatalogueSnapshot({ catalogRevision, purpose })
  → repriceMeasuredBoq(input, { resolveLibraryRate })
```

No browser export. No route/UI activation. Missing library keys yield engine
**draft** with `MISSING_LIBRARY_REFERENCE` — never invent rates, never fall
back to category/trade libraries.

### Error codes (selected)

| Layer | Codes |
| --- | --- |
| SQL immutability | `CATALOG_REVISION_IMMUTABLE`, `CATALOG_ENTRY_IMMUTABLE`, `CATALOG_PUBLISH_REQUIRES_PUBLISHED_AT`, `CATALOG_RETIRE_REQUIRES_RETIRED_AT`, `CATALOG_INVALID_STATUS_TRANSITION`, `CATALOG_REVISION_NOT_FOUND` |
| Loader | `CATALOG_REVISION_NOT_FOUND`, `CATALOG_REVISION_NOT_PUBLISHED`, `CATALOG_REVISION_NOT_READABLE`, `CATALOG_CHECKSUM_MISMATCH`, `CATALOG_ENTRY_COUNT_MISMATCH`, `CATALOG_LOAD_FAILED`, `CATALOG_LOAD_TIMEOUT`, … |
| Pure validate | `CATALOG_REVISION_INVALID`, `CATALOG_DUPLICATE_RATE_KEY`, `CATALOG_RATE_INVALID`, `CATALOG_SOURCE_REFERENCE_REQUIRED`, `CATALOG_TOO_LARGE`, … |
| Gate | `MIXED_CATALOG_REVISIONS`, `MISSING_LIBRARY_REVISION`, `NON_LIBRARY_AUTHORITY_RATE` |
| Engine | `MISSING_LIBRARY_REFERENCE`, `CATALOG_UNIT_MISMATCH`, `CATALOG_COST_TYPE_MISMATCH` |

### Tests (selected)

| Path | Role |
| --- | --- |
| `supabase/tests/database/measured_boq_catalogue_foundation.test.sql` | immutability, privacy, publish/retire |
| `packages/services/src/measured-boq/catalogue/catalogue.validation.test.ts` | pure validate + checksum |
| `packages/services/src/measured-boq/catalogue/reproduction.test.ts` | historical A vs B money |
| `…/measuredBoqCatalogue.repository.server.test.ts` | load / cache / purpose |
| `…/repriceMeasuredBoqWithCatalogue.server.test.ts` | composition |
| `tests/invariants/l3-measured-boq-catalogue.invariant.test.ts` | architecture seal |

---

## 4. Schema and code inventory

### What exists (no migration required for basic data)

```text
[Repository-confirmed]
measured_boq_catalog_revisions / measured_boq_catalog_entries
immutability triggers (service_role authoritative)
estimate header/item library provenance columns + FKs
pure validate + checksum
server-only loader + Map resolver
4C2D reprice composition (dormant)
hybrid ownership model documented
catalogue-sources/measured-boq/ README + schema version constant
synthetic fixtures under tests/fixtures/measured-boq-catalogue/
```

### What does not exist

```text
[Repository-confirmed]
production rate rows (empty by design)
import / dry-run / publish CLI
SECURITY DEFINER publish RPC
on-disk revision packages (MANIFEST + snapshot.json)
unit alias normaliser applied in a pipeline
cross-revision semantic stability checks
publication evidence artifacts under reports/
measured-BOQ persistence RPC
builder library-identity adapters
product reader activation
formal catalogue publisher role assignment
```

### Can 4C2E-B remain data-only?

[Reasoned recommendation]

| Path | Migration needed? |
| --- | --- |
| Tooling + synthetic dry-run + draft upsert + publish under existing columns | **No** |
| Production rates that fit current CHECKs after legal approval | **No** (data only) |
| Extra provenance columns (licence_id, source_id, approval_ref, importer_version) | **Yes** — split 4C2E-B1 schema if product requires them in DB |
| Measured persist RPC / builders / readers | **Separate tickets** |

**Preferred split:** keep 4C2E-B **tooling + provenance manifests in VCS** first;
add DB columns only if governance requires them in-row rather than in
immutable revision manifests.

---

## 5. Source / licensing decision matrix

### Evidence classes

| Source class | Type | Redistribution into multi-tenant estimates | Notes |
| --- | --- | --- | --- |
| Internal QS build-ups | First-party | **Yes** if no third-party book contamination | [External research] + [Reasoned recommendation] |
| ONS / DBT indices (OGL v3) | Public | **Yes** as **indices**, not unit rates | [External research] |
| Supplier contracted price lists | Third-party | **Only with contract** | [External research] |
| Customer aggregates | Customer data | **Only with ToS** | [External research] |
| BCIS standard subscription | Commercial | **No** for SaaS catalogue backbone | [External research] express T&Cs |
| BCIS OEM / data licence | Commercial | **Possible after signed OEM** | [Unresolved] |
| Spon’s / Laxton’s books | Copyright | **No** bulk digitisation without licence | [External research] |
| CATEGORY_BASE / TRADE_RATES / AI mocks | Repo legacy | **No** promotion to measured-BOQ library | [Repository-confirmed] |

### Decision matrix (summary)

| Dimension | Internal curated | Licensed OEM (if signed) | Blended (internal + OGL ± supplier) | Book scrape / desk-sub harvest |
| --- | --- | --- | --- | --- |
| Legal ownership | Company | Vendor | Company core | **Illegal / breach** |
| Licence for SaaS display | Yes | Per OEM | Yes for owned rates | No |
| Auditability | High if method stored | High | High | Opaque |
| Reproducibility | High with versioning | High | High | Low |
| Coverage | Build cost | Excellent | Build + improve | Irrelevant |
| Risk | Contamination / accuracy | Cost / non-compete | Medium | **Unacceptable** |

### Options A–D

| Option | Label | Verdict |
| --- | --- | --- |
| A | Internal curated | Viable **core**; insufficient alone long-term without indexation/feedback |
| B | Licensed commercial | Quality gold standard **only after OEM**; not via desk sub / book |
| **C** | **Blended** | **Recommended strategy** |
| D | No source acceptable | Apply if neither internal build **nor** OEM is funded |

---

## 6. Recommended source strategy

### Primary recommendation

```text
C. Blended catalogue
implemented as a GATED PROVISIONAL PATH
```

[Reasoned recommendation]

```text
Production catalogue truth  = company-owned unit rates (QS build-ups)
Time/location adjustment    = OGL construction indices (attribution)
Materials refresh           = contracted supplier feeds only (optional)
Calibration                 = ToS-consented customer aggregates (optional, later)
Optional enhance            = BCIS/other OEM as isolated licensed layer (later)
Forbidden                   = Spon’s/Laxton bulk tables; BCIS under desk sub only
```

### Gated provisional path

| Phase | Allowed | Forbidden | Exit |
| --- | --- | --- | --- |
| **P0 — Gate closed** | Tooling, synthetic packages, empty prod tables | Any production rates from books | Legal methodology sign-off for internal build |
| **P1 — Provisional owned rates** | Internal rates + OGL factors; `production:true` only after approval | Marketing as BCIS/Spon’s; scraping | Coverage gate for pilot packs |
| **P2 — Controlled production** | Estimates from owned published revisions; full provenance | Competing product from harvested commercial books | Audit + ToS + accuracy review |
| **P3 — Optional OEM** | Isolated licensed module under signed OEM | Silent merge of OEM into “our rates” without terms | Signed OEM + technical isolation |

### What is **not** approved today

```text
[Unresolved business/legal decision]
No named lawful production rate package
No signed redistribution rights for commercial books
No funded internal QS build programme attested in repo
No OEM commercial approval recorded
```

Therefore:

```text
Runtime activation remains blocked until all mandatory coverage gates pass
AND a lawful source decision is recorded and approved.
```

---

## 7. Provenance requirements

### Minimum provenance for every **published production** revision

| Field | Already in DB / pure snapshot? | Plan |
| --- | --- | --- |
| `catalog_revision` | Yes | Required |
| `source_description` | Yes (revision) | Free-text summary of lawful source class |
| `effective_from` | Yes | Price-basis date |
| `content_checksum` | Yes | SHA-256 of canonical snapshot |
| `entry_count` | Yes | Must match rows |
| `created_by` | Yes | Publisher identity (role/system) |
| `published_at` | Yes | Publish timestamp |
| `source_reference` (per entry) | Yes column; required when `production:true` | Line-level source/method ref |
| `source_id` / `source_name` / `source_version` | **No dedicated columns** | VCS **MANIFEST.json** |
| `licence_reference` / `licence_status` | **No** | MANIFEST |
| `transformation_version` / `importer_version` | **No** | MANIFEST |
| `input_checksum` / `output_checksum` | output = `content_checksum`; input **No** | MANIFEST |
| `rejected_record_count` | **No** | Evidence artifact |
| `approval_reference` / `published_by` | partial (`created_by`) | MANIFEST + evidence |
| `source_retrieved_at` | **No** | MANIFEST |

### Storage preference

[Reasoned recommendation] **Both**:

1. **Immutable VCS revision package** (reviewed source of truth):

```text
catalogue-sources/measured-boq/revisions/<catalog_revision>/
  MANIFEST.json      # governance envelope (not in content_checksum)
  snapshot.json      # MeasuredBoqCatalogueSourceSnapshot body
  evidence/          # optional dry-run / licence notes (no secrets)
```

2. **DB published revision** with `content_checksum` + entries frozen.

3. **Publication evidence artifact** (CI/ops, not browser):

```text
reports/catalogue/<catalog_revision>/<checksum-prefix>-publish.json
```

Do **not** commit raw licensed vendor dumps without redistribution rights
([Repository-confirmed] `catalogue-sources/measured-boq/README.md`).

### Schema gap classification

If product governance requires licence/source IDs **queryable in SQL** for
every revision, plan a **narrow additive migration** as **4C2E-B1**. Otherwise
keep 4C2E-B data-only + MANIFEST (preferred first step).

---

## 8. Revision naming and lifecycle

### Naming policy

[Repository-confirmed] Existing grammar is mandatory:

```text
mboq-YYYY.MM.DD
mboq-YYYY.MM.DD.N    # same calendar day, successive packages
```

Properties:

| Property | Policy |
| --- | --- |
| Immutable once published | Yes (DB trigger) |
| Date-associated | Yes (embedded date) |
| Unique | Yes (`UNIQUE(catalog_revision)`) |
| Human-readable | Yes |
| Environment-independent | Yes — never `prod-latest` |
| Never reused | Yes |
| Never silently repointed | Yes — no aliases |

**Forbidden as identity:** `latest`, `current`, environment aliases, UUIDs as
revision identity (UUID `id` is internal only).

### Lifecycle states

| State | Meaning | Authority load | Reproduction load | Mutate entries |
| --- | --- | --- | --- | --- |
| **draft** | Work in progress | No | No | Yes |
| **validated** | Soft ops state (not a DB enum) | No | No | Yes (still draft) |
| **published** | Production-eligible snapshot | Yes | Yes | No |
| **retired** | Withdrawn for new authority | No | Yes | No |
| **rejected** | Soft ops state for failed import | N/A | N/A | N/A (never published) |

[Reasoned recommendation] Keep DB enum as three-state; treat
validated/rejected as **importer evidence states**, not new SQL statuses,
unless a future migration is justified.

---

## 9. Normalization policy

Owner of money rollups remains **`runMeasuredBoqEngine`** (contingency, VAT,
low/high, regional multipliers). Catalogue supplies **normalized unit rates**,
not precomputed estimate totals.

| Concern | Rule |
| --- | --- |
| Currency | GBP only; no FX conversion in importer |
| VAT | exclusive only; no inclusive→exclusive silent conversion without explicit approved transform |
| Labour/material split | `cost_type` ∈ labour \| materials \| combined; optional split keys as separate `rate_key`s |
| Total unit rate | `base_unit_rate` > 0; `numeric(14,4)` |
| Units | canonical `m2` \| `m` \| `item` \| `hr` \| `day`; apply `UNIT_IMPORT_ALIASES` **once at import** only |
| Category / trade | free `trade_or_domain` string ≤ 100; map product categories in mapping doc, not fuzzy match |
| Library keys | lowercase grammar; semantic change → **new key** |
| Descriptions | display_name required; description optional |
| Region | national base rates; regional mult applied by engine via `uk-region-multipliers-v1` |
| Effective date | revision `effective_from`; not used as runtime soft eligibility |
| Decimal precision | store ≤ 4 dp; engine rounds money at 2 dp |
| Nulls | forbidden for required fields; description/source_reference may be null (except production source_reference) |
| Zero / negative rates | **reject** (`base_unit_rate > 0`) |
| Duplicates | fatal within revision |
| Aliases | **forbidden** at runtime; import aliases for units only |
| Obsolete entries | `status=deprecated` + optional `replacement_rate_key`; still resolve if present |

---

## 10. Validation gates

### Structural (block import)

```text
required snapshot fields
revision grammar
rate_key grammar
unit / cost_type membership
currency / vat / regional basis
entryCount match
no duplicate rate_key
entry count ≤ 50_000
checksum format if provided
```

Reuse: `validateCatalogueSnapshot`.

### Semantic (block import or publication)

```text
base_unit_rate > 0 finite
replacement_rate_key only when deprecated
replacement target exists in same snapshot (recommended add)
production ⇒ every source_reference non-empty
licence.status approved when production true (importer gate)
no empty production publication (entry_count > 0) — product gate (not yet DB CHECK)
```

### Comparative (warn or require approval)

```text
% change vs prior published revision per key
added / removed keys
unit or cost_type change for same key (should be new key)
outlier rates (configurable bounds)
coverage drop of mandatory tradeOrDomain buckets
```

### Publication (block publish)

```text
dry-run clean (zero blocking issues)
deterministic content_checksum recomputed and stored
entry rows written under draft only
parent remains draft until atomic publish flip
post-publish loadMeasuredBoqCatalogueSnapshot(purpose=authority) succeeds
reproduction fixture pattern passes for sample keys
approval recorded in MANIFEST / evidence
```

### Failure handling

| Failure class | Effect |
| --- | --- |
| Structural validate fail | **Block import** |
| Production source_reference missing | **Block import** |
| Licence not approved | **Block publish** (and block import of `production:true`) |
| Comparative outliers | **Warning** → require manual approval to publish |
| Partial entry write | **Abort transaction** — no partial publication |
| Checksum mismatch on load | **Hard error** — never serve |

---

## 11. Minimum product coverage

### Hard technical minimum (any authority line)

```text
≥ 1 published revision with matching content_checksum
every line (catalogRevision, rateKey) exact hit
units/cost types valid
production:true ⇒ source_reference on every entry
single catalogRevision per authority command
lawful source decision recorded
```

### Recommended product-minimum domains

Map from live `ESTIMATE_CATEGORIES` / builder surfaces
([Repository-confirmed] category list; [Reasoned recommendation] domain map):

| tradeOrDomain (proposed) | Dominant units |
| --- | --- |
| kitchen | item, m, m2 |
| bathroom | item, m2 |
| flooring | m2 |
| decoration | m2 |
| electrical | item, hr, day |
| plumbing | item, m, hr |
| heating | item |
| roofing | m2, day |
| structural | item, day |
| damp | item, m2 |
| garden | m2, day |
| windows_doors | item |
| plastering | m2 |
| carpentry | m, item |

### Activation threshold (planning default)

```text
[ ] Lawful source + licence status approved
[ ] Published production revision (not mboq-2099 synthetic)
[ ] Mandatory domains above have ≥1 active key each
[ ] High-frequency lines present: wall decoration m2, floor finish m2,
    wall tile m2, kitchen fit item, bathroom fit item, rewire item,
    basic plumbing item
[ ] Units only from {m2,m,item,hr,day}
[ ] VAT exclusive GBP; regional basis uk-region-multipliers-v1
[ ] effective_from within agreed freshness window (default: ≤ 12 months)
[ ] permitted missing-rate % for pilot BOQ fixtures: 0 for authority
[ ] authority fallback %: 0 (no category/trade/base fill)
[ ] reproduction fixtures green for pinned revision
```

```text
Runtime activation remains blocked until all mandatory coverage gates pass.
```

Populated tables alone are **not** sufficient.

---

## 12. Environment promotion

```text
source acquisition / internal build
  → local import dry-run
  → deterministic validation
  → local draft upsert + publish test
  → preview/staging publication (if env exists)
  → independent verification
  → production publication approval
  → production publication
  → post-publication smoke (authority load + sample resolve)
  → SEPARATE runtime-activation decision (builders/readers)
```

### Clarifications

```text
data publication ≠ runtime activation
production publication does not rewrite historical estimates
production publication does not enable builders or readers
exact catalog_revision remains explicit on every authority command
```

### Approval roles (names, not people)

| Decision | Role |
| --- | --- |
| Source / licence | Legal + Product owner |
| Technical validation | Engineering (catalogue owner) |
| Product coverage | Product owner + estimating SME |
| Production publication | Engineering lead + Product owner |
| Runtime activation | Product owner + Engineering lead (separate ticket) |

---

## 13. Publication transaction

### Atomic process (compatible with current schema)

```text
1. Identify / create draft revision row (status=draft)
2. Replace draft entries (delete+insert under draft lock)
3. validateCatalogueSnapshot + recompute content_checksum
4. optional comparative report vs prior published
5. write MANIFEST + evidence artifact
6. record approval in MANIFEST
7. UPDATE status='published', published_at=now(), entry_count, content_checksum
8. DB freezes content; entries immutable
9. verify loadMeasuredBoqCatalogueSnapshot({ purpose: 'authority' })
10. emit audit evidence (no rate payload dumps)
```

There is **no** publish RPC today; service_role UPDATE is the technical
publication act ([Repository-confirmed] pgTAP).

### Recommended tooling shape (future 4C2E-B)

```text
scripts/import-measured-boq-catalogue.ts
  --path catalogue-sources/measured-boq/revisions/<rev>
  --mode dry-run | upsert-draft | publish
```

Pipeline:

```text
read MANIFEST + snapshot
→ licence gate
→ apply UNIT_IMPORT_ALIASES
→ validateCatalogueSnapshot
→ build deterministic plan
→ (optional) write draft / publish
→ write evidence
```

### Migration split recommendation

| Ticket | Scope |
| --- | --- |
| **4C2E-B1** | Manifest format, unit normaliser, dry-run CLI, evidence (no production rates) |
| **4C2E-B2** | Draft upsert + publish transaction + retire helper + verification |
| Optional **4C2E-B0** | Narrow provenance columns migration **only if** SQL queryability required |

---

## 14. Retirement and rollback

### Retirement means

```text
unavailable for new authority loads
still available for reproduction of historical estimates
immutable content
not deleted
```

### Rollback does **not** mean

```text
mutating published rows
unpublishing to draft
deleting a published revision
silently changing an existing catalog_revision identity
```

### Rollback model

```text
1. publish corrected NEW revision (mboq-YYYY.MM.DD.N or new date)
2. switch future explicit authority pins to the new revision only after
   a separate activation decision
3. retain defective revision (optionally retire with release_notes reason)
4. historical estimates keep their original catalog_revision FK
```

### Emergency invalid revision

```text
retire immediately for authority
incident record + evidence
do not mutate rates
publish fix as new revision
communicate to product that new estimates must pin the fix revision
```

---

## 15. Empty and failed catalogue behaviour

| Scenario | Expected behaviour |
| --- | --- |
| No revision exists | `CATALOG_REVISION_NOT_FOUND` |
| Requested revision missing | `CATALOG_REVISION_NOT_FOUND` |
| Draft + authority | `CATALOG_REVISION_NOT_PUBLISHED` |
| Draft + reproduction | `CATALOG_REVISION_NOT_READABLE` |
| Retired + authority | `CATALOG_REVISION_NOT_PUBLISHED` |
| Retired + reproduction | Load OK |
| Published with zero entries | Schema allows; product gate should **block publish**; resolves miss all keys |
| Required key missing | Engine draft + `MISSING_LIBRARY_REFERENCE` (no invented rate) |
| Import partial fail | Abort; leave previous published untouched |
| Publish transaction fail | Remain draft or failed apply; no published half-state |
| Checksum mismatch on load | `CATALOG_CHECKSUM_MISMATCH` — do not serve |

### Required principles (locked)

```text
no invented rate
no automatic latest revision
no category / trade / base fallback for library authority
no zero-rate authority estimate
no partial publication
clear structured error codes
dormant runtime path remains safe when tables empty
```

---

## 16. Security and operational controls

| Control | Plan |
| --- | --- |
| Source file access | Restrict `catalogue-sources/` production packages; no browser imports |
| Licence documents | Store offline / secret manager references; paths in MANIFEST only |
| Import credentials | service_role local/CI secrets only; never commit |
| Production publish auth | Dual approval (engineering + product) before `--mode publish` in prod |
| Audit logging | revision, checksum prefix, counts, actor, env — no full rate dumps |
| Least privilege | service_role for catalogue write/load; no authenticated SELECT |
| Immutable artifacts | VCS package + DB freeze + evidence JSON |
| Checksum verification | pure recompute on import and every load |
| Secrets | never in evidence or telemetry |
| Orphan drafts | periodic cleanup of aged drafts (ops); never auto-publish |
| Failed imports | retain evidence; no silent retry publish |
| Tampering | checksum mismatch fails closed |

---

## 17. Observability plan (future; not implemented here)

### Events

```text
catalogue_import_started
catalogue_import_validated
catalogue_import_failed
catalogue_revision_published
catalogue_revision_retired
catalogue_checksum_mismatch
catalogue_coverage_gate_failed
```

### Safe fields

```text
catalog_revision
source_id (opaque)
record_count
rejected_count
checksum_prefix (e.g. 12 hex chars)
environment
reason_code
duration_ms
mode (dry-run | upsert-draft | publish)
```

### Forbidden telemetry

```text
raw rates
full licensed tables
credentials
PII
full source file contents
```

---

## 18. Operational ownership

| Concern | Owner role |
| --- | --- |
| Pure validation / checksum contract | `@repo/services` maintainers |
| DB immutability / RLS | Platform / database |
| Import CLI / publish tooling | Estimate feature engineering |
| Lawful source decision | Legal + Product |
| Coverage / SME rate review | Estimating SME + Product |
| Runtime activation decision | Product + Engineering (separate ticket) |
| Incident response (bad revision) | On-call engineering + Product |

---

## 19. Proposed implementation phases

### 4C2E-B1 — Source manifest and deterministic importer (dry-run)

| Field | Content |
| --- | --- |
| Objective | On-disk package + unit normalisation + dry-run validation/evidence |
| Scope | `catalogue-sources/…/MANIFEST`, pure normaliser, CLI dry-run, synthetic package only |
| Excluded | Production rates, migrations, publish, builders, readers |
| Expected files | `packages/services/.../catalogue/normalise*`, `scripts/import-measured-boq-catalogue.ts`, synthetic revision dir, tests |
| Validation | unit tests; dry-run of synthetic A/B; no DB writes |
| Merge gate | tests green; no production rates; invariants green |
| Production-ops gate | N/A |

### 4C2E-B2 — Validation and publication transaction

| Field | Content |
| --- | --- |
| Objective | Draft upsert + atomic publish + post-load verify + retire helper |
| Scope | service_role publisher path; evidence; local/staging only until legal approval |
| Excluded | Production rate content without approval; builders; readers |
| Expected files | publish helper (script or `*.server.ts`), retire script, docs |
| Validation | local supabase tests; dry-run→publish synthetic; authority load verify |
| Merge gate | no production rates unless legal gate signed in MANIFEST |
| Production-ops gate | dual approval checklist |

### 4C2E-C — Independent verification

| Field | Content |
| --- | --- |
| Objective | Independent re-verify importer/publisher without implementing rates |
| Scope | adversarial tests; checksum oracle; immutability probes |
| Excluded | product activation |
| Merge gate | verification report PASS |

### 4C2E-D — Controlled catalogue publication

| Field | Content |
| --- | --- |
| Objective | First **lawful** production revision published after legal approval |
| Scope | approved source package only; production publish evidence |
| Excluded | runtime builder/reader activation |
| Production-ops gate | source/licence + coverage + technical validation all signed |

### 4C2E-E — Post-publication verification

| Field | Content |
| --- | --- |
| Objective | Smoke authority/reproduction loads; coverage report; no silent drift |
| Excluded | formula changes |

### 4C2F-A — Product-reader activation planning

| Field | Content |
| --- | --- |
| Objective | Plan only for safe reader/builder cutover after data gate clears |
| Excluded | implementation in 4C2E series |

**No ticket above is auto-authorised by this document.**

---

## 20. Risks and open decisions

### Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Contamination of internal rates from commercial books | High | Written QS attestation; ban rekey; spot audit |
| Shipping unlicensed commercial rates | Critical | Hard importer gate; dual approval |
| Empty published revision | Medium | Product gate entry_count > 0 |
| Activating readers before coverage | High | Separate 4C2F decision |
| Historical estimates broken by mutation | Critical | Already prevented by immutability |
| Accuracy of pure internal rates | Medium | OGL indexation + later OEM/customer feedback |
| Numbering confusion (save-seam 4C2E builders vs data-gate 4C2E) | Low | Explicit cross-ref in this doc |

### Open business / legal decisions

```text
[Unresolved business/legal decision]
1. Approve internal QS build programme vs BCIS OEM budget vs block priced estimates
2. Written redistribution rights for any third-party component
3. Contamination / attestation policy for contributors
4. Customer ToS rights for anonymised aggregate calibration
5. Supplier contract rights for list prices in customer estimates
6. Liability/disclaimer posture for indicative estimates
7. Exact mandatory coverage list + freshness window for pilot
8. Whether licence metadata must live in SQL (migration) or MANIFEST only
```

---

## 21. Explicit authorization boundary

### Authorised by 4C2E-A completion

```text
this planning document
future planning of 4C2E-B* tooling under this plan
```

### Not authorised

```text
production catalogue row inserts
migrations / schema changes
type regeneration
publish of production rates
builder or reader activation
estimate formula / ROI / UI changes
linked or production Supabase operations
scraping or copying proprietary cost books
automatic start of 4C2E-B implementation without separate approval
```

---

## 22. Final recommendation

```text
STATUS: BLOCKED — SOURCE OR LICENSING DECISION REQUIRED

STRATEGY: C — Blended (gated provisional path)
  owned internal unit rates + OGL indices
  optional contracted suppliers
  optional later OEM (isolated)
  never unlicensed commercial books

SCHEMA: ready for data-only import/publish tooling without migration
COVERAGE: define mandatory domains before runtime activation
RUNTIME: remains dormant; activation is a separate decision

NEXT SAFE STEP (after business approval of path C and tooling scope):
  authorise 4C2E-B1 (manifest + dry-run importer) with production rates still blocked
```

### Decision checklist for leadership

| # | Decision | Options |
| --- | --- | --- |
| 1 | Source strategy | Confirm **C Blended** or choose A / B OEM / D block |
| 2 | Fund internal QS rate build | Yes / No |
| 3 | Pursue commercial OEM | Yes / No / Later |
| 4 | Allow 4C2E-B1 tooling without production rates | Yes (recommended) / No |
| 5 | SQL provenance migration now | Defer (recommended) / 4C2E-B0 |

---

## Appendix A — Catalogue population state

| Environment expectation | State |
| --- | --- |
| Production / linked Supabase | Not inspected in this phase; **must not** be used |
| Local default after migrations | Empty catalogue tables (no seed) |
| Tests | Synthetic `mboq-2099.01.01` / `.02` fixtures only |
| `catalogue-sources/measured-boq` | README + schema version; **no production rates** |

Local Supabase was **not running** at planning time; emptiness is confirmed by
migration “Does NOT seed production catalogue rates” and source README.

## Appendix B — Hybrid ownership (locked)

[Repository-confirmed] Option C hybrid from 4C2C plan remains authoritative:

```text
reviewed VCS source package
  → pure validation + checksum
  → immutable DB revision
  → server-only load → sync Map resolver
```

## Appendix C — Related documents

| Document | Role |
| --- | --- |
| `docs/architecture/l3-measured-boq-catalogue-foundation-plan.md` | Mechanism plan + acquisition gate |
| `docs/architecture/l3-estimate-authority-contract.md` | Authority vs draft product contract |
| `docs/architecture/l3-save-seam-integration-plan.md` | Cumulative L3 ticket sequence |
| `catalogue-sources/measured-boq/README.md` | Production rates not approved |
