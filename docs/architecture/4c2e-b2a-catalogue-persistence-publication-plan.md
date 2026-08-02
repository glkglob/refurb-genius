# 4C2E-B2A — Catalogue Persistence and Publication Plan

```text
Status: 4C2E-B2A.3 PLAN REPAIRED — READY FOR B2B2 DELTA VERIFICATION
Ticket: 4C2E-B2A / 4C2E-B2A3 (planning only)
Parent contracts:
  - docs/architecture/4c2e-production-catalogue-data-gate-plan.md
  - docs/architecture/4c2e-b1-source-agnostic-catalogue-tooling-plan.md
  - docs/architecture/l3-measured-boq-catalogue-foundation-plan.md
  - docs/architecture/l3-estimate-authority-contract.md
Base SHA at original planning: 0b382794f058b3b26b3b3e6bd9eb89b4efc42392
B2A plan commit: 1da5d371f97ec3e7c139babacbd860f5c1334ef2
Branch: plan/4c2e-b2a-catalogue-persistence-publication
Plan version: 4C2E-B2A.3
```

This document is the **implementation-ready plan** for measured-BOQ catalogue
**persistence and publication infrastructure**. It does **not** implement
migrations, importers, publishers, writers, runtime readers, or production data.

Evidence labels:

```text
[Repository-confirmed]    — verified in code, schema, tests, or committed docs
[Reasoned recommendation] — planning recommendation from repository evidence
[Unresolved product policy] — product/legal decision; safe default stated
[Proposed B2 design]      — future work; not existing behaviour
```

---

## Status and authority

| Item | Value |
| --- | --- |
| Phase | **4C2E-B2A** planning (+ **B2A3** consistency repair) |
| Implementation | **Forbidden** in this phase |
| Next gate | **4C2E-B2B2** delta independent verification of the repaired plan |
| After B2B2 PASS | Separate guarded merge of PR #100 only; B2C still blocked |
| After merge of PR #100 | Planning complete only; B2C requires **separate explicit authorisation** |

B1 remains authoritative for package validation and checksums. B2 must **compose**
B1 outputs and must not re-implement or weaken pure validation.

---

## Purpose

Define an evidence-based, implementation-ready design for:

* validated package draft ingestion (content-frozen);
* immutable catalogue revision and entry persistence;
* package/checksum lineage;
* publication, retirement, and rollback-retire transactions;
* concurrency, idempotency, and audit;
* fail-closed server-only write authority;
* migration, test, and verification strategy.

---

## Authoritative baseline

| Item | Value |
| --- | --- |
| Repository | `glkglob/refurb-genius` |
| Exact main at plan open | `0b382794f058b3b26b3b3e6bd9eb89b4efc42392` |
| B2A plan commit | `1da5d371f97ec3e7c139babacbd860f5c1334ef2` |

### Completed foundations

| Ticket | Meaning | Evidence |
| --- | --- | --- |
| 4C2C-B | Immutable catalogue tables + triggers + RLS | `supabase/migrations/20260731120000_measured_boq_catalogue_foundation.sql` |
| 4C2D | Server-only exact-revision catalogue loader | `src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts` |
| 4C2E-A | Production data-gate plan (licence blocked) | `docs/architecture/4c2e-production-catalogue-data-gate-plan.md` |
| 4C2E-B1A–B1D | Pure dry-run pipeline + read-only CLI | `packages/services/.../catalogue/`, `scripts/catalogue-dry-run.ts` |

---

## Completed B1 foundation (must not be duplicated)

[Repository-confirmed] B1 owns:

| Concern | Location |
| --- | --- |
| Manifest parse + strict unknown keys | `parseCatalogueManifest` |
| Alias exclusivity, unit/decimal normalisation | `normaliseCatalogueSnapshot` |
| Rights / production policy (technical dry-run) | `runCatalogueDryRun` / parse path |
| Semantic catalogue validation | `validateCatalogueSnapshot` |
| Package input checksum (`mboq-package-v2`) | `computePackageArtifactChecksum` |
| Canonical content checksum (label-bound) | `computeCatalogueContentChecksum` |
| Read-only FS load + realpath containment | `scripts/catalogue-dry-run.ts` |

B2 consumes B1 outputs only through a **server-owned** application boundary.

---

## Current-state evidence

### Catalogue tables and migrations

[Repository-confirmed]

| Path | Symbol / object | Responsibility | B2 implication |
| --- | --- | --- | --- |
| `supabase/migrations/20260731120000_measured_boq_catalogue_foundation.sql` | `measured_boq_catalog_revisions` | Revision header; natural key `catalog_revision`; status lifecycle; `content_checksum` | **Reuse**; extend for lifecycle metadata |
| same | `measured_boq_catalog_entries` | Rate rows; `(catalog_revision, rate_key)` | **Reuse**; post-ingest freeze under B2 |
| same | `measured_boq_catalog_revision_immutable()` | draft→draft full edit **today**; draft→published without content freeze list; published→retired freezes hard-coded column set; retired fully blocked | **Replace in B2C** with package-backed freeze model |
| same | `measured_boq_catalog_assert_parent_draft` + `FOR SHARE` | Entry mutations require draft parent | **Reuse** for races; B2 still freezes entries via grants/triggers |
| same | RLS + REVOKE auth / GRANT service_role DML | Private tables | **Tighten in B2C**: revoke service_role DML; RPC-only writes |
| `supabase/migrations/20260730120000_estimate_authority_persistence_foundation.sql` | `persist_category_engine_estimate` | SECURITY DEFINER write template | **Mandatory pattern** for B2 RPCs |

**Confirmed absent today:**

```text
active_revision pointer
measured_boq_catalog_packages
measured_boq_catalog_events
input_checksum / licence_status / source_id columns
catalogue lifecycle RPCs
application catalogue write path
production catalogue seed rows
```

### Current immutability (accurate wording)

[Repository-confirmed]

| Transition | Current behaviour |
| --- | --- |
| draft → draft | Full row mutation allowed |
| draft → published | Allowed with `published_at`; **no complete content freeze list** |
| published → retired | Only hard-coded columns frozen; mutable: `status`, `retired_at`, `updated_at` |
| retired | Fully immutable |
| Entry I/U/D | Parent must be `draft` under `FOR SHARE` |

B2 **must not** claim the pre-B2C trigger already freezes package-backed content on publish. B2C replaces `measured_boq_catalog_revision_immutable()` in the **same migration transaction** as additive columns and package constraints, **before** any public lifecycle RPC is granted.

### Runtime reader

