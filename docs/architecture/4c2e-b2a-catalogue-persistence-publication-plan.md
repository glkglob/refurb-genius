# 4C2E-B2A — Catalogue Persistence and Publication Plan

```text
Status: 4C2E-B2A PLAN COMPLETE — READY FOR B2B INDEPENDENT VERIFICATION
         (revision 4C2E-B2A.2 incorporates independent architecture review fixes)
Ticket: 4C2E-B2A (planning only)
Parent contracts:
  - docs/architecture/4c2e-production-catalogue-data-gate-plan.md
  - docs/architecture/4c2e-b1-source-agnostic-catalogue-tooling-plan.md
  - docs/architecture/l3-measured-boq-catalogue-foundation-plan.md
  - docs/architecture/l3-estimate-authority-contract.md
Base SHA at planning: 0b382794f058b3b26b3b3e6bd9eb89b4efc42392
Branch: plan/4c2e-b2a-catalogue-persistence-publication
```

This document is the **implementation-ready plan** for measured-BOQ catalogue
**persistence and publication infrastructure**. It does **not** implement
migrations, importers, publishers, writers, runtime readers, or production data.

Evidence labels used throughout:

```text
[Repository-confirmed]   — verified in code, schema, tests, or committed docs
[Reasoned recommendation] — planning recommendation from repository evidence
[Unresolved product policy] — requires product/legal decision; safe default stated
[Proposed B2 design]     — future work; not existing behaviour
```

---

## Status and authority

| Item | Value |
| --- | --- |
| Phase | **4C2E-B2A** planning only |
| Implementation | **Forbidden** in this phase |
| Next gate | **4C2E-B2B** independent plan verification |
| After B2B PASS | Separate explicit authorisation required before B2C |

B1 remains authoritative for package validation and checksums. B2 must **compose**
B1 outputs and must not re-implement or weaken pure validation.

---

## Purpose

Define an evidence-based, implementation-ready design for:

* validated package draft ingestion;
* immutable catalogue revision and entry persistence;
* package/checksum lineage;
* publication, retirement, and rollback transactions;
* concurrency, idempotency, and audit;
* server-only write authority and RLS posture;
* migration, test, and verification strategy.

---

## Authoritative baseline

| Item | Value |
| --- | --- |
| Repository | `glkglob/refurb-genius` |
| Branch at planning start | `main` |
| Exact HEAD | `0b382794f058b3b26b3b3e6bd9eb89b4efc42392` |
| Working tree | clean (`0 0` divergence) |

### Completed and merged foundations

| Ticket | Meaning | Evidence |
| --- | --- | --- |
| 4C2C-B | Immutable catalogue tables + triggers + RLS | `supabase/migrations/20260731120000_measured_boq_catalogue_foundation.sql` |
| 4C2D | Server-only exact-revision catalogue loader | `src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts` |
| 4C2E-A | Production data-gate plan (licence blocked) | `docs/architecture/4c2e-production-catalogue-data-gate-plan.md` |
| 4C2E-B1A | Source-agnostic tooling plan | `docs/architecture/4c2e-b1-source-agnostic-catalogue-tooling-plan.md` |
| 4C2E-B1B | Pure dry-run pipeline | `packages/services/src/measured-boq/catalogue/` |
| 4C2E-B1C/B1D | Read-only CLI + realpath containment | `scripts/catalogue-dry-run.ts`, PR #99 merge `0b38279` |

---

## Completed B1 foundation (must not be duplicated)

[Repository-confirmed] B1 owns:

| Concern | Location |
| --- | --- |
| Manifest parse + strict unknown keys | `parseCatalogueManifest` |
| Alias exclusivity, unit/decimal normalisation | `normaliseCatalogueSnapshot` |
| Rights / production policy (technical dry-run) | `runCatalogueDryRun` |
| Semantic catalogue validation | `validateCatalogueSnapshot` |
| Deterministic issue ordering | B1 pipeline |
| Package input checksum (`mboq-package-v2`) | `computePackageArtifactChecksum` |
| Canonical content checksum | `computeCatalogueContentChecksum` |
| Read-only FS load + containment | `scripts/catalogue-dry-run.ts` |

B2 consumes:

```text
manifestText + snapshotText
  → runCatalogueDryRun(...)
  → require ok + policy gates
  → map validated snapshot → DB draft rows
```

B2 never re-parses package policy with a weaker pipeline.

---

## Current-state evidence

### 1. Catalogue-related tables and migrations

[Repository-confirmed]

| Path | Symbol / object | Responsibility | B2 implication |
| --- | --- | --- | --- |
| `supabase/migrations/20260731120000_measured_boq_catalogue_foundation.sql` | `measured_boq_catalog_revisions` | Revision header; natural key `catalog_revision`; status lifecycle; `content_checksum` | **Reuse** as canonical revision store; extend columns for package lineage |
| same | `measured_boq_catalog_entries` | Rate rows; identity `(catalog_revision, rate_key)` | **Reuse**; draft-only mutation via existing triggers |
| same | `measured_boq_catalog_revision_immutable()` | draft→published→retired; published/retired content frozen | **Rely on**; do not weaken |
| same | `measured_boq_catalog_assert_parent_draft` + `FOR SHARE` | Entry mutations wait on concurrent publish | **Reuse** for draft write races |
| same | RLS + REVOKE auth / GRANT service_role | Private catalogue tables | **Preserve** deny-by-default |
| `supabase/migrations/20260730120000_estimate_authority_persistence_foundation.sql` | `estimate_authority_idempotency` | Private idempotency for authority writes | Pattern analog for package idempotency |
| same | `persist_category_engine_estimate` SECURITY DEFINER | Privileged product write template | **Mandatory pattern** for all B2 catalogue write RPCs |

**Confirmed absent** (searched migrations + types + app code):

```text
active_revision pointer table/column
catalogue package / input_checksum table
catalogue audit/events table
licence_status / source_id / published_by columns on revisions
SECURITY DEFINER catalogue publish RPC
application catalogue write repository
production catalogue seed rows
```

### 2. Runtime catalogue reader

| Path | Symbol | Responsibility | B2 implication |
| --- | --- | --- | --- |
| `src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts` | `loadMeasuredBoqCatalogueSnapshot` | service_role **SELECT** only; exact revision; authority vs reproduction status gates; checksum revalidation; LRU of entry material | **Do not repurpose** as writer; post-publish verify may call it |
| same | purpose `authority` | requires `status = published` | Publication target for authority eligibility |
| same | purpose `reproduction` | `published` or `retired` | Historical pin support |
| same | rejects `latest` / `current` | No active-alias semantics | B2 must not invent global active alias |

### 3. Write paths

[Repository-confirmed] **No application write path** for catalogue rows.

| Surface | Write? |
| --- | --- |
| App TS catalogue repository | SELECT only |
| `scripts/catalogue-dry-run.ts` | FS read only; no DB |
| pgTAP / probe SQL | service_role writes for contract tests only |

### 4. Publication / active-revision concepts

[Repository-confirmed]

| Concept | Current behaviour |
| --- | --- |
| Status enum | `draft` \| `published` \| `retired` |
| Transitions | draft→draft; draft→published; published→retired only |
| Multiple published revisions | **Allowed** (no unique partial index on published) |
| Active pointer | **None** — consumers pin exact `catalog_revision` |
| Estimates | optional `estimates.catalog_revision` FK when authority is measured-boq |