| Path | Symbol | Responsibility | B2 implication |
| --- | --- | --- | --- |
| `…/measuredBoqCatalogue.repository.server.ts` | `loadMeasuredBoqCatalogueSnapshot` | service_role **SELECT**; exact revision; authority=`published`; reproduction=`published\|retired`; rejects `latest`/`current` | **Do not repurpose as writer**; post-publish verify may call it |
| same | no production/licence gate | Any published revision is authority-loadable | Synthetic residual risk — § Residual risk |

### Privileged write conventions

| Path | Symbol | Responsibility |
| --- | --- | --- |
| `src/platform/supabase/service.server.ts` | `createServiceRoleSupabase` | Sole app service-role factory |
| Category authority stack | `persist_category_engine_estimate` | SECURITY DEFINER; `SET search_path = ''`; EXECUTE service_role only |

### B1 API (composition contract)

```text
runCatalogueDryRun({ manifestText, snapshotText, expectedInputChecksum?, expectedOutputChecksum? })
  → { report: CatalogueDryRunReport; contentChecksum? }

report fields (selected):
  ok, mode, tool, catalogRevision, sourceId, licenceStatus, production,
  inputChecksum, outputChecksum, recordCount, acceptedCount, rejectedCount,
  warningCount, issues, warnings, unitAliasApplications
```

```text
DB content_checksum  ≡  B1 outputChecksum / computeCatalogueContentChecksum
B1 inputChecksum     ≡  computePackageArtifactChecksum (mboq-package-v2)

[Repository-confirmed] canonicalCatalogueSerialisation INCLUDES catalogRevision.
content_checksum is label-bound: different catalog_revision labels ALWAYS yield
different content digests even when rate rows match.
```

---

## Scope

### B2 may eventually cover

```text
validated package draft ingestion (content-frozen)
immutable revision + entry persistence
package and checksum lineage
draft status under existing status enum
publication, retirement, rollback-retire transactions
append-only audit events
concurrency control and request idempotency
server-only write authority via SECURITY DEFINER RPCs
database invariants and fail-closed grants
repository + application boundaries
independent verification (B2B2, B2F)
```

### B2 must explicitly exclude

```text
production or supplier catalogue acquisition
source-specific adapters / scraping
runtime reader activation / catalogue pin changes
estimate-builder integration
automatic repricing
UI administration
scheduled / background publication
4C2F reader cutover
lawful production rate content approval (data-gate)
hard-delete / purge of catalogue packages in B2
```

---

## Explicit exclusions (this document and B2 programme)

```text
no SQL migrations in B2A/B2A3
no live Supabase / production / preview database access in planning
no generated-type regeneration in planning
no importer/publisher implementation in planning
no production or licensed catalogue rows
no write modes on catalogue-dry-run
no estimate-builder or ROI changes
```

---

## Ownership decision

### Choice

[Reasoned recommendation] **Hybrid ownership** matching the existing read path:

| Concern | Owner |
| --- | --- |
| Pure package validation / checksums | `packages/services/src/measured-boq/catalogue/` (**unchanged pure**) |
| Server application use cases | `src/features/estimate/application/measuredBoq/*.server.ts` |
| RPC adapter (no table DML) | `src/features/estimate/infrastructure/catalogue/*Write*.repository.server.ts` |
| Ops entrypoint | **New** `scripts/` + package script `catalogue:persist` — **not** dry-run |
| DB schema / triggers / RPCs | `supabase/migrations/` (B2C–B2E) |

### Import-direction diagram

```text
ops CLI (scripts/catalogue-persist.ts)
  │  imports application use case only
  ▼
application/measuredBoq/persistCatalogueDraft.server.ts  (etc.)
  │  reads artifact files; runs runCatalogueDryRun (pure)
  │  constructs RPC params from server-owned B1 result
  ▼
infrastructure/catalogue/*Write*.repository.server.ts
  │  createServiceRoleSupabase
  │  rpc('persist_measured_boq_catalog_draft' | publish | retire | rollback…)
  ▼
PostgreSQL SECURITY DEFINER functions → catalogue tables

FORBIDDEN:
  packages/services ──X──► supabase / feature infra
  scripts/catalogue-dry-run ──X──► write / service_role
  browser / routes ──X──► write repository or RPCs
  application ──X──► table DML (.from().insert/update/delete/upsert)
```

---

## Authoritative publication policy (single source)

This policy is **identical** in every matrix, transition, error contract, test, decision log, threat statement, phase DoD, and definition of done:

```text
synthetic + production:false + B1 ok:true
  → draft allowed
  → publication allowed for persistence/lifecycle plumbing

rights_unverified + production:false + B1 ok:true
  → draft allowed
  → publication forbidden

production:true
  → rejected by B1 (PRODUCTION_BLOCKED via parseCatalogueManifest)
  → no draft persistence under the current B1 contract
```

### Policy matrix

| Package class | Draft ingest | Publish | Notes |
| --- | --- | --- | --- |
| `ok:false` (any) | **No** | N/A | ops logs only; not persisted |
| `production:true` | **No** under current B1 | **No** | data-gate + B1 block |
| `licence_status=synthetic`, `production:false`, `ok:true` | **Yes** | **Yes** | plumbing / non-prod lifecycle |
| `licence_status=rights_unverified`, `production:false`, `ok:true` | **Yes** | **No** | technical draft only |
| Future approved commercial licence | Deferred product/legal | Deferred | needs enum expansion + fail-closed RPC checks |

`rights_not_publishable` applies to **rights policy failures** (e.g. `rights_unverified`), **not** to valid synthetic packages.

Warnings on `ok:true` reports may be retained; default allow draft and synthetic publish when `ok:true`.

---

## Residual risk — published synthetic and runtime

```text
A published synthetic revision is technically loadable by the existing
exact-revision reader if a future product/runtime caller deliberately pins it.
```

Mitigations and boundaries:

* B2 introduces **no** active pointer;
* B2 makes **no** runtime-reader changes;
* B2 makes **no** builder integration;
* B2 makes **no** automatic pin;
* B2 makes **no** synthetic-to-production conversion;
* package/report retains `synthetic` and `production:false`;
* later runtime activation must enforce its own product/data-approval gate;
* B2 completion does **not** imply production-data approval.

**Negative architecture requirement:**

```text
No B2 phase may add or change a runtime catalogue pin.
```

Publication does **not** equal runtime activation. B2 alone does **not** make published synthetic rows impossible to read.

---

## Target module boundaries

### Proposed tree

```text
packages/services/src/measured-boq/catalogue/     # pure B1 (no DB)
scripts/catalogue-dry-run.ts                     # read-only forever
scripts/catalogue-persist.ts                     # [Proposed B2D] ops only
src/features/estimate/
  application/measuredBoq/
    persistCatalogueDraft.server.ts              # [Proposed B2D]
    publishCatalogueRevision.server.ts           # [Proposed B2E]
    retireCatalogueRevision.server.ts            # [Proposed B2E]
    rollbackCataloguePublication.server.ts       # [Proposed B2E]
  infrastructure/catalogue/
    measuredBoqCatalogue.repository.server.ts    # existing READ
    measuredBoqCatalogueWrite.repository.server.ts  # [Proposed] RPC adapter only
tests/invariants/
  catalogue-persist-boundary.test.ts             # [Proposed B2D hard DoD]
supabase/migrations/
  <timestamp>_measured_boq_catalogue_persist_schema.sql   # B2C
  <timestamp>_measured_boq_catalogue_draft_rpc.sql         # B2D
  <timestamp>_measured_boq_catalogue_lifecycle_rpc.sql     # B2E
```

### Non-negotiable requirements

1. B1 pure package logic remains database-independent.
2. B2 write orchestration recomputes B1 server-side; never trusts client `ok`.
3. Product/runtime code must not import CLI modules.
4. Routes must not import database adapters or RPCs directly.
5. Write authority is server-only via SECURITY DEFINER RPCs.
6. No new generic shared package without multi-owner reuse.

---

## Persistence model

### Concepts

| Concept | Decision |
| --- | --- |
| Catalogue source | `source_id` text on package/revision metadata |
| Package identity | `measured_boq_catalog_packages` — sole owner of `input_checksum` UNIQUE |
| Immutable revision | Reuse `measured_boq_catalog_revisions` |
| Canonical entries | Reuse `measured_boq_catalog_entries` — frozen after ingest |
| Publication / retirement | Status transition + audit event |
| Active pointer | **Do not introduce** |
| Audit | `measured_boq_catalog_events` append-only |

### Reused table: `measured_boq_catalog_revisions`

| Field | Spec |
| --- | --- |
| purpose | Catalogue revision header |
| primary key | `id uuid` |
| business identity | `catalog_revision text` UNIQUE |
| foreign keys | none from package reverse-link (**no** `package_id` column) |
| existing required columns | status, schema_version, currency, vat_basis, regional_basis, source_description, entry_count, content_checksum, effective_from, created_by, timestamps |
| existing optional | release_notes, published_at, retired_at |
| [Proposed B2C] additive | `source_id text`, `licence_status text`, `production boolean NOT NULL DEFAULT false`, `input_checksum text` (**non-unique denorm**), `normaliser_version text`, `published_by_kind text`, `published_by_id uuid NULL`, `retired_by_kind text`, `retired_by_id uuid NULL`, `retirement_reason text` |
| unique | `catalog_revision` only |
| content_checksum | one immutable value per revision; **not** a global UNIQUE; label-bound by B1 |
| RLS | private; SELECT for service_role as needed; **no** service_role DML after B2C grants repair |
| immutability | B2C rewritten trigger + fail-closed GUC |

### Reused table: `measured_boq_catalog_entries`

| Field | Spec |
| --- | --- |
| business identity | `(catalog_revision, rate_key)` |
| FK | → revisions ON DELETE RESTRICT under B2 (prefer RESTRICT for package-backed; draft hard-delete not offered in B2) |
| mutability | **none after successful package-backed ingestion** |

### Proposed table: `measured_boq_catalog_packages`

| Field | Spec |
| --- | --- |
| purpose | Sole package artifact identity and raw retention |
| primary key | `id uuid` |
| business identity | `input_checksum` **UNIQUE (global)** |
| foreign keys | `revision_id uuid NOT NULL UNIQUE REFERENCES measured_boq_catalog_revisions(id) ON DELETE RESTRICT` |
| required | input_checksum, content_checksum, revision_id, catalog_revision (denorm label), source_id, licence_status, production, manifest_version, normaliser_version, manifest_text, snapshot_text, validation_report jsonb, created_at |
| unique | `input_checksum`; **`UNIQUE(revision_id)`** — one package per revision |
| reverse FK | **None** — do not add `package_id` on revisions |
| immutability | all fields frozen after insert |
| delete | no B2 hard-delete; ON DELETE RESTRICT blocks accidental parent delete |
| RLS | private; SELECT only for service_role after grants repair |

**Identity ownership:** `input_checksum` uniqueness lives **only** on packages. Revisions may denormalise `input_checksum` non-uniquely for ops queries.

### Proposed table: `measured_boq_catalog_events`

| Field | Spec |
| --- | --- |
| purpose | Append-only business audit |
| primary key | `id uuid` |
| required | event_type, command_scope, request_id, catalog_revision, revision_id, input_checksum, content_checksum, actor_kind, actor_user_id, created_at, payload_json, result |
| unique | **UNIQUE (command_scope, request_id)** for request idempotency |
| immutability | no UPDATE/DELETE |
| RLS | private; append via RPC only |

Event types (selected):

```text
ingestion_accepted
ingestion_replayed
publication
publication_replay
retirement
rollback_recorded
rejected_transition
```

### Active pointer

[Proposed B2 design] **No active-revision table**. Multiple published revisions may coexist. Consumers pin exact `catalog_revision`.

### Legacy-row compatibility

```text
Existing pre-B2 revisions are legacy rows without a package record.
No destructive backfill or fabricated raw artifact is allowed.
New B2 ingestion requires package provenance.
```

**Fail-closed rule:**

```text
B2 lifecycle RPCs do not operate on legacy revisions lacking package provenance,
unless a separately authorised provenance-adoption migration supplies verified
package identity.
```

No fake checksum or placeholder package is permitted. Outcome: `provenance_required`.

---

## Raw artifact retention

### Decision

[Reasoned recommendation] **PostgreSQL `text`** for `manifest_text` and `snapshot_text` on packages; **`jsonb`** for server-owned validation report.

Rejected: object storage (split TX; no catalogue bucket); no retention (fails audit/recompute).

### Hard size and entry-count constraints (B2C DoD — exact)

| Field | Hard limit | Enforcement |
| --- | --- | --- |
| `manifest_text` | `octet_length <= 1048576` (1 MiB) | DB `CHECK` + server precheck |
| `snapshot_text` | `octet_length <= 8388608` (8 MiB) | DB `CHECK` + server precheck |
| `validation_report` jsonb | serialized octet length ≤ 2097152 (2 MiB) | DB CHECK / RPC assert + server precheck |
| normalized entry count | ≤ 50000 per revision | RPC precondition + DB assert before commit |

Oversized inputs → stable `payload_too_large`. No raw oversized text persisted. Logs must not contain complete artifact text.

Server rejects oversized inputs **before** RPC; database remains the final enforcement layer.

---

## Identity and checksum semantics

### Roles