### 5. RLS and privileged-write conventions

| Path | Symbol | Responsibility | B2 implication |
| --- | --- | --- | --- |
| `src/platform/supabase/service.server.ts` | `createServiceRoleSupabase` | Sole app service-role factory | Writers must use this (or SECURITY DEFINER RPC) |
| `src/serverFns/auth.server.ts` | `requireUser` | Session identity for product paths | Not sufficient alone for catalogue tables |
| `public.is_admin()` | DB helper | Admin **SELECT** overlays on user tables | JWT admin **cannot** DML catalogue tables |
| Category authority stack | `persist_category_engine_estimate` | service_role EXECUTE + ownership recheck | Preferred pattern if in-app later |

### 6. Audit / actor conventions

| Object | Actor field | Notes |
| --- | --- | --- |
| `measured_boq_catalog_revisions` | `created_by text` | Free-form ops identity (not auth.users FK) |
| Product tables | `user_id uuid` | Tenancy RLS |
| `estimate_authority_idempotency` | timestamps + key | Operation lifecycle without spoofable actor body |

### 7. Generated types

| Path | Role |
| --- | --- |
| `packages/supabase/src/database.types.ts` | Generated types for catalogue tables + estimate provenance |
| `packages/services/src/measured-boq/catalogue/*` | Pure domain contracts |
| `packages/types/` | No catalogue types |

B2C migrations require a later authorised type refresh (not B2A).

### 8. Server-only boundaries and invariants

| Path | Role |
| --- | --- |
| `tests/invariants/catalogue-dry-run-boundary.test.ts` | CLI purity + realpath containment seal |
| `tests/invariants/l3-measured-boq-catalogue.invariant.test.ts` | Loader service_role + composition boundaries |
| `tests/invariants/server-only-boundary.invariant.test.ts` | `*.server` import rules |
| `tests/invariants/auth-env.invariant.test.ts` | No `VITE_` service-role key |

### 9. B1 pure API surface (composition contract)

[Repository-confirmed] `@repo/services`:

```text
runCatalogueDryRun({ manifestText, snapshotText, expectedInputChecksum?, expectedOutputChecksum? })
  → { report: CatalogueDryRunReport; contentChecksum? }

report fields (selected):
  ok, mode, tool, catalogRevision, sourceId, licenceStatus, production,
  inputChecksum, outputChecksum, recordCount, acceptedCount, rejectedCount,
  warningCount, issues, warnings, unitAliasApplications
```

Content identity mapping:

```text
DB content_checksum  ≡  B1 outputChecksum / computeCatalogueContentChecksum
B1 inputChecksum     ≡  computePackageArtifactChecksum (mboq-package-v2) — not in DB today

[Repository-confirmed] canonicalCatalogueSerialisation INCLUDES catalogRevision.
Therefore content_checksum is label-bound: two different catalog_revision labels
ALWAYS produce two different content digests even when rate rows are identical.
```

### 10. Legacy / transitional ownership

| Layer | Owner today |
| --- | --- |
| Pure catalogue domain | `packages/services/src/measured-boq/catalogue/` |
| Runtime read adapter | `src/features/estimate/infrastructure/catalogue/` |
| Dry-run CLI | `scripts/catalogue-dry-run.ts` (tooling, not feature API) |
| Browser barrels | deliberately omit catalogue `.server` modules |

---

## Scope

### B2 may eventually cover (after gated slices)

```text
validated package draft ingestion
immutable revision + entry persistence
package and checksum lineage
draft state under existing status enum
publication transaction
retirement transaction
rollback as republication / re-pin of prior immutable revision
append-only audit events
concurrency control and idempotency
server-only write authority
database invariants and **mandatory** SECURITY DEFINER write RPCs
repository + application boundaries
independent verification (B2B, B2F)
```

### B2 must explicitly exclude

```text
production or supplier catalogue acquisition
source-specific transformation adapters / scraping
runtime reader activation (switching product to published rates)
estimate-builder integration
automatic repricing of existing estimates
UI administration for catalogue publish
scheduled publication / background ingestion
4C2F reader cutover
lawful production rate content approval (remains 4C2E data-gate)
```

---

## Explicit exclusions (this document and B2 programme)

```text
no SQL migrations in B2A
no live Supabase / production / preview database access in B2A
no generated-type regeneration in B2A
no importer/publisher implementation in B2A
no production or licensed catalogue rows
no CLI write modes on catalogue-dry-run
no estimate-builder or ROI changes
```

---

## Ownership decision

### Choice

[Reasoned recommendation] **Hybrid ownership** matching the existing read path:

| Concern | Owner |
| --- | --- |
| Pure package validation / normalisation / checksums | `packages/services/src/measured-boq/catalogue/` (**unchanged pure**) |
| DB write orchestration, draft/publish/retire | `src/features/estimate/infrastructure/catalogue/` new `*.server.ts` writers |
| Application use cases | `src/features/estimate/application/measuredBoq/` new `*.server.ts` |
| Ops entrypoint | **New** `scripts/` module (e.g. `catalogue-persist.ts`) — **not** `catalogue-dry-run.ts` |
| Product server functions (if ever in-app) | `src/features/estimate/presentation/serverFns.ts` pattern |
| DB schema / triggers / RLS | `supabase/migrations/` (B2C+) |

### Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| Put writers in `packages/services` | Violates pure service boundary; services must stay DB-free |
| Put writers in `packages/integrations` | Package is a stub; no multi-owner reuse demonstrated |
| Extend dry-run CLI with write modes | Explicitly forbidden by B1 contract and invariants |
| New generic shared package | Premature; single owner (estimate) today |

### Proposed module tree

```text
packages/services/src/measured-boq/catalogue/     # pure B1 (no DB)
scripts/catalogue-dry-run.ts                     # read-only forever
scripts/catalogue-persist.ts                     # [Proposed B2] ops CLI only
src/features/estimate/
  application/measuredBoq/
    ingestCatalogueDraft.server.ts               # [Proposed]
    publishCatalogueRevision.server.ts           # [Proposed]
    retireCatalogueRevision.server.ts            # [Proposed]
    rollbackCataloguePublication.server.ts       # [Proposed]
  infrastructure/catalogue/
    measuredBoqCatalogue.repository.server.ts    # existing READ
    measuredBoqCatalogueWrite.repository.server.ts  # [Proposed WRITE]
  presentation/serverFns.ts                      # optional later in-app gates
tests/invariants/
  catalogue-persist-boundary.test.ts             # [Proposed]
supabase/migrations/
  <timestamp>_measured_boq_catalogue_persist_*.sql  # [Proposed B2C]
```

### Import-direction diagram