| Identity | Role | Mutability after ingest |
| --- | --- | --- |
| `inputChecksum` | Byte identity of raw MANIFEST+snapshot (`mboq-package-v2`) | Immutable |
| `content_checksum` / outputChecksum | Label-bound canonical content identity | Immutable |
| `catalogRevision` | Business revision label | Immutable string; status may change via lifecycle RPC only |
| `sourceId` | Logical source from MANIFEST | Immutable |
| package id / revision id | Surrogate uuids | Immutable |
| publication | status + timestamps + events | lifecycle metadata only |

### Package checksum preimage contract (exact B1 v2)

Database must independently verify:

```text
manifestDigest = sha256(UTF-8 manifest_text)
snapshotDigest = sha256(UTF-8 snapshot_text)

outerPayload =
  "mboq-package-v2\n" +
  "manifest:" + manifestDigest + "\n" +
  "snapshot:" + snapshotDigest + "\n"

inputChecksum = sha256(UTF-8 outerPayload)
```

Specify:

* lowercase hexadecimal encoding;
* exact newline framing;
* exact stored text bytes are the checksum preimage;
* **no** JSON reserialization before hashing;
* package `input_checksum` cannot be inserted or updated unless it matches stored artifact bytes;
* B2C implements an immutable schema-qualified SQL helper (or trigger/RPC assertion);
* pgTAP compares SQL results against B1 fixtures;
* checksum fields are immutable after insert.

This SQL helper is **byte integrity**, not catalogue-semantic duplication. B1 semantic authority remains TypeScript.

### Content checksum wording

* B1 `content_checksum` is **label-bound** because `catalogRevision` is included;
* it is **one immutable value per revision**;
* it is **not** a label-independent canonical-content deduplication key;
* no global `UNIQUE(content_checksum)` is required;
* same rate rows under a different revision label produce a **different** content checksum.

### Uniqueness

| Value | Scope | Rule |
| --- | --- | --- |
| `input_checksum` | Global UNIQUE on packages | Exact package re-import is idempotent |
| `content_checksum` | Per revision row | Not a cross-label equality key |
| `catalog_revision` | Global UNIQUE (existing) | Label reuse with different package → conflict |
| `revision_id` on packages | UNIQUE | One package per revision |

### Idempotency decision table

| Existing state | Incoming package | Required result |
| --- | --- | --- |
| Nothing exists | Valid synthetic/rights_unverified package (`ok:true`) | Create revision + package + entries + `ingestion_accepted` |
| Same `input_checksum` | Same labels and digests | **Idempotent replay**: return existing ids; no mutation; may record `ingestion_replayed` with new request_id |
| Different `input_checksum` | Same `catalog_revision` | **`revision_conflict`** |
| Different `input_checksum` | New `catalog_revision` | New independent draft (new content_checksum) |
| production:true | — | Rejected by B1; not persisted |
| Retired/published exact same package | Same input_checksum | Idempotent replay; no unretire / no re-publish storm |

---

## Draft mutability model (package-backed freeze)

### Authoritative model

```text
Package-backed drafts are content-frozen immediately after successful ingestion.
```

Immutable after successful ingest:

* stored manifest bytes;
* stored snapshot bytes;
* input checksum;
* content checksum;
* revision business identity (`catalog_revision`);
* normalized catalogue entries;
* package/revision linkage;
* warning/report provenance (`validation_report`).

**No in-place catalogue-entry editing** is permitted after ingestion, even while status is `draft`.

Corrections require:

1. a new package (new artifact bytes);
2. a new input checksum;
3. a new `catalogRevision` label where content or package identity changes;
4. a new revision row.

Exact replay of an existing package is idempotent and **must not** mutate the existing draft.

There is **no** draft-to-draft content-update command.

Operational lifecycle commands (publish / retire / rollback-retire) mutate only transition-specific metadata defined in the freeze matrix.

### Draft deletion and abandonment

```text
B2 provides no direct hard-delete operation for package-backed drafts.
Package, revision, entries and accepted audit events are retained.
Abandoned drafts remain unpublished and private.
Retention/purge is deferred to a separately authorised maintenance phase.
Published or retired content is never deleted by B2.
```

B2 does **not** free the global `input_checksum` key by deleting drafts. Exact re-import returns the existing immutable package/revision identity.

---

## Server-owned B1 ingestion authority

### Authoritative boundary

```text
raw manifest text + raw snapshot text
  → server-only application use case
  → runCatalogueDryRun executed again by trusted server code
  → reject unless permitted by policy
  → construct RPC parameters from the server-owned B1 result
  → one atomic persistence RPC
```

Requirements:

* no browser/client may supply or assert `ok:true`;
* no browser/client may supply trusted policy fields;
* no browser/client may supply trusted normalized entries;
* no browser/client may supply trusted checksums;
* no browser/client may supply a trusted `report_json`;
* the operational script passes **artifact paths only** to the server-side application boundary;
* the application boundary reads artifacts, runs B1, and constructs the persistence command;
* the RPC is invoked only from the privileged server module;
* local artifact paths are **never** persisted.

The database RPC receives **raw artifact text** so the database can enforce package-byte identity and recompute the B1 v2 input checksum.

Division of authority:

* **B1 semantic authority** remains TypeScript (application use case);
* **database** independently enforces byte/checksum integrity, structural constraints, sizes, uniqueness, grants, and lifecycle;
* the privileged application use case is the **only** source of normalized entries and validation summary;
* compromise of the service-role boundary remains privileged compromise, not an untrusted-client path.

### Conceptual draft-ingestion flow

```text
package directory (ops only)
  → application reads manifest_text + snapshot_text
  → runCatalogueDryRun (server)
  → require ok + policy class
  → precheck sizes / entry count
  → rpc('persist_measured_boq_catalog_draft', server-built params)
       advisory lock on input_checksum
       unique checks
       insert revision → package → entries → event
  → map typed result
```

---

## Publication state machine

### Persistent states (existing SQL enum)

| State | Content mutability | Loader visibility | Outgoing |
| --- | --- | --- | --- |
| `draft` | **None** after package-backed ingest | Not readable for authority/reproduction | → `published` via publish RPC |
| `published` | Transition metadata only | authority + reproduction | → `retired` via retire or rollback-retire |
| `retired` | None | reproduction only | none |

Soft states (`validated`, `rejected`, `failed`) are **events/results**, not SQL enums.

### Transition table

| Current | Command | Preconditions | Result | Audit |
| --- | --- | --- | --- | --- |
| (none) | `persist_measured_boq_catalog_draft` | B1 ok + policy | package + draft revision + entries | `ingestion_accepted` |
| draft (same package) | same persist | same input_checksum | no-op / replay | `ingestion_replayed` |
| draft | `publish_measured_boq_catalog_revision` | package provenance; not rights_unverified; synthetic ok | published | `publication` |
| published | publish again | status already published | no-op | `publication_replay` / `already_published` |
| published | `retire_measured_boq_catalog_revision` | reason required | retired | `retirement` |
| published | `rollback_measured_boq_catalog_publication` | prior remains published; package provenance | retire target only | `rollback_recorded` |
| retired | content mutate | — | reject | `rejected_transition` |
| published → draft | — | — | **Forbidden** | `rejected_transition` |
| retired → published | — | — | **Forbidden** | `rejected_transition` |

### Explicit decisions

| Question | Decision |
| --- | --- |
| Published → draft? | **No** |
| Retired republish? | **No** — use new package + new label workflow |
| One published only? | **No** — multi-published exact-pin |
| Active pointer? | **None** |

---

## Fail-closed grants and lifecycle guard

### Grants (B2C baseline; tightened before B2E RPC enablement)

* **REVOKE** direct `INSERT`, `UPDATE`, `DELETE` on catalogue lifecycle tables from:
  * `anon`;
  * `authenticated`;
  * `service_role`;
* grant only the narrowly required `SELECT` permissions to `service_role` (for loaders / post-verify);
* grant `EXECUTE` only on approved RPCs to `service_role`;
* **REVOKE ALL ON FUNCTION … FROM PUBLIC**;
* no client JWT receives lifecycle RPC execution.

Table writes for ingest/lifecycle occur **only** inside SECURITY DEFINER functions owned by the trusted migration/function-owner role (repository convention, same as category authority RPC ownership).

### SECURITY DEFINER requirements (every lifecycle and persist RPC)

* `SECURITY DEFINER`;
* `SET search_path = ''`;
* schema-qualified tables/functions/operators (`public.…`, `pg_catalog.…`);
* owned by trusted migration/function-owner role;
* derive actor context from database auth context (`auth.role()`, `auth.uid()`);
* **accept no actor ID parameter**;
* **no dynamic SQL**.

### Transaction-local lifecycle guard

GUC name:

```text
app.measured_boq_catalog_lifecycle_command
```

Each lifecycle RPC calls:

```sql
pg_catalog.set_config(
  'app.measured_boq_catalog_lifecycle_command',
  '<exact-command>',
  true
);
```

(`true` = transaction-local; resets at transaction end.)

The rewritten immutability trigger permits lifecycle mutation only when:

1. `current_user` is the trusted SECURITY DEFINER function owner;
2. the transaction-local command equals the exact permitted transition;
3. the old and new status form the authorised transition;
4. only the transition-specific mutable columns changed.

Direct service-role DML fails even if a caller manually sets the custom GUC, because `current_user` is not the trusted function owner.

### Lifecycle command values (fixed)

```text
publish
retire
rollback-retire
```

No arbitrary command text.

#### `publish`

* Transition: `draft → published`
* Mutable columns only: `status`, `published_at`, `published_by_kind`, `published_by_id` (null under service_role), `updated_at` if convention requires
* All content and identity columns unchanged

#### `retire`

* Transition: `published → retired`
* Mutable columns only: `status`, `retired_at`, `retired_by_kind`, `retired_by_id` (null under service_role), `retirement_reason`, `updated_at` if required

#### `rollback-retire`

* Transition: `published → retired` (target only)
* Requires prior published revision reference in the event;
* requires rollback reason;
* **no** active-pointer mutation;
* does not modify prior revision.

Forbidden: published→draft; retired→published; retired→draft; draft content mutation; package or entry mutation.

---

## Immutability freeze matrix (B2C)

| Entity/state | Mutable | Immutable | Enforcer |
| --- | --- | --- | --- |
| Package row | none | all fields | grants + append-only trigger |
| Draft revision (package-backed) | no content mutation | identity/content/checksums/entries | rewritten trigger + grants |
| Published revision | transition metadata only | all content/identity | rewritten trigger + GUC |
| Retired revision | none | all fields | rewritten trigger |
| Entry row | none after ingestion | all entry content | grants + parent/entry triggers |
| Event row | none | all fields | append-only grants/trigger |

Function replaced:

```text
public.measured_boq_catalog_revision_immutable()
```

Replacement must occur in the **same migration transaction** as additive lifecycle columns and package constraints, and **before** any public lifecycle RPC grant is enabled.

### Required pgTAP lifecycle probes (B2C / B2E)

* direct status update as `service_role` fails;
* direct content update as `service_role` fails;
* manually setting the GUC as `service_role` still fails;
* approved SECURITY DEFINER publish RPC succeeds (B2E);
* wrong GUC command fails;
* GUC is absent after transaction completion;
* unauthorized transition fails;
* changing extra columns during a lifecycle transition fails;
* package rows cannot be updated;
* entry rows cannot be updated or deleted after ingest;
* audit events cannot be updated or deleted;
* default `PUBLIC` execute is absent;
* authenticated and anonymous roles cannot execute lifecycle RPCs.

---

## Exact RPC contracts

### Phase ownership of RPCs

| Phase | RPCs |
| --- | --- |
| **B2C** | Schema, constraints, triggers, grants baseline, private integrity helpers only. **No** public persist/publish/retire/rollback RPC bodies |
| **B2D** | `persist_measured_boq_catalog_draft` + app/CLI |
| **B2E** | `publish_measured_boq_catalog_revision`, `retire_measured_boq_catalog_revision`, `rollback_measured_boq_catalog_publication` |

Remove all “RPC stub or full body” language from B2C.

### B2D — `persist_measured_boq_catalog_draft`

Parameters:

```text
p_manifest_text text
p_snapshot_text text
p_catalog_revision text
p_source_id text
p_manifest_version integer
p_normaliser_version text
p_input_checksum text
p_content_checksum text
p_normalized_entries jsonb
p_validation_report jsonb
p_request_id uuid
```

**No** parameters for: `ok`; production/rights approval; actor ID/role; local path; publication state.

Typed result:

```text
outcome text
package_id uuid
revision_id uuid
input_checksum text
content_checksum text
request_id uuid
idempotent_replay boolean
```

Outcomes (subset): `created`, `idempotent_replay`, `revision_conflict`, `package_conflict`, `request_conflict`, `payload_too_large`, `invalid_persistence_command`, `unauthorised`, `database_failure`.

Insert order inside the RPC:

1. advisory lock on input checksum (fixed namespace; tested in B2D);
2. check existing package by input checksum;
3. check revision by `catalog_revision`;
4. if creating: insert revision;
5. insert package referencing revision;
6. insert entries;
7. insert accepted/replay event;
8. commit.

If any step fails, entire transaction rolls back. Multiple package rows per revision are rejected by `UNIQUE(revision_id)`.

### B2E — lifecycle RPCs

#### `publish_measured_boq_catalog_revision`

```text
p_revision_id uuid
p_expected_status text
p_request_id uuid
```