```text
ops CLI (scripts/catalogue-persist.ts)
  │  dynamic / static import of server application only
  ▼
application/measuredBoq/*Catalogue*.server.ts
  │  runCatalogueDryRun / validateCatalogueSnapshot  ──►  @repo/services (pure)
  │  write ports
  ▼
infrastructure/catalogue/*Write*.repository.server.ts
  │  createServiceRoleSupabase  ──►  src/platform/supabase/service.server.ts
  │  rpc(ingest|publish|retire|rollback_…)  ──►  SECURITY DEFINER (mandatory)
  ▼
PostgreSQL measured_boq_catalog_* (+ packages/events)

FORBIDDEN:
  packages/services ──X──► supabase / feature infra
  scripts/catalogue-dry-run ──X──► write / service_role
  routes / browser ──X──► write repository (static)
  routes ──X──► database adapters directly
```

---

## Target module boundaries

### Requirements (non-negotiable)

1. B1 pure package logic remains database-independent.
2. B2 write orchestration consumes B1 outputs only after `ok: true` (plus policy gates).
3. Product/runtime code must not import CLI modules.
4. Routes must not import database adapters directly.
5. Write authority remains server-only (`*.server.ts` + service_role / SECURITY DEFINER).
6. No new generic shared package without demonstrated multi-owner reuse.

### Public feature API (future)

[Proposed B2 design] Prefer exporting **application result types** and server functions only — not raw repository clients. Browser barrels continue to omit write and load `.server` modules until a separately authorised UI phase.

---

## Persistence model

### Concepts required

| Concept | Decision | Rationale |
| --- | --- | --- |
| Catalogue source | **Column + package metadata**, not separate multi-tenant source table in B2 | Single measured-BOQ product catalogue today; `source_id` text on package/revision is enough |
| Package ingestion identity | **New table** `measured_boq_catalog_packages` | Holds input checksum, raw artifacts, B1 report summary; enables idempotency without mutating revision content |
| Immutable catalogue revision | **Reuse** `measured_boq_catalog_revisions` | Already correct natural key + lifecycle |
| Canonical entries | **Reuse** `measured_boq_catalog_entries` | Already draft-only + frozen when published |
| Publication event | **Status transition + audit event** | No separate publication-pointer table |
| Retirement event | **Status transition + audit event** | Same |
| Active-publication pointer | **Do not introduce** in B2 | Exact-pin model is repository-confirmed and safer |
| Audit/event record | **New table** `measured_boq_catalog_events` | Append-only ops evidence |

### Reused table: `measured_boq_catalog_revisions`

| Field | Spec |
| --- | --- |
| purpose | Immutable revision header for measured-BOQ catalogue |
| owner | Platform/DB + estimate write repository |
| primary key | `id uuid` |
| business identity | `catalog_revision text` UNIQUE |
| foreign keys | none today; [Proposed] optional `package_id` → packages |
| required columns (existing) | see migration §1 (`status`, `schema_version`, `currency`, `vat_basis`, `regional_basis`, `source_description`, `entry_count`, `content_checksum`, `effective_from`, `created_by`, timestamps) |
| optional columns (existing) | `release_notes`, `published_at`, `retired_at` |
| [Proposed B2C] additive columns | `source_id text`, `licence_status text`, `production boolean`, `input_checksum text` (**non-unique denormalised**), `normaliser_version text`, `package_id uuid` (nullable FK to packages, set after package insert inside same RPC), `published_by text`, `retire_reason text` |
| unique constraints | `catalog_revision` only (existing). **Do not** UNIQUE `input_checksum` on this table |
| check constraints | existing status/timestamp/checksum grammar; [Proposed] `licence_status IN ('synthetic','rights_unverified','approved')` once product expands statuses |
| indexes | existing `(status, effective_from)`; [Proposed] `(input_checksum)`, `(content_checksum)` non-unique lookup |
| immutability | existing trigger: published/retired content frozen; draft editable |
| delete policy | draft may delete (CASCADE entries); published/retired delete blocked |
| RLS posture | enabled; no auth policies; service_role only |
| audit fields | `created_by`, `created_at`, `updated_at`, lifecycle timestamps; events table for full trail |

### Reused table: `measured_boq_catalog_entries`

| Field | Spec |
| --- | --- |
| purpose | Per-rate catalogue lines for a revision |
| business identity | `(catalog_revision, rate_key)` |
| foreign keys | → `measured_boq_catalog_revisions(catalog_revision)` ON DELETE CASCADE |
| mutability | **draft parent only** (existing trigger + FOR SHARE) |
| delete policy | CASCADE with draft parent delete; blocked when parent published/retired |
| RLS | service_role only |

No column redesign required for B2 core; writers must map B1 normalised entries into existing columns (`rate_key`, `display_name`, `trade_or_domain`, `unit`, `cost_type`, `base_unit_rate`, …).

### Proposed table: `measured_boq_catalog_packages`

| Field | Spec |
| --- | --- |
| purpose | **Sole owner** of package artifact identity, raw retention, B1 report summary |
| owner | estimate catalogue write boundary |
| primary key | `id uuid` |
| business identity | `input_checksum` **UNIQUE (global)** — only place for this uniqueness |
| foreign keys | `revision_id uuid NOT NULL REFERENCES measured_boq_catalog_revisions(id)` with **ON DELETE CASCADE** (draft purge); immutability trigger still blocks delete of published/retired parents |
| required columns | `input_checksum`, `content_checksum`, `revision_id`, `catalog_revision` (denormalised label for ops queries, not a second identity authority), `source_id`, `licence_status`, `production`, `manifest_version`, `normaliser_version`, `manifest_text`, `snapshot_text`, `report_json`, `created_by`, `created_at` |
| optional | `expected_input_checksum`, `expected_output_checksum`, `correlation_id` |
| unique | `input_checksum` only (do **not** also UNIQUE on revisions) |
| check | checksum grammar; `production` boolean; size bounds on texts |
| immutability | **append-only row** after insert (no UPDATE of artifact bytes/checksums) |
| delete policy | CASCADE when parent **draft** revision deleted; published/retired parent delete remains blocked by revision immutability trigger, so packages for those statuses are retained |
| RLS | service_role only; same private pattern |
| audit | creation only; subsequent lifecycle via events |
| insert order | **single SECURITY DEFINER RPC** inserts revision → entries → package → event in one function body (no multi-call PostgREST) |

**Identity ownership rule:** `input_checksum` uniqueness lives **only** on packages. Revisions may denormalise `input_checksum` as a non-unique lookup column, but must not declare a second UNIQUE constraint.

### Proposed table: `measured_boq_catalog_events`

| Field | Spec |
| --- | --- |
| purpose | Append-only business audit of catalogue ops |
| primary key | `id uuid` |
| business identity | event id + `(catalog_revision, event_type, created_at)` for queries |
| required columns | `event_type`, `catalog_revision`, `input_checksum`, `content_checksum`, `actor`, `created_at`, `payload_json` |
| optional | `correlation_id`, `reason`, `result` (`accepted`/`rejected`/`replay`) |
| unique | none (duplicates prevented by app + idempotency keys on ops tables if needed) |
| immutability | no UPDATE/DELETE grants (trigger or REVOKE) |
| RLS | service_role only |
| event types | see Audit section |

### Active pointer

[Proposed B2 design] **No active-revision table**. Multiple published revisions may coexist. Authority consumers continue to require an **exact** `catalog_revision` pin (existing loader + `assertSingleCatalogRevision`).

---

## Raw artifact retention

### Options compared