#### `retire_measured_boq_catalog_revision`

```text
p_revision_id uuid
p_expected_status text
p_reason text
p_request_id uuid
```

#### `rollback_measured_boq_catalog_publication`

```text
p_revision_id uuid
p_prior_revision_id uuid
p_expected_status text
p_reason text
p_request_id uuid
```

Typed lifecycle result:

```text
outcome text
revision_id uuid
previous_status text
new_status text
event_id uuid
request_id uuid
idempotent_replay boolean
```

Outcomes include: `published`, `retired`, `rollback_recorded`, `idempotent_replay`, `already_published`, `already_retired`, `stale_status`, `rights_not_publishable` (**not** for synthetic), `revision_not_found`, `provenance_required`, `unauthorised`, `database_failure`.

### Actor-binding model

* RPCs accept **no** actor-identification parameter;
* database derives `auth.role()` and `auth.uid()`;
* B2 RPCs granted only to `service_role`;
* durable events record:
  * `actor_kind = 'service_role'`;
  * `actor_user_id = null`;
* this is **service-principal attribution**, not human non-repudiation;
* operational logs may record an operator identity outside durable catalogue events (secret-safe);
* the plan does **not** claim a human actor can be proven from a shared service-role credential.

Later authenticated-admin models require a separately authorised access-control change.

### Search-path and function security

Every SECURITY DEFINER function:

```text
SET search_path = ''
```

Schema-qualify:

```text
public.measured_boq_catalog_revisions
public.measured_boq_catalog_entries
public.measured_boq_catalog_packages
public.measured_boq_catalog_events
pg_catalog.set_config
pg_catalog.current_setting
```

Require: no dynamic SQL; no caller-controlled identifiers; `REVOKE ALL ON FUNCTION … FROM PUBLIC`; `GRANT EXECUTE … TO service_role`; pgTAP grant matrix; function owner documented; signature changes require grant re-audit.

---

## Lock order and concurrency

### Draft persistence

1. acquire transaction-scoped advisory lock based on the input checksum (fixed namespace + key derivation; B2D-tested);
2. check existing package by input checksum;
3. check revision by `catalog_revision`;
4. if creating, insert revision;
5. insert package;
6. insert entries;
7. insert accepted event;
8. commit.

No application-side multi-step DML.

### Single-revision lifecycle

1. `SELECT` target revision `FOR UPDATE`;
2. verify expected status and package provenance;
3. set transaction-local lifecycle GUC;
4. apply transition;
5. insert event;
6. commit.

### Two-revision rollback

Lock both revision rows in deterministic ascending UUID order:

```text
LEAST(target_revision_id, prior_revision_id)
GREATEST(target_revision_id, prior_revision_id)
```

Then verify: target published; prior published; both have package provenance; distinct; expected status matches; then `rollback-retire` target only.

### Request and event idempotency

* `p_request_id` required for every RPC;
* events: `UNIQUE (command_scope, request_id)`;
* same request ID + identical command identity → original result (`idempotent_replay`);
* same request ID + different parameters → `request_conflict`;
* exact package replay with **new** request ID → `ingestion_replayed` event without new package/revision;
* lost client response after commit is recoverable by retrying the same request ID.

---

## Rollback and republish clarification

### Rollback semantics (no active pointer)

```text
Rollback records that a published revision was withdrawn because a named,
previously published revision remains the approved historical fallback.
```

The rollback RPC:

* does **not** activate the prior revision;
* does **not** modify the prior revision;
* retires only the erroneous target revision;
* requires the prior revision to remain published;
* records both revision IDs in the rollback event;
* requires a reason;
* uses deterministic two-row locking;
* performs no runtime-reader or estimate change.

### Republish-as-new (workflow, not RPC)

`republishAsNewRevision` is **not** a database status transition and **not** a single B2 RPC.

Higher-level workflow:

1. prepare a newly labelled package;
2. rerun B1;
3. persist a new immutable draft through B2D;
4. publish it through B2E;
5. optionally retire an older revision as a **separate** explicit command.

Not atomic across steps. Each command is independently idempotent and audited. No optional retirement is hidden inside persist or publish RPC.

---

## Validation-report storage

* raw manifest/snapshot: PostgreSQL `text`;
* validation report: `jsonb`;
* only trusted server-owned B1 result is supplied;
* RPC does **not** accept an independent `ok` boolean;
* database derives accepted state from RPC path and enforced fields;
* report storage is immutable;
* report contains no local file paths, secrets, or full duplicate artifact content;
* warnings may be retained;
* rejected `ok:false` packages are **not** persisted.

---

## Stable error taxonomy (authoritative)

```text
created
idempotent_replay
published
retired
rollback_recorded
revision_conflict
package_conflict
request_conflict
payload_too_large
rights_not_publishable
production_policy_rejected
unsupported_version
invalid_persistence_command
already_published
already_retired
stale_status
revision_not_found
provenance_required
unauthorised
database_failure
unexpected_internal_failure
```

| Outcome class | Client-safe? | Notes |
| --- | --- | --- |
| policy/conflict outcomes above | yes (sanitised) | no raw PG messages |
| `rights_not_publishable` | yes | **rights_unverified** (and future unapproved commercial) — **not synthetic** |
| `database_failure` / `unexpected_internal_failure` | limited | generic only |

---

## Access control and RLS

### Permissions matrix

| Actor | Read draft | Create draft | Publish | Retire | Rollback | Read published/retired meta |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| End user JWT | no | no | no | no | no | no |
| Admin JWT alone | no | no | no | no | no | no |
| Ops + service_role tooling (RPC only) | via SELECT grant | via persist RPC | via publish RPC* | via retire RPC | via rollback RPC | yes |
| Browser | no | no | no | no | no | no |

\*Synthetic publish allowed; rights_unverified forbidden; production:true blocked at B1.

### Privileged write mechanism

1. All writes: SECURITY DEFINER RPCs only;
2. App/ops: `createServiceRoleSupabase()` → `rpc(...)`;
3. Direct table DML revoked from service_role;
4. Fail-closed GUC + trusted function owner.

---

## Runtime-reader separation

B2 completion does **not** authorise:

```text
switching application default reads to “latest published”
replacing dormant loader activation in product routes
activating published revisions in estimate builders
repricing existing estimates automatically
UI catalogue selection
adding or changing a runtime catalogue pin
```

Existing `loadMeasuredBoqCatalogueSnapshot` remains the only read adapter; B2 may call it for post-publish verification only.

---

## Database invariants (enforcement layers)

| Invariant | Enforced by |
| --- | --- |
| Revision grammar / uniqueness | DB CHECK + UNIQUE |
| Entry identity uniqueness | DB UNIQUE |
| Content checksum format + label-bound value | B1 + immutable column |
| Input checksum uniqueness + preimage | packages UNIQUE + SQL helper |
| Package-backed draft freeze | grants + triggers |
| Published/retired freeze | rewritten trigger + GUC |
| Size / entry-count caps | CHECK + RPC assert |
| Request idempotency | UNIQUE (command_scope, request_id) |
| One package per revision | UNIQUE(revision_id) |
| No active pointer | absence of table + loader exact pin |
| B1 remains DB-free | architecture invariants |
| Dry-run remains read-only | architecture invariants |
| No multi-call table DML | B2D automated seals |

---

## Audit and provenance

Append-only events with `request_id`, command scope, checksums, revision ids, actor_kind=`service_role`, actor_user_id=null, reason when required.

Invalid validation attempts (`ok:false`) are **not** persisted as packages/revisions; ops logs only.

---

## Migration strategy (design only)

### B2C — Schema and database invariants

**Allowed:** package + event tables; additive revision lifecycle columns; hard size constraints; checksum preimage helper; relationship constraints (`UNIQUE(revision_id)`); trigger replacement in same TX; append-only audit enforcement; RLS/grants baseline (revoke service_role DML); generated types; pgTAP schema/constraint/grant tests.

**Prohibited:** public persistence RPC; publish/retire/rollback RPCs; application use cases; operational scripts.

### B2D — Draft persistence boundary

**Allowed:** `persist_measured_boq_catalog_draft`; application use case; RPC adapter; `catalogue:persist`; persistence boundary invariants; idempotency tests.

**Prohibited:** publication; retirement; rollback; runtime activation.

### B2E — Publication lifecycle

**Allowed:** publish/retire/rollback-retire RPCs; lifecycle use cases; lifecycle tests and pgTAP.

**Prohibited:** draft package ingestion redesign; runtime activation; estimate integration.

### B2F — Combined independent verification

Read-only verification only. Hard DoD includes multi-call DML absence, purity seals, policy probes, no runtime pin.

### B2G — Guarded merge and close-out

Merge only after B2F PASS.

### Compatibility

* Existing loader continues (additive columns ignored by SELECT list).
* No production seeds; no auto-publish; no fabricated package backfill.

---

## Test strategy

### Domain / application

* valid synthetic draft creation;
* invalid B1 report rejected (no rows);
* idempotent exact replay;
* revision-label checksum conflict;
* rights_unverified draft allowed; publish denied;
* synthetic publish allowed (plumbing);
* production:true not persisted;
* content-frozen draft (no entry edit path);
* lifecycle transitions; stale expected status;
* request_id replay and request_conflict.

### Database / integration

* uniqueness of input_checksum and catalog_revision;
* UNIQUE(revision_id) on packages;
* immutability freeze matrix pgTAP;
* fail-closed direct service_role DML;
* GUC spoof fails;
* size/entry-count enforcement;
* events append-only;
* request idempotency uniqueness.

### Architecture invariants (B2D hard DoD — not deferred to B2F)

* ops script imports application use case, not infrastructure adapter;
* application invokes exactly one persistence RPC;
* no `.from(...).(insert|update|delete|upsert)` on catalogue tables;
* no route/browser imports persistence adapter;
* no service-role module in client bundle;
* B1 remains database-free;
* dry-run CLI remains read-only;
* persistence is **not** added to dry-run CLI;
* no automatic publication after persist.

Package-script invariant must be deliberately updated to permit **exactly**:

```text
catalogue:dry-run
catalogue:persist
```

and continue to reject:

```text
catalogue:publish
catalogue:retire
catalogue:rollback
catalogue:seed
catalogue:load
```

unless a later authorised phase explicitly adds the command.

### Operational command contract (future B2D)

```text
catalogue:persist
```

* separate from `catalogue:dry-run`;
* accepts package directory;
* invokes server-only application boundary;
* never table DML directly;
* never auto-publish;
* never persists local file paths;
* never prints raw artifacts or secrets;
* uses/generates request ID and displays it;
* deterministic exit/result categories;
* unavailable to browser/runtime code.

**Not implemented in planning phases.**

---

## Threat and failure analysis

| Threat / failure | Mitigation |
| --- | --- |
| Malformed package | B1 gate; no persist on fail |
| Checksum substitution | recompute preimage inside RPC from stored bytes |
| Revision-label collision | UNIQUE + conflict |
| Duplicate import | UNIQUE input_checksum + request idempotency |
| Unauthorised JWT publication | no grants; no JWT EXECUTE |
| Service-role blast radius | server-only module; table DML revoked; RPC-only; no client bundle; secret scanning; rotation policy |
| Oversized payload DoS | server precheck + DB hard limits + entry cap; no raw payload logging; `payload_too_large` |
| Accidental RPC grants | REVOKE PUBLIC; service_role-only; pgTAP grant matrix; signature re-audit |
| Actor attribution limits | service-principal only; no user-ID param; ops logs separate |
| Dual publish race | FOR UPDATE inside RPC |
| Partial transaction | single RPC TX |
| Accidental production activation | no runtime pin; data-gate; B1 blocks production:true |
| Published synthetic pin by future product | residual risk documented; 4C2F/data gate; no B2 pin |
| Direct service_role DML | grants + GUC + trusted owner check |

---

## Decision log

| Decision | Chosen approach | Alternatives rejected | Evidence | Consequence |
| --- | --- | --- | --- | --- |
| Ownership | Estimate feature + pure services | services DB writers | existing loader | clear graph |
| Synthetic publish | allow for plumbing | deny synthetic publish | B1 ok synthetic; post-publish authority verify | residual reader risk documented |
| rights_unverified | draft yes / publish no | publish with warning | B1 soft warn | hard deny at RPC |
| production:true | block at B1 | draft then deny | PRODUCTION_BLOCKED | no production drafts |
| Draft mutability | content-frozen after ingest | full draft edit | package lineage integrity | corrections = new package/label |
| Hard-delete in B2 | none | free checksum by delete | audit retention | abandoned drafts retained |
| B1 authority | server recompute | trust client ok/report | untrusted client risk | TS semantic + DB byte integrity |
| Input checksum preimage | exact mboq-package-v2 in SQL helper | DB-only semantic revalidation | packageChecksum.ts | pgTAP vs B1 fixtures |
| Package FK | packages.revision_id UNIQUE ON DELETE RESTRICT | reverse package_id; CASCADE delete | avoid circular FK | 1:1 package/revision |
| Hard limits | 1MiB/8MiB/2MiB/50k | soft “e.g.” | DoS + backup size | CHECK + precheck |
| Privileged write | RPC only; revoke service_role DML | open table DML | parent-closed publisher | category RPC pattern |
| Lifecycle GUC | app.measured_boq_catalog_lifecycle_command + owner check | GUC alone | spoofable GUC | service_role DML fails |
| Actor | service_role attribution | actor ID param | shared secret | not non-repudiation |
| Active pointer | none | single active unique | loader exact pin | multi-published |
| Rollback | retire target; prior stays published | active pointer flip | no pointer | historical fallback event |
| Republish-as-new | multi-command workflow | single RPC | independent audit | non-atomic |
| B2C vs B2D vs B2E | schema / draft RPC / lifecycle RPCs | stubs in B2C | phase clarity | no overlap |
| B2D seals | automated multi-call DML ban | only B2F | early fail | CI invariant |
| Runtime pin | forbidden in all B2 phases | activate on B2 merge | 4C2F separation | residual synthetic load risk honest |