| Model | Reproducibility | Audit | Byte checksum verify | Storage | ACL | Transaction | Complexity |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1. Bytes in PostgreSQL | High | High | High | Limited | service_role only | Single TX | Low–med |
| 2. Object storage + DB metadata | High | High | High | Scalable | Bucket policies | Split TX risk | High |
| 3. No retention after validation | Low | Low | Only re-upload | Minimal | N/A | Simple | Low |

### Decision

[Reasoned recommendation] **Model 1 — store original `manifest_text` and `snapshot_text` in PostgreSQL** on `measured_boq_catalog_packages`, with size CHECKs (e.g. each ≤ 8 MiB UTF-8; tune in B2C).

Rationale:

* Catalogue packages are small relative to photo media (existing storage buckets are for photos, not private rate packages).
* Single-transaction draft insert can bind revision + entries + package + event.
* Byte-level recompute of `input_checksum` and content checksum remains possible without external systems.
* Access stays on the same service_role private surface as catalogue tables.

Rejected:

* Object storage for B2 core — no existing catalogue bucket; dual-write TOCTOU; extra policies.
* No retention — fails independent verification and ops audit for publication disputes.

[Unresolved product policy] Long-term legal retention of licensed supplier packages may later require encrypted object storage; default remains PG text until product/legal mandates otherwise.

---

## Identity and checksum semantics

### Roles

| Identity | Role | Mutability after publish |
| --- | --- | --- |
| `inputChecksum` | Byte identity of raw MANIFEST+snapshot pair (`mboq-package-v2`) | Immutable |
| `outputChecksum` / `content_checksum` | Canonical validated catalogue content identity | Immutable |
| `catalogRevision` | Human/product revision label (`mboq-YYYY.MM.DD[.N]`) | Immutable string; status may change |
| `sourceId` | Logical source identifier from MANIFEST | Immutable on package/revision |
| `package id` | Surrogate uuid for package row | Immutable |
| `publication identity` | `(catalog_revision, published_at, content_checksum)` via status + audit | No separate mutable pointer |

### Uniqueness

| Value | Scope | Rule |
| --- | --- | --- |
| `input_checksum` | **Global unique on packages only** | Exact package re-import is idempotent |
| `content_checksum` | **Unique per revision row** (label-bound by B1) | Different labels always differ; not a cross-label equality key |
| `catalog_revision` | **Global unique** (existing) | Label reuse with different package bytes is a hard conflict |

### Rates-identical, different labels (re-label myth)

[Repository-confirmed] Because B1 hashes `catalogRevision` into `content_checksum`, **two labels never share `content_checksum`.**

[Proposed B2 design] A “re-label” of the same rate rows is simply a **new independent package + revision**:

* new `catalog_revision` → new B1 `outputChecksum` → new `content_checksum`;
* new `input_checksum` (artifacts differ at least in MANIFEST revision fields);
* no special “shared content” join is required or permitted.

### Same revision label, different package

Always **`revision_conflict`** unless `input_checksum` matches the stored package (idempotent replay).

### Checksum updates

Checksum fields are **never updated** after insert.

[Repository-confirmed] Existing immutability trigger freezes a **hard-coded column set only on published→retired**, and allows draft→published without a general freeze list. **B2C must rewrite** `measured_boq_catalog_revision_immutable()` so that:

* any status other than `draft` freezes lineage/content columns (including all B2C additive columns);
* draft→published may change only lifecycle fields: `status`, `published_at`, `published_by`, `updated_at`;
* published→retired may change only: `status`, `retired_at`, `retire_reason`, `updated_at`;
* retired is fully immutable.

Do **not** claim the pre-B2C trigger already freezes content at publish.

### Idempotency decision table

| Existing state | Incoming package | Required result |
| --- | --- | --- |
| Nothing exists | Valid new package (`ok:true`, non-production under current B1) | RPC creates revision + entries + package + `ingestion_accepted` |
| Same `input_checksum` | Same labels and digests | **Idempotent replay**: return existing ids; no mutation; `ingestion_replay` |
| Different `input_checksum` | Same `catalog_revision` label | **`revision_conflict`** — reject |
| Different `input_checksum` | New `catalog_revision` (even if rates look similar) | New independent draft (new content_checksum by B1) |
| Same source and revision label | Different canonical output | **`revision_conflict`** — reject |
| Retired revision re-imported | Exact same package (`input_checksum`) | **Idempotent replay**; do not unretire |
| Published revision imported again | Exact same package | **Idempotent replay**; publish is no-op / `publication_replay` |

---

## Draft-ingestion flow

### Conceptual flow

```text
package artifacts (bytes only; no absolute paths stored)
  → B1 runCatalogueDryRun (application/ops pure precheck)
  → require report.ok === true (blocks production:true under current B1)
  → apply B2 policy gates (licence class)
  → optional expected checksum confirmation
  → authorise ops principal (server-bound)
  → rpc('ingest_measured_boq_catalog_draft', …)   -- single SECURITY DEFINER body
       lock / unique input_checksum
       if replay: return existing
       insert revision draft + entries + package + event
  → map typed RPC result
```


### Policy matrix (aligned with current B1)

[Repository-confirmed] B1 `runCatalogueDryRun` rejects `production: true` with `PRODUCTION_BLOCKED` (`ok:false`). Therefore the B2 compose-B1 path **cannot ingest production:true packages** without a separately authorised B1 policy change.

| Package class | Draft ingest | Publish | Notes |
| --- | --- | --- | --- |
| `ok:false` (any) | **No** | N/A | ops logs only |
| `production:true` | **No** under current B1 | **No** | data-gate + B1 block |
| `licence_status=synthetic`, `production:false`, `ok:true` | **Yes** | **Yes** (plumbing / non-prod) | required so post-publish `purpose:'authority'` verify works without lawful rates |
| `licence_status=rights_unverified`, `production:false`, `ok:true` | **Yes** | **No** | technical draft only; default deny publish |
| Future approved commercial licence | Deferred product/legal | Deferred | not implemented in B2; needs enum expansion + fail-closed RPC checks |

Additional gates:

| Gate | Rule |
| --- | --- |
| Warnings on ok report | Persist in `report_json`; **default allow** draft and synthetic publish when `ok:true` |
| Raw B1 report | Persist full JSON on package row |
| Filesystem paths | **Never store** absolute paths, home dirs, or local package roots |

### Draft rewrite policy

[Proposed B2 design] For an existing **draft** with the same `catalog_revision` and **same** `input_checksum`: idempotent no-op.
For existing **draft** with same `catalog_revision` and **different** `input_checksum`: reject (`revision_conflict`).
Do not silently overwrite draft content under a reused label.

### CLI separation

```text
scripts/catalogue-dry-run.ts     — remain read-only forever
scripts/catalogue-persist.ts     — [Proposed] separate B2 ops entry
application use case             — server-only; reusable by CLI and future serverFn
```

---

## Publication state machine

### Persistent revision states (existing SQL enum)

| State | Entry conditions | Mutability | Visibility (loader) | Actor | Outgoing |
| --- | --- | --- | --- | --- | --- |
| `draft` | Successful ingest | Full edit of entries (draft only) | Not readable for authority/reproduction | ops write | → `published` |
| `published` | Publish TX success | Content frozen | authority + reproduction | ops publish | → `retired` |
| `retired` | Retire TX success | Fully frozen | reproduction only | ops retire | **none** |

### Soft states (events/results only — not SQL enums)

```text
validated   → B1 ok (precondition)
rejected    → failed transition / validation (event only)
superseded  → prior published retired because a newer revision published under ops policy (event + retire of prior if explicit)
failed      → TX abort (ops log)
```

### Transition table

| Current | Command | Preconditions | Transaction result | Audit event |
| --- | --- | --- | --- | --- |
| (none) | `ingestDraft` | B1 ok + policy | package + draft revision + entries | `ingestion_accepted` |
| draft | `ingestDraft` same input | same checksums | no-op / return existing | `ingestion_replay` |
| draft | `publish` | B1 re-validate; publishable rights; entry_count match; not rights_unverified/synthetic for production intent | status=published; published_at set | `publication` |
| published | `publish` same revision | already published; checksums match | no-op | `publication_replay` |
| published | `retire` | reason required | status=retired; retired_at set | `retirement` |
| published | `rollbackTo(prior)` | prior published or re-publishable; not mutate content | retire current if required; ensure prior remains published | `rollback` |
| retired | any mutate content | — | reject | `rejected_transition` |
| published | → draft | — | **Forbidden** | `rejected_transition` |
| retired | → published | — | **Forbidden** (use new revision or leave prior published) | `rejected_transition` |

### Explicit decisions

| Question | Decision |
| --- | --- |
| Published → draft? | **No** |
| Retired republish? | **No** — create/publish a **new** revision label if content must return |
| Publication model | Status field update + immutable content + audit event |
| Only one published revision? | **No global single-active** — multiple published allowed; consumers pin exact revision |
| Active scope | Product pin / estimate header — not catalogue-global |
| Atomic replace of “current”? | Not modelled as pointer flip; optional **explicit** retire of named prior revision in same TX if operator requests supersession |

---

## Atomic write transactions (mandatory model)

### PostgREST / supabase-js constraint

[Repository-confirmed] `createServiceRoleSupabase()` is plain `@supabase/supabase-js`. It does **not** provide multi-statement `BEGIN`/`COMMIT` or `SELECT … FOR UPDATE` across sequential `.from()` calls. The repository’s only multi-row atomic write pattern is **SECURITY DEFINER RPC** (`persist_category_engine_estimate`).

[Proposed B2 design — non-negotiable]

```text
All catalogue writes (draft ingest, publish, retire, rollback, draft purge)
MUST execute inside a single PostgreSQL session function body:

  SECURITY DEFINER RPC
  SET search_path = ''
  GRANT EXECUTE TO service_role ONLY
  REVOKE FROM PUBLIC, anon, authenticated

supabase-js multi-call DML is REJECTED for every B2 write path.
```

Application / ops CLI may only:

```text
createServiceRoleSupabase()
  → rpc('ingest_measured_boq_catalog_draft' | 'publish_…' | 'retire_…' | 'rollback_…', args)
  → map typed result
```

Optional pure revalidation may run in TypeScript **before** the RPC for fast-fail UX, but **authority checks and locks run again inside the RPC**.

### Publish RPC boundary (sketch of steps inside one function)

```text
-- NON-EXECUTABLE SKETCH
LOCK revision FOR UPDATE
assert status = draft OR (published AND checksums match → replay)
recompute content from stored entries OR re-validate payload args
assert content_checksum + entry_count
assert publishable policy (synthetic+production:false allowed; rights_unverified denied; production:true denied)
UPDATE lifecycle columns only (status, published_at, published_by, updated_at)
INSERT event publication
optional: retire named prior revision under same lock set
return revision ids + checksums
```

Post-RPC (application, best effort): `loadMeasuredBoqCatalogueSnapshot({ purpose: 'authority' })`.

### Concurrency mechanism recommendation

| Mechanism | Decision |
| --- | --- |
| SECURITY DEFINER RPC with internal `FOR UPDATE` | **Mandatory** for all write ops |
| Unique partial index one-published | **Reject** — multi-published exact-pin model |
| Advisory lock | Optional inside RPC for multi-revision supersession sets |
| App multi-step PostgREST DML | **Rejected for all slices** |
| Parent data-gate fail-closed publisher | **Mandatory for B2E DoD** — lifecycle status changes only via publisher RPCs, not ad-hoc table UPDATE |

### Fail-closed service_role narrowing (B2E)

[Reasoned recommendation] Align with `4c2e-production-catalogue-data-gate-plan.md` controlled publisher:

* Prefer triggers or grants so lifecycle columns (`status`, `published_at`, `retired_at`) cannot be flipped by ad-hoc `service_role` UPDATE outside RPC context (e.g. require `current_setting('mboq.catalog_rpc', true)` set inside RPC).
* B2C may land tables first; **B2E cannot merge** until lifecycle mutations are RPC-gated.
* JWT roles remain without any catalogue DML.

### Actor binding inside RPC

* RPC arguments must **not** accept a free-form spoofable client actor as authoritative.
* CLI/server sets a session GUC or passes ops principal that the RPC rebinds to `created_by` / `published_by` / `events.actor` from **server-controlled** values (env service principal id + optional reason).
* Residual risk of superuser/raw SQL remains operational; B2F probes cover RPC path spoof rejection.

### Idempotent repeated publication

If status already `published` and checksums match: return success with `already_published` / `publication_replay`; no timestamp rewrite.

### Stale-command detection

Commands carry `expected_content_checksum` and optional `expected_status`. Mismatch → `stale_state` / `publication_conflict`.

---

## Retirement

| Question | Decision |
| --- | --- |
| Who may retire | Ops actor with service_role tooling (or future requireAdmin + RPC); not end users |
| Retire active without replacement | **Allowed** — there is no single global active; estimates already pin revisions |
| Reason required | **Yes** (`retire_reason` text + event payload) |
| Reversible | **No** reverse to published; rollback uses other published revisions |
| Retired entries queryable | **Yes** via reproduction loader |
| Entry rows on retire | **Unchanged** — only revision status/timestamps |
| Deletes | **None** for published/retired |
| Draft delete | **Allowed** for abandoned drafts under retention |
| Draft retention | Soft policy: drafts older than N days may be purged by ops job (not auto in B2); packages with only draft links may be removed with draft |

---

## Rollback

### Compared options

| Option | Verdict |
| --- | --- |
| 1. Ensure prior revision remains published + optionally retire current | **Primary** when target is still `published` |
| 2. Move active pointer | **N/A** — no pointer in B2 |
| 3. Clone prior package bytes into a **new** revision label | **Required** when target is `retired` or a new pin label is needed |
| 4. Mutate / unretire current or prior revision | **Rejected** |

### Split operations (avoid overloaded “rollback”)

| Op | Behaviour |
| --- | --- |
| `retireCatalogueRevision` | published→retired only; reason required |
| `rollbackCataloguePublication` | Retire `fromRevision` (optional) **iff** `toRevision.status = published` and `expectedToChecksum` matches; never unretires |
| `republishAsNewRevision` | Load stored package bytes (or operator-supplied identical artifacts) for a prior revision; create **new** `catalog_revision` + new B1 digests via draft ingest RPC; then publish RPC |