---

## Deferred product decisions

| Item | Owner | Default safe behaviour |
| --- | --- | --- |
| Lawful production rates | Product + legal | Block production:true indefinitely under current B1 |
| Commercial licence enum expansion | Product + legal | Only synthetic / rights_unverified |
| In-app admin UI | Product | Ops CLI only |
| Encrypted object storage | Security + legal | PG text with hard size caps |
| Draft purge maintenance | Ops | No hard-delete in B2 |

---

## B2 execution slices

### 4C2E-B2A / B2A3 — Planning (+ consistency repair)

* One planning document only.
* Next: B2B2 delta verification.

### 4C2E-B2B2 — Delta verification of repaired plan

* Read-only; no implementation.

### 4C2E-B2C — Schema and database invariants

* As § Migration strategy B2C.
* Hard DoD: freeze rewrite same TX; packages UNIQUE(input_checksum)+UNIQUE(revision_id); size CHECKs; preimage helper; grants baseline; pgTAP list; **no public lifecycle/persist RPC bodies**.

### 4C2E-B2D — Draft persistence boundary

* `persist_measured_boq_catalog_draft` + app + `catalogue:persist` + **automated** multi-call DML seal + package-script allowlist update.
* Hard DoD: zero catalogue table DML outside DEFINER functions; server B1 recompute; content-frozen drafts.

### 4C2E-B2E — Publication lifecycle

* publish / retire / rollback-retire RPCs + GUC fail-closed + policy matrix + post-publish loader verify.
* Hard DoD: synthetic publish works; rights_unverified publish denied; direct status UPDATE fails; no ad-hoc DML.

### 4C2E-B2F — Combined independent verification

* Read-only; multi-call DML absence; purity; policy; residual risk honesty; no runtime pin.

### 4C2E-B2G — Guarded merge and close-out

* After B2F PASS only.

---

## Planning PR merge gate

```text
B2B2 PASS authorises only a separate guarded merge of PR #100.
Merging PR #100 completes planning only.
B2C remains blocked after the merge until explicitly authorised.
No implementation phase begins automatically.
```

---

## Definition of done

### B2A.3 done when

* every B2B required revision resolved;
* single-source synthetic/rights/production policy;
* content-frozen drafts;
* no hard-delete in B2;
* server-owned B1 + exact preimage contract;
* one-direction package FK;
* hard size limits;
* fail-closed grants + GUC + trigger matrix;
* exact RPC contracts and phase ownership;
* request idempotency;
* rollback/republish clarity;
* B2D automated seals;
* synthetic residual risk honest;
* no unresolved implementation-critical ambiguity.

### B2 programme done when (future)

* synthetic draft ingest + publish plumbing work under policy;
* B1 pure and dry-run read-only;
* no runtime pin;
* B2F PASS + guarded merge.

---

## Independent review resolutions (B2A3)

| B2B finding | Resolution in 4C2E-B2A.3 |
| --- | --- |
| Synthetic publish contradictions | Single policy; rights_not_publishable excludes synthetic |
| Draft full edit vs package freeze | Content-frozen after ingest |
| Client report trust | Server B1 recompute; no client ok/report authority |
| Dual UNIQUE / circular package_id | packages.revision_id UNIQUE only; no reverse package_id |
| Soft 8 MiB example | Hard 1/8/2 MiB + 50k entries |
| Incomplete GUC fail-closed | Full grants + owner check + GUC + pgTAP probes |
| Incomplete RPC contracts | Named params/results/outcomes; phase ownership |
| Actor spoofing | No actor param; service_role attribution honest |
| Soft B2D multi-call seal | Automated invariants in B2D DoD |
| Stub vs full body in B2C | B2C schema only; B2D owns persist RPC |
| Soft-delete freeing checksum | No hard-delete in B2 |
| Legacy rows | provenance_required fail-closed |

---

## Non-executable design sketches

> **Non-executable design sketches — not migrations. Do not apply.**

```sql
-- SKETCH ONLY: packages (one-direction FK)
-- CREATE TABLE public.measured_boq_catalog_packages (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   revision_id uuid NOT NULL UNIQUE
--     REFERENCES public.measured_boq_catalog_revisions(id) ON DELETE RESTRICT,
--   input_checksum text NOT NULL UNIQUE CHECK (input_checksum ~ '^[0-9a-f]{64}$'),
--   content_checksum text NOT NULL CHECK (content_checksum ~ '^[0-9a-f]{64}$'),
--   catalog_revision text NOT NULL,
--   manifest_text text NOT NULL CHECK (pg_catalog.octet_length(manifest_text) <= 1048576),
--   snapshot_text text NOT NULL CHECK (pg_catalog.octet_length(snapshot_text) <= 8388608),
--   validation_report jsonb NOT NULL,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- SKETCH ONLY: lifecycle GUC
-- PERFORM pg_catalog.set_config(
--   'app.measured_boq_catalog_lifecycle_command', 'publish', true);

-- SKETCH ONLY: B2D RPC
-- CREATE FUNCTION public.persist_measured_boq_catalog_draft(
--   p_manifest_text text, p_snapshot_text text, ...
-- ) RETURNS jsonb
-- LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ ... $$;
-- REVOKE ALL ON FUNCTION public.persist_measured_boq_catalog_draft(...) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.persist_measured_boq_catalog_draft(...) TO service_role;
```

---

## Document control

| Item | Value |
| --- | --- |
| Plan version | **4C2E-B2A.3** |
| Base SHA | `0b382794f058b3b26b3b3e6bd9eb89b4efc42392` |
| Prior plan commit | `1da5d371f97ec3e7c139babacbd860f5c1334ef2` |
| Authoring phase | planning / consistency repair only |
| Next phase | `4C2E-B2B2 — Delta Independent Verification of the Repaired B2A Plan` |

**Do not begin B2 implementation before B2B2 passes and a separate implementation phase is explicitly authorised. Do not merge PR #100 before B2B2 passes.**