Error: `rollback_target_not_published` when `toRevision` is retired/draft — operator must use `republishAsNewRevision`.

Estimates continue to pin exact revisions; none of these ops rewrite historical estimate rows (out of scope).

---

## Concurrency and idempotency

| Scenario | DB constraint | Lock / TX (inside RPC) | App response | Retry | Audit |
| --- | --- | --- | --- | --- | --- |
| Two imports same package | UNIQUE packages.`input_checksum` | unique insert race | winner creates; loser replay | safe | accepted + optional replay |
| Same revision label, different bytes | UNIQUE `catalog_revision` | FOR UPDATE in ingest RPC | `revision_conflict` | not safe to force | `rejected_transition` |
| Two simultaneous publishes | status checks | FOR UPDATE in publish RPC | one publish; other replay/conflict | safe if same checksum | one publication |
| Publish vs retire race | status machine | FOR UPDATE | second sees new status | map to conflict | events ordered |
| Rollback vs publish | status + checksums | FOR UPDATE both rows | conflict if stale | client refresh | reject |
| Network loss after commit | unique keys | — | client retries → replay | safe | replay event |
| Stale ops UI | expected checksum/status | — | `stale_state` | refresh | reject |
| Duplicate events | optional `(correlation_id, event_type)` unique | inside RPC | de-dupe | safe | single durable event |

---

## Access control and RLS

### Posture (preserve)

```text
ENABLE RLS on all catalogue* tables
REVOKE ALL FROM PUBLIC, anon, authenticated
GRANT DML TO service_role only
No browser policies for B2
Immutability triggers apply even to service_role
```

### Actor types

| Actor | Read draft | Create draft | Publish | Retire | Roll back | Read history (published/retired meta) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| End user (JWT) | no | no | no | no | no | no (no table access) |
| Admin JWT alone | no | no | no | no | no | no |
| Ops + service_role tooling | yes | yes | yes* | yes | yes | yes |
| Future serverFn admin + RPC | via RPC | via RPC | via RPC | via RPC | via RPC | via RPC |
| B1 dry-run CLI | n/a | no | no | no | no | n/a |

\*Publish still blocked by policy for synthetic / rights_unverified / unapproved production.

### Privileged write mechanism

[Reasoned recommendation]

1. **All B2 writes:** SECURITY DEFINER RPCs only (`GRANT EXECUTE TO service_role`); application/ops CLI call `rpc(...)` via `createServiceRoleSupabase()`.
2. **Actor:** rebound inside RPC from server-controlled principal; never client-trusted free text as authority.
3. **Lifecycle fail-closed (B2E DoD):** status/timestamp flips only via RPC context; ad-hoc table UPDATE disallowed.
4. **Do not** grant authenticated INSERT/UPDATE on catalogue tables for B2.

### Spoofing prevention

* Client cannot set audit actor: RPC rebinds actor from server principal / session GUC.
* Client cannot publish: no authenticated policies; no publish RPC grant to authenticated.
* Residual superuser/raw SQL risk is operational; B2F probes cover RPC path spoof rejection.

---

## Runtime-reader separation

B2 completion **does not** authorise:

```text
switching application default reads to “latest published”
replacing dormant loader activation in product routes
activating published revisions in estimate builders
repricing existing estimates automatically
UI catalogue selection
cache invalidation product work for catalogue UX
```

### Handoff boundary (future, separately authorised)

```text
B2 closes when drafts can be ingested, published, retired, rolled back,
audited, and verified under service_role tooling.

Runtime activation remains a later programme gate (data-gate + 4C2F-class
reader cutover) that requires:
  - lawful published content
  - explicit product pin policy
  - separate implementation ticket
```

Existing `loadMeasuredBoqCatalogueSnapshot` remains the **only** read adapter; B2 may call it for post-publish verification only.

---

## Database invariants

| Invariant | Enforced by |
| --- | --- |
| Revision grammar / uniqueness | DB CHECK + UNIQUE |
| Entry identity uniqueness | DB UNIQUE |
| Content checksum format | DB CHECK + B1 recompute |
| Input checksum uniqueness | DB UNIQUE (proposed) |
| Draft-only entry mutation | DB trigger + FOR SHARE |
| Published content freeze | DB trigger |
| Status/timestamp coupling | DB CHECK |
| Unit / cost_type allow-list | DB CHECK + B1 validation |
| Decimal representation | B1 normaliser + DB numeric(14,4) |
| Production/licence publish gates | Application + optional RPC (not weak app-only long-term) |
| One global active | **Not required** — exact pin |
| Audit append-only | REVOKE UPDATE/DELETE on events |
| Actor integrity | Server binding; not client body |
| B1 remains DB-free | Architecture invariant tests |
| CLI remains read-only | Architecture invariant tests |

---

## Audit and provenance

### Append-only event types

```text
ingestion_requested   (optional; ops log may suffice)
ingestion_accepted
ingestion_replay
ingestion_rejected    (prefer ops log if no row created)
publication
publication_replay
retirement
rollback
rejected_transition
```

### Event payload (no secrets / paths)

```text
actor
timestamp
catalog_revision
input_checksum
content_checksum
reason?
correlation_id?
result
policy flags (licence_status, production)
```

### Invalid validation attempts

[Proposed] **Do not** insert package/revision rows for `ok:false`. Emit structured ops logs only. Optional future `ingestion_rejected` without artifacts if product requires a DB trail — default off to avoid storing attacker-controlled blobs.

---

## Error contracts

| Category | Client-safe? | Notes |
| --- | --- | --- |
| `validation_rejected` | yes (sanitised codes) | B1 issues summarised |
| `rights_not_publishable` | yes | rights_unverified / synthetic |
| `production_policy_rejected` | yes | production:true blocked by data-gate |
| `revision_conflict` | yes | label/content clash |
| `checksum_conflict` | yes | expected vs actual |
| `idempotent_replay` | yes | success with existing ids |
| `publication_conflict` | yes | wrong status / concurrent |
| `no_active_revision` | yes if used | only if a future pin API needs it; not B2 core |
| `already_published` | yes | replay |
| `already_retired` | yes | |
| `unauthorised` | yes | missing ops identity |
| `database_failure` | limited | generic message |
| `unexpected_internal_failure` | limited | no stack to client |

Never surface raw PostgreSQL errors, absolute paths, or service-role material.

---

## Migration strategy

### Ordering (design only — no execution in B2A)

1. **B2C schema + DB write surface**
   * ADD revision columns (non-unique `input_checksum` denorm allowed).
   * CREATE packages (UNIQUE `input_checksum`) + events.
   * **Rewrite** `measured_boq_catalog_revision_immutable()` for additive freeze rules.
   * CREATE SECURITY DEFINER RPCs for draft ingest (even if app CLI lands in B2D) **or** land RPC stubs + pgTAP contracts in B2C and complete bodies by B2D — **B2D cannot merge without live ingest RPC**.
   * RLS + REVOKE/GRANT service_role; append-only events.
   * pgTAP for immutability, privacy, unique input checksum, draft purge order.
   * Do **not** seed rows; do **not** auto-publish.
2. Refresh `packages/supabase` generated types (authorised script only).
3. **B2D** app/ops draft path calling ingest RPC only (no multi-call DML).
4. **B2E** publish/retire/rollback RPCs + fail-closed lifecycle gating + policy matrix.
5. **B2F** combined verification (must FAIL if any multi-step PostgREST write path exists).
6. **B2G** guarded merge.

### Compatibility

* Existing loader continues to work (additive columns ignored by SELECT list).
* No destructive change to current empty production catalogue tables.
* Rollback of migration deployment: reverse migration only if no published rows exist; otherwise expand-only forward fixes.

---

## Test strategy

### Domain / application

* valid draft creation from synthetic package
* invalid B1 report rejected (no rows)
* idempotent exact replay
* revision-label checksum conflict
* same canonical output, new revision label
* rights_unverified draft allowed; publish denied
* synthetic publish denied
* publication preconditions / retirement / rollback
* stale expected checksum conflicts

### Database / integration

* uniqueness of `input_checksum` and `catalog_revision`
* immutable published rows
* multi-published revisions still allowed
* transaction rollback on mid-failure
* concurrent publish serialisation
* RLS: authenticated SELECT fails
* events append-only
* actor not client-spoofable in RPC path

### Architecture invariants

* B1 pure modules remain free of supabase/fs write
* CLI dry-run remains read-only
* write adapter not importable from browser barrels
* publication authority server-only
* no route→DB write static imports
* no production seed in migrations
* no runtime-reader activation markers

### Negative probes

* direct client publication attempt
* entry mutation on published parent
* delete published revision
* publish unverified rights
* reuse revision label with different checksum
* second writer spoofing `created_by`
* inventing `latest` alias

---

## Architecture invariants (future seals)

| Seal | Assertion |
| --- | --- |
| B1 purity | no `@supabase` / service_role / write FS in pure catalogue |
| Dry-run CLI | no write modes; realpath containment retained |
| Write isolation | `catalogueWrite` only under `*.server.ts` |
| No browser service role | env invariant |
| No active-alias | loader still rejects `latest`/`current` |

---

## Observability

| Channel | Content |
| --- | --- |
| Structured server logs | correlation id, revision, checksums, result codes — no raw rate dumps |
| Audit table | durable business events |
| Metrics (future) | ingest success/fail, publish latency, conflict counts |
| Alerting | publish failure spikes; repeated conflict storms |
| Forbidden | secrets, local absolute paths, automatic multi-publish retries |

---

## Threat and failure analysis

| Threat / failure | Mitigation | Verification |
| --- | --- | --- |
| Malformed package | B1 validation gate; no persist on fail | unit + process tests |
| Checksum substitution | recompute inside TX from stored bytes; expected checksum args | DB integration |
| Revision-label collision | UNIQUE + conflict error | constraint tests |
| Duplicate import | UNIQUE input_checksum + replay | concurrency tests |
| Unauthorised publication | no auth grants; ops-only tooling; policy deny | RLS probes |
| Privilege escalation | no authenticated catalogue DML; role trigger on profiles | existing security migrations |
| Actor spoofing | server-bound actor; ignore client actor field | negative probes |
| Dual publish race | FOR UPDATE | concurrent tests |
| Partial transaction | single TX / RPC | abort tests |
| Stale publish request | expected checksum/status | app tests |
| Accidental deletion | immutability triggers | pgTAP |
| Accidental production activation | no runtime cutover in B2; production publish blocked | invariants + data-gate |
| Supplier data in synthetic path | production/licence gates | policy tests |
| Unpublished data to clients | no auth SELECT | RLS probes |
| Service-role secret in client | env + bundle invariants | existing CI |

---

## Decision log

| Decision | Chosen approach | Alternatives rejected | Evidence | Consequence |
| --- | --- | --- | --- | --- |
| Ownership | Estimate feature infra + pure services | services DB writers; integrations package | loader ownership; pure barrel | clear import graph |
| Table model | Reuse revisions/entries; add packages + events | greenfield tables | 4C2C foundation | additive B2C |
| Package identity owner | packages table UNIQUE `input_checksum` | dual UNIQUE on revisions | avoid two sources of truth | single idempotency key |
| Raw artifacts | PostgreSQL text on packages | object storage; no retention | small packages; RPC TX | size limits |
| Content checksum | label-bound (B1 includes catalogRevision) | cross-label shared content hash | `checksum.ts` | re-label = new revision digests |
| Revision identity | existing `catalog_revision` grammar | uuid-as-identity | migration + loader | keep mboq- label |
| Draft model | existing `status=draft` | new SQL enums | SQL CHECK | fewer migrations |
| Publication model | status + audit; multi published | single active pointer | loader exact pin | no latest alias |
| One-active policy | **None** | partial unique published | no such index | estimates pin explicitly |
| Atomic writes | **Mandatory SECURITY DEFINER RPC** | supabase-js multi-call TX | category authority RPC; no client TX API | B2D/B2E hard DoD |
| Concurrency | `FOR UPDATE` **inside RPC** | app-level locks only | entry FOR SHARE pattern | serialised publish |
| Fail-closed publisher | RPC-only lifecycle columns | open service_role status UPDATE | parent data-gate plan | B2E hard DoD |
| Privileged surface | service_role EXECUTE on RPCs only | authenticated policies | foundation RLS | JWT cannot write |
| Immutability evolution | B2C rewrite freeze trigger | claim existing trigger freezes on publish | foundation SQL column allow-list | additive columns safe |
| Synthetic publish | allow for plumbing verify | never publish synthetic | loader authority needs published | non-prod test path |
| production:true | block at B1 ingest | draft then deny publish only | B1 PRODUCTION_BLOCKED | no production drafts under current B1 |
| rights_unverified | draft yes / publish no | publish with warning | B1 + data-gate | technical store only |
| Rollback | split retire / rollback / republishAsNewRevision | unretire or mutate | immutability triggers | clone for retired targets |
| Audit storage | events table | files only | durable ops evidence | B2C schema |
| Invalid attempts | do not persist packages | store all rejects | avoid attacker blobs | ops logs only |
| Runtime-reader | separated | activate on B2 merge | 4C2E-A / B1 | B2 ≠ 4C2F |

---

## Deferred product decisions

| Item | Decision owner | Information required | Why blocking for some work | Default safe behaviour |
| --- | --- | --- | --- | --- |
| Lawful production rates | Product + legal | Approved licence + redistribution rights | Cannot publish `production:true` | Block production publish indefinitely |
| Expanding `licence_status` beyond synthetic/rights_unverified | Product + legal | Approved enum values | Publish gate matrix incomplete for commercial sources | Only synthetic/rights_unverified recognised; only drafts for rights_unverified |
| Whether warnings block publish | Product | Tolerance for unit-alias warnings | Publish precondition | Allow publish when `ok:true` even with warnings |
| In-app admin UI for catalogue | Product | UX + auth model | Not needed for ops CLI path | Ops CLI only |
| Long-term encrypted object storage for licensed packages | Security + legal | Retention/classification | Storage model change | Keep PG bytes with size cap |

These do **not** block designing or implementing **synthetic draft ingest**, schema lineage, audit, or publish plumbing with **policy deny** for non-publishable packages.

---

## B2 execution slices

### 4C2E-B2A — Persistence and Publication Planning

* **Objective:** this document.
* **Files:** `docs/architecture/4c2e-b2a-catalogue-persistence-publication-plan.md` only.
* **Exclusions:** all implementation.
* **Next:** B2B.

### 4C2E-B2B — Independent Verification of the B2 Plan

* **Objective:** challenge completeness, consistency, evidence fidelity.
* **Implementation:** none.
* **Next:** authorise B2C only on PASS.

### 4C2E-B2C — Schema and Database-Invariant Implementation

* **Objective:** additive migrations for packages/events/columns; **immutability trigger rewrite**; RLS; pgTAP; draft-ingest RPC skeleton or full body.
* **DoD (hard):** rewritten freeze trigger covered by pgTAP for every new column; packages UNIQUE input_checksum; no seeds; no multi-call write documentation.
* **Authorised areas:** `supabase/migrations/`, `supabase/tests/database/`, generated types refresh if approved.
* **Exclusions:** app writers, CLI writers, production seeds, runtime activation, publish RPC lifecycle if deferred to B2E **only if** draft ingest RPC is already complete.

### 4C2E-B2D — Draft Persistence Application Boundary

* **Objective:** server-only draft ingest composing B1; ops CLI draft mode; idempotency via **ingest RPC only**.
* **DoD (hard):** zero multi-call PostgREST catalogue DML; synthetic draft works; production:true rejected by B1 before RPC; rights_unverified drafts allowed.
* **Authorised areas:** estimate application/infra catalogue write modules; new persist script; tests/invariants.
* **Exclusions:** publish/retire/rollback; dry-run CLI mutation; UI; production data.

### 4C2E-B2E — Publication, Retirement and Rollback Transactions

* **Objective:** publish/retire/rollback/republishAsNewRevision RPCs; fail-closed lifecycle; policy matrix; post-publish loader verify.
* **DoD (hard):** parent data-gate fail-closed publisher; synthetic publish allowed; rights_unverified publish denied; retired targets require clone path; no ad-hoc status UPDATE.
* **Exclusions:** runtime activation; builder integration; production:true lawful content without data-gate + B1 policy change.

### 4C2E-B2F — Combined Persistence Boundary Verification

* **Objective:** independent verify of B2C–E exact head; adversarial probes; purity seals.

### 4C2E-B2G — Guarded Merge and B2 Close-out

* **Objective:** merge only after B2F PASS; document residual non-goals (no 4C2F, no production rates).

---

## Definition of done

### B2A done when

* repository-grounded current-state audit complete;
* ownership, persistence, checksum, retention, state machine, TX, RLS, audit, migration, tests, threats, slices decided;
* no unresolved **implementation-critical** ambiguity (product-licence remains explicitly deferred with safe defaults);
* single planning document committed; no code/schema changes.

### B2 programme done when (future)

* synthetic draft ingest + publish plumbing work under policy denies for non-publishable packages;
* B1 unchanged and pure;
* dry-run CLI still read-only;
* no runtime activation;
* B2F PASS + guarded merge.

B2 is **not** complete at B2A.

---

## Independent review findings and resolutions

Independent architecture review of draft 4C2E-B2A.1 returned **FAIL**. Findings below were resolved in **4C2E-B2A.2** plan text (this document).

| # | Challenge | Severity | Resolution in 4C2E-B2A.2 |
| --- | --- | --- | --- |
| 1 | Non-atomic supabase-js multi-call TX | Blocker | Mandatory SECURITY DEFINER RPC for all writes; multi-call DML rejected |
| 2 | content_checksum re-label myth | Blocker | Document B1 label-bound checksum; re-label = new digests |
| 3 | Immutability trigger misstated | Blocker | Document real trigger; mandate B2C rewrite + freeze allow-lists |
| 4 | Dual UNIQUE input_checksum | Major | packages sole UNIQUE owner; revision denorm non-unique |
| 5 | Circular FKs / purge | Major | package → revision_id CASCADE; purge via draft parent delete |
| 6 | Open service_role lifecycle | Major | B2E fail-closed RPC-only status transitions |
| 7 | Incomplete rollback | Major | Split retire / rollback / republishAsNewRevision |
| 8 | Synthetic vs production policy | Major | Explicit matrix; synthetic publish allowed; production:true blocked at B1 |
| 9 | Actor spoofing | Major | RPC rebinds actor; GUC/server principal |
| 10 | Soft phase gates | Major | Hard DoDs on B2C/B2D/B2E |
| 11 | JWT RLS weak | N/A | Confirmed deny-by-default; not a defect |
| 12 | Runtime activation | Minor | Separation retained |
| 13 | Source coupling | Minor | measured-BOQ package persistence only |

Rejected finding: “must introduce single active revision pointer for B2.”
Reason: contradicts exact-pin loader contract and estimate provenance model; increases accidental activation risk.

Rejected finding: “store no raw artifacts.”
Reason: undermines checksum dispute resolution and independent verification.

---

## Non-executable design sketches

> **Non-executable design sketches — not migrations. Do not apply.**

```sql
-- SKETCH ONLY: additive revision columns (input_checksum NOT unique here)
-- ALTER TABLE public.measured_boq_catalog_revisions
--   ADD COLUMN IF NOT EXISTS source_id text,
--   ADD COLUMN IF NOT EXISTS licence_status text,
--   ADD COLUMN IF NOT EXISTS production boolean NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS input_checksum text,  -- denormalised, non-unique
--   ADD COLUMN IF NOT EXISTS normaliser_version text,
--   ADD COLUMN IF NOT EXISTS package_id uuid,
--   ADD COLUMN IF NOT EXISTS published_by text,
--   ADD COLUMN IF NOT EXISTS retire_reason text;

-- SKETCH ONLY: packages table — sole UNIQUE(input_checksum)
-- CREATE TABLE public.measured_boq_catalog_packages (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   revision_id uuid NOT NULL
--     REFERENCES public.measured_boq_catalog_revisions(id) ON DELETE CASCADE,
--   input_checksum text NOT NULL UNIQUE CHECK (input_checksum ~ '^[0-9a-f]{64}$'),
--   content_checksum text NOT NULL CHECK (content_checksum ~ '^[0-9a-f]{64}$'),
--   catalog_revision text NOT NULL,
--   manifest_text text NOT NULL,
--   snapshot_text text NOT NULL,
--   report_json jsonb NOT NULL,
--   created_by text NOT NULL,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- SKETCH ONLY: write surface
-- CREATE FUNCTION public.ingest_measured_boq_catalog_draft(...)
-- RETURNS ... LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
-- BEGIN
--   -- FOR UPDATE / insert revision+entries+package+event in ONE body
-- END; $$;
-- REVOKE ALL ON FUNCTION ... FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION ... TO service_role;
```


---

## Document control

| Item | Value |
| --- | --- |
| Plan version | 4C2E-B2A.2 |
| Base SHA | `0b382794f058b3b26b3b3e6bd9eb89b4efc42392` |
| Authoring phase | planning only |
| Independent review | 4C2E-B2A.1 FAIL → 4C2E-B2A.2 resolutions applied in-document |
| Next phase | `4C2E-B2B — Independent Verification of the Catalogue Persistence and Publication Plan` |

**Do not begin B2 implementation before B2B passes and a separate implementation phase is explicitly authorised.**
