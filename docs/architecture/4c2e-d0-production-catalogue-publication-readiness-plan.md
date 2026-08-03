# 4C2E-D0 — Lawful Production Catalogue Publication Readiness Plan

```text
Status: 4C2E-D0 PLAN COMPLETE
Plan quality verdict: PASS
Production readiness: BLOCKED — SOURCE OR LICENSING DECISION REQUIRED
Ticket: 4C2E-D0 (planning only)
Parent contracts:
  - 4c2e-production-catalogue-data-gate-plan.md (4C2E-A)
  - 4c2e-b1-source-agnostic-catalogue-tooling-plan.md
  - 4c2e-b2a-catalogue-persistence-publication-plan.md
  - l3-measured-boq-catalogue-foundation-plan.md
  - l3-save-seam-integration-plan.md
Base SHA at planning: 499b1837f889a374065be490fdc5cc6f9975e858
Branch: docs/4c2e-d0-production-publication-readiness
Merged infrastructure: PR #101 (4C2E-B2 programme)
```

This document is the **implementation-ready readiness and approval plan** for
the first **lawful** production measured-BOQ catalogue publication (**4C2E-D**).

It does **not** assemble, persist, publish, retire, or activate any production
catalogue. It does **not** authorise 4C2E-D1.

Evidence labels:

```text
[Repository-confirmed]  — verified in code, schema, tests, or committed docs
[External research]     — public licensing research (not legal advice)
[Reasoned recommendation] — engineering planning recommendation
[Unresolved]            — requires product, legal, or business approval
```

---

## 1. Status and decision

### Plan quality

```text
PASS — readiness plan complete, implementation-ready for later authorisation
```

### Production readiness

```text
BLOCKED — SOURCE OR LICENSING DECISION REQUIRED
```

Secondary open gates (do not unlock production alone):

```text
PRODUCT COVERAGE THRESHOLDS not signed by product owner
DUAL-APPROVAL OPERATORS not named for production
PRODUCTION SUPABASE MIGRATION DEPLOYMENT not verified in this phase
```

### One-paragraph summary

[Repository-confirmed] The **4C2E-B2** programme is **merged and closed** on
`main` at `499b1837f889a374065be490fdc5cc6f9975e858` (PR #101). The repository
has secure draft persistence, publish/retire/rollback lifecycle RPCs, request
and package identity serialisation, synthetic dry-run tooling, and an
exact-revision server reader that remains **inactive** in product routes.
[Repository-confirmed] No production rates are committed under
`catalogue-sources/measured-boq/revisions/`; the only package is synthetic
`mboq-2099.01.01`. Draft persistence accepts only
`licenceStatus ∈ {synthetic, rights_unverified}` and blocks `production: true`.
[Reasoned recommendation] Adopt the blended source strategy from 4C2E-A
(company-owned build-ups + OGL indexation + optional contracted suppliers +
optional later OEM). [Unresolved] No lawful production package, licence
approval, coverage sign-off, or dual-approval record exists. Therefore
**4C2E-D1 remains blocked**.

### Controlling principle

```text
Infrastructure readiness ≠ legal approval ≠ product coverage approval
≠ production publication ≠ reader activation.
```

---

## 2. Programme baseline

### Repository baseline (D0 start)

| Item | Value |
| --- | --- |
| Branch at planning start | `main` |
| HEAD | `499b1837f889a374065be490fdc5cc6f9975e858` |
| `origin/main` | same |
| Working tree | clean |
| Generated types checksum | `83d0e2c3311e3a66e94fbe0553d0132d53096c7a920eee84572d05331c4c6ff6` |
| Final B2 migration | `20260803140000_persist_measured_boq_catalogue_request_identity_repair.sql` |
| PR #101 | MERGED `2026-08-03T04:03:41Z` |

### Programme lineage (authoritative)

| Phase | Outcome |
| --- | --- |
| 4C2E-A | Data-gate plan; production rates blocked on licensing |
| 4C2E-B1 | Source-agnostic dry-run tooling + synthetic package |
| 4C2E-B2 (B2C–B2F2, B2D2R, B2G) | Schema, draft persist, lifecycle, request-identity repairs, merge |
| 4C2E-D0 (this document) | Lawful production readiness plan |
| 4C2E-D / D1 | **Not authorised** until readiness matrix all PASS |
| 4C2F-A | Reader activation planning — separate programme |

### Numbering note

[Repository-confirmed] Save-seam docs use **4C2E** for builder adapters and
**4C2F** for reader cutover. The **4C2E-A/B/D** series is the **catalogue data
and publication** track. Builder cutover and reader activation remain separate.

---

## 3. Completed B2 capability

[Repository-confirmed] After PR #101:

### Schema and storage

| Capability | Evidence |
| --- | --- |
| Package-backed immutable revisions | `20260802060000_measured_boq_catalogue_persistence_foundation.sql` |
| Packages, entries, append-only events | same + foundation tests |
| Draft persist RPC | `persist_measured_boq_catalog_draft` (+ B2D2R request-lock repair) |
| Publish / retire / rollback RPCs | lifecycle migrations + B2E1 request-identity repair |
| service_role SELECT-only on catalogue tables | grants + pgTAP |
| SECURITY DEFINER, `search_path = ''`, postgres owner | RPC migrations |
| No active-revision pointer | explicit non-goals in lifecycle migrations |
| No production seed data | migrations create no production rows |

### Application and CLI

| Capability | Evidence |
| --- | --- |
| B1 dry-run pipeline | `runCatalogueDryRun`, `scripts/catalogue-dry-run.ts` |
| Draft persist CLI | `scripts/catalogue-persist.ts` (no publish flags) |
| Draft application command | `persistMeasuredBoqCatalogueDraft.server.ts` |
| Publish / retire / rollback application | `*MeasuredBoqCatalogue*.server.ts` lifecycle commands |
| Repositories: single `.rpc` write path each | infrastructure `*.repository.server.ts` |
| Exact-revision authority/reproduction loader | `measuredBoqCatalogue.repository.server.ts` |
| Reprice composition (dormant) | `repriceMeasuredBoqWithCatalogue.server.ts` |

### Concurrency and identity

| Capability | Evidence |
| --- | --- |
| Package advisory lock (input checksum) | B2D persist |
| Request advisory lock **before** package lock | B2D2R |
| Lifecycle request locks + ascending UUID row locks | B2E1 |
| Outcomes: `created`, `idempotent_replay`, `request_conflict`, … | RPC contracts |
| Multi-session verifiers | `verify:b2d:*`, `verify:b2e:*` |

### Explicit B2 exclusions (still true)

```text
no production catalogue rates
no source scraping or acquisition tooling
no active-revision / latest pointer
no estimate-builder activation
no automatic repricing of estimates
no lifecycle operational CLI package commands
no production Supabase deployment in B2
no runtime catalogue selection by product UI
```

### Implication for 4C2E-D

B2 provides the **technical write boundary**. It does **not**:

- approve licence status for production packages;
- enforce dual human approval at the database layer for production;
- measure product coverage thresholds;
- deploy migrations to production;
- activate readers.

Those remain **4C2E-D / D1 and later** gates.

---

## 4. Source and licensing inventory

Status values: **APPROVED** | **REJECTED** | **UNRESOLVED** | **NOT APPLICABLE**.

Do not mark **APPROVED** without explicit organisational evidence outside this
repository. Grok Build does **not** provide legal approval.

| Source class | Proposed use | Ownership | Licence basis | Redistribution rights | Multi-tenant SaaS rights | Modification rights | Attribution | Audit evidence available | Contamination risk | Production eligibility | Decision owner | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Company-owned QS build-ups | Core unit rates | Company | First-party work product | Company-controlled | Yes **if** no third-party book contamination | Full (company) | Internal method refs | Methodology + build sheet refs (external) | High if rekeyed from books | Eligible **after** legal/product attestation | Legal + Product + Estimating SME | **UNRESOLVED** |
| OGL construction indices | Time/index adjustment factors (not unit rates) | Public sector (UK OGL) | OGL v3 (external) | Yes as **indices** with attribution | Yes as indices | Per OGL | Required | OGL version + retrieval date (external) | Low if not used as unit rates | Eligible for **index factors only** after legal confirm of exact datasets | Legal | **UNRESOLVED** |
| Contracted supplier data | Materials refresh | Supplier | Written contract | Only as contracted | Only as contracted | Per contract | Per contract | Signed contract ref (external) | Medium (scope creep) | Eligible only with contract clause covering SaaS estimates | Legal + Procurement | **UNRESOLVED** |
| Customer-derived aggregates | Calibration (later) | Customer / company process | ToS + privacy | Only if ToS allows | Only if ToS allows | Aggregates only | Privacy policy | ToS version ref | High (PII / confidential) | Not for first production pack | Legal + Product | **UNRESOLVED** / later |
| Commercial OEM data licences (e.g. BCIS OEM) | Optional calibrated layer | Vendor | Signed OEM | Per OEM only | Per OEM only | Per OEM | Per OEM | Signed OEM + schedule (external) | Medium (isolation) | Later phase only | Legal + Finance | **UNRESOLVED** |
| Commercial books / desk subscriptions (BCIS desk, Spon’s, Laxton’s) | Forbidden backbone | Publisher | Consumer/desk T&Cs | **No** for SaaS backbone | **No** | **No** bulk rekey | N/A | N/A — do not use | Critical | **Not eligible** | Legal | **REJECTED** (default) |
| Legacy `CATEGORY_BASE` / `TRADE_RATES` | Not measured-BOQ authority | Company legacy | N/A | N/A as measured-BOQ | N/A | N/A | N/A | Repo legacy constants | High (wrong authority model) | **Not eligible** | Engineering + Product | **REJECTED** |
| AI-generated / mock rates | Dev/test only | N/A | None | None as “validated” | None | N/A | Must label synthetic | Synthetic fixtures only | Critical if mislabeled | **Not eligible** for production | Engineering | **REJECTED** for production |
| Synthetic fixture packages | Local/CI only | Repo | synthetic | N/A | N/A | N/A | synthetic | `mboq-2099.01.01` | None if labeled | **NOT APPLICABLE** to production | Engineering | **APPROVED** for non-production only |

### Notes

- **APPROVED** appears only for **synthetic non-production** use already committed.
- All real-world production source classes are **UNRESOLVED** or **REJECTED**.
- Possession, subscription, or public accessibility of a dataset does **not**
  imply redistribution rights.

---

## 5. Prohibited sources

The following are **prohibited** for measured-BOQ production packages unless a
**separate written licence** explicitly grants multi-tenant SaaS redistribution,
modification, and display rights for customer estimates:

```text
BCIS data obtained through a standard desk subscription
Spon’s price-book tables
Laxton’s price-book tables
bulk rekeying of commercial cost books
scraped supplier websites
unlicensed third-party spreadsheets
AI-generated rates represented as externally validated rates
legacy CATEGORY_BASE or TRADE_RATES promoted as measured-BOQ authority
```

No implementation phase may copy, transform, or publish these sources without
the required licence. Dry-run and draft tooling must continue to treat
`production: true` as fail-closed until legal status is externally approved
and encoded in the package contract (see §8–9).

---

## 6. Recommended source strategy

### Engineering recommendation

[Reasoned recommendation] Adopt **Option C — Blended** (from 4C2E-A):

```text
company-owned unit-rate build-ups
  + OGL-compatible time/index adjustment (not unit rates)
  + optional contracted supplier feeds
  + optional later commercial OEM (isolated layer)
```

Implemented as a **gated provisional path**:

| Phase | Allowed | Forbidden |
| --- | --- | --- |
| P0 Gate closed (current) | Tooling, synthetic, rights_unverified drafts | Production rates |
| P1 Provisional owned rates | Internal rates + OGL factors after dual approval | Marketing as BCIS/Spon’s; scraping |
| P2 Controlled production | Explicit pins to published lawful revisions | Harvested commercial books |
| P3 Optional OEM | Isolated licensed module under signed OEM | Silent merge into “our rates” |

### Repository evidence for strategy adoption

| Question | Answer |
| --- | --- |
| Sufficient engineering tooling to process packages? | **Yes** (B1 + B2) |
| Sufficient legal evidence in-repo to approve sources? | **No** |
| Sufficient QS build-up content in-repo? | **No** (synthetic only) |
| Sufficient to **recommend** blended strategy? | **Yes** (engineering) |
| Sufficient to **authorise** production? | **No** |

### Decision separation

| Kind | Who decides | Grok Build role |
| --- | --- | --- |
| Engineering recommendation | Engineering | **May recommend** (this section) |
| Business decision (fund QS build, OEM budget) | Leadership / Product | Document options only |
| Legal decision (licence, redistribution, contamination) | Legal | Document gates only; **no approval** |
| Product decision (coverage thresholds, pilot scope) | Product + Estimating SME | Propose measurable defaults only |

---

## 7. Decision record

Before 4C2E-D1, complete an external **decision record** (store confidential
licence text offline; repository holds **references only**).

| Field | Requirement |
| --- | --- |
| Decision ID | e.g. `MBOQ-SRC-YYYY-NNN` |
| Decision date | ISO date |
| Catalogue source strategy | A / B OEM / **C Blended** / D block |
| Approved source classes | Explicit list |
| Rejected source classes | Explicit list |
| Licence or ownership evidence references | External doc IDs / vault paths only |
| Permitted product uses | e.g. indicative refurb estimates UK |
| Permitted territories | e.g. UK |
| Permitted customer classes | e.g. B2B SaaS tenants |
| Attribution requirements | Exact strings / OGL notice |
| Data-retention conditions | Years / deletion |
| Termination conditions | Licence end → retire revision |
| Decision owners | Named roles |
| Legal approver | Named |
| Product approver | Named |
| Technical approver | Named |
| Expiry or review date | ISO date (≤ 12 months recommended) |

Template status today:

```text
Decision ID: UNASSIGNED
Catalogue source strategy: RECOMMENDED C — not signed
Approved source classes: none for production
Rejected source classes: commercial books/desk harvest; legacy category/trade; AI-as-validated
All approvers: UNRESOLVED
```

---

## 8. Production package contract

### Layout (do not create in D0)

```text
catalogue-sources/measured-boq/revisions/<catalog_revision>/
  MANIFEST.json
  snapshot.json
  evidence/                  # optional; no secrets
    methodology-ref.txt      # reference IDs only
    approval-ref.txt         # decision IDs only
    dry-run-report.json      # optional machine report
```

`catalog_revision` grammar [Repository-confirmed]:

```text
^mboq-[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$
length 15–64
```

### MANIFEST fields (production target contract)

The B1 manifest schema today is intentionally minimal
([Repository-confirmed] `manifestTypes.ts`):

```text
manifestVersion, catalogRevision,
source.{id,name,version,effectiveDate,retrievedAt?,licenceReference,licenceStatus},
transformation.{schemaVersion,normaliserVersion},
package.{snapshotPath,production}
licenceStatus ∈ {synthetic, rights_unverified} only
```

**4C2E-D production packages** require an **extended** governance envelope.
Until the schema is extended under a separately authorised tooling change,
production packages remain **blocked**. Planned fields:

| Field | Required | Class | In semantic request identity | In package/input checksum | In content checksum |
| --- | --- | --- | --- | --- | --- |
| `schemaVersion` / `manifestVersion` | Yes | authoritative | No | Yes (input package) | No |
| `catalogRevision` | Yes | authoritative | Yes (with persist request material) | Yes | Yes (snapshot body) |
| `sourceId` (`source.id`) | Yes | authoritative | Yes | Yes | No (manifest-only unless also in snapshot) |
| `sourceDescription` | Yes | informational + DB revision | No | Yes | Snapshot if carried |
| `production` | Yes = true | authoritative | Yes | Yes | Snapshot flag |
| `licenceStatus` | Yes = externally approved enum | authoritative | Yes | Yes | No |
| `effectiveFrom` | Yes | authoritative | No | Yes | Snapshot/revision |
| `createdBy` | Yes | authoritative | No | Yes | No |
| `normaliserVersion` | Yes | authoritative | Yes | Yes | No |
| `methodologyReference` | Yes | secret-reference-only OK | No | Yes | No |
| `ownershipReference` | Yes | secret-reference-only OK | No | Yes | No |
| `licenceReference` | Yes | secret-reference-only OK | No | Yes | No |
| `approvalReference` | Yes | secret-reference-only OK | No | Yes | No |
| `coverageProfile` | Yes | authoritative product id | No | Yes | No |
| `inputChecksum` | Yes | authoritative | Yes | Identity of raw package | No |
| `contentChecksum` | Yes | authoritative | Yes | Derived from snapshot | **Is** content |
| `entryCount` | Yes | authoritative | Yes | Derived | Derived |
| `source.name` / version | Yes | informational | No | Yes | No |
| `retrievedAt` | Recommended | informational | No | Yes | No |

**Content checksum** remains the SHA-256 of the **canonical validated snapshot
serialisation** (entries + revision identity fields already defined by pure
validation). MANIFEST governance fields are **excluded** from content checksum
unless duplicated into the snapshot body.

**Input checksum** covers raw `MANIFEST.json` + raw snapshot bytes (or the
documented package hashing order in B1 `packageChecksum`).

### Current code gate vs production

[Repository-confirmed] `persistMeasuredBoqCatalogueDraft`:

- allows `licenceStatus` only `synthetic` | `rights_unverified`;
- returns `production_blocked` for `production: true`.

Therefore **production persistence requires a separately authorised change** to
accept a **new approved licence status** (or equivalent external approval
binding) after legal sign-off. D0 does not implement that change.

---

## 9. Approval identity

### Immutable package identity (binding)

Every production approval is bound to:

```text
catalogRevision
inputChecksum
contentChecksum
entryCount
sourceId
normaliserVersion
```

If **any** field changes, all prior approvals are **invalid** and must be
re-issued.

### Dual-approval model (minimum three roles)

| Approval | Owner | Must verify |
| --- | --- | --- |
| Legal / source | Legal | Source class lawful; licenceReference; no prohibited sources; SaaS rights |
| Product / coverage | Product + Estimating SME | Coverage profile thresholds; pilot/production scope; exclusions |
| Technical publication | Engineering (catalogue owner) | Validation gate green; checksums; environment; RPC path; evidence |

**Same person must not supply all three** unless a written small-team exception
is recorded in the decision record (name both the exception and the dual
control that remains).

### Approval record (external + package reference)

```text
approvalReference → Decision ID
package identity fields (above)
approver names / roles
timestamps
expiry/review date
```

Approvals are **not** valid if only informal email text exists without the
checksum-bound identity.

---

## 10. Coverage taxonomy

### Dimensions (measurable)

| Dimension | Unit of measure | Notes |
| --- | --- | --- |
| Trades / domains | count of distinct `tradeOrDomain` with ≥1 active entry | Map from product category list |
| Work categories | count of distinct rate-key second segments | Grammar `trade.work.unit` |
| Measurement units | set equality vs `{m2,m,item,hr,day}` | Extra units = **block** |
| Cost types | set ⊆ `{labour,materials,combined}` | |
| Common refurb scopes | binary per named scope pack | See pilot list |
| Property types | declared applicability set in coverageProfile | e.g. residential refurb |
| Regional applicability | must be `uk-region-multipliers-v1` national base | Engine applies multipliers |
| Rate recency | days since `effective_from` | default max **365** days |
| Source-reference completeness | % entries with non-empty `source_reference` | production ⇒ **100%** |
| Deprecated behaviour | count deprecated without valid `replacement_rate_key` | **0** allowed for pilot |

### Formulas

```text
coverage_numerator(domain) =
  count of mandatory rate-keys present as status=active in snapshot

coverage_denominator(domain) =
  count of mandatory rate-keys in coverageProfile for that domain

domain_coverage(domain) = numerator / denominator

overall_coverage =
  sum(numerators) / sum(denominators)

source_reference_completeness =
  entries_with_nonempty_source_reference / entryCount
```

### Thresholds (planning defaults — product must sign)

| Gate | Metric | Pilot threshold | Production threshold |
| --- | --- | --- | --- |
| Overall mandatory keys | `overall_coverage` | ≥ **0.80** | ≥ **0.95** |
| Per mandatory domain | `domain_coverage` | ≥ **0.70** each | ≥ **0.90** each |
| High-frequency lines | named key list present | **100%** of pilot HF list | **100%** of production HF list |
| Source references | completeness | **1.00** | **1.00** |
| Units | only canonical set | PASS | PASS |
| Recency | `effective_from` age | ≤ **365** days | ≤ **365** days |
| Authority fallback | invented rates | **0** | **0** |
| Entry count | `entryCount` | ≥ **1** and ≥ pilot key count | ≥ production key count |
| Prohibited sources | count | **0** | **0** |

### Mandatory domain list (planning default)

From 4C2E-A / product categories [Reasoned recommendation]:

```text
kitchen, bathroom, flooring, decoration, electrical, plumbing, heating,
roofing, structural, damp, garden, windows_doors, plastering, carpentry
```

### High-frequency lines (planning default)

```text
decoration wall finish m2
flooring floor finish m2
bathroom wall tile m2
kitchen fit-out item
bathroom fit-out item
electrical rewire item
plumbing basic item
```

Exact `rate_key` strings are fixed in the **coverageProfile** document when
product signs the pilot (D1 pre-work). Until then keys remain placeholders and
the gate stays **BLOCKED**.

### Acceptable vs blocking exclusions

| Exclusion type | Example | Pilot | Production |
| --- | --- | --- | --- |
| Acceptable | Specialist conservation stonework | Yes if listed | Yes if listed |
| Acceptable | Commercial new-build only scopes | Yes | Yes |
| Blocking | Missing decoration wall m2 | No | No |
| Blocking | Missing kitchen/bathroom fit item | No | No |
| Blocking | Any prohibited source | No | No |
| Blocking | production true without source_reference | No | No |

Vague phrases (**good coverage**, **most common work**, **sufficiently complete**)
are **forbidden** as acceptance criteria.

---

## 11. Pilot-pack definition

### Purpose

Smallest **lawful** and **technically useful** package for **publication
verification only**. Not for runtime activation.

### Bounds

| Attribute | Requirement |
| --- | --- |
| Source material | Only **approved** classes from decision record |
| Scope | Named residential refurbishment pilot (UK) |
| Trades | Subset of mandatory domains with explicit list |
| Invented rates | **None** |
| Unsupported categories | Explicit list in evidence (no silent fill) |
| Effective dates | Exact `effective_from` on revision |
| Source references | Every entry |
| Units / cost types | Canonical only |
| B1 pipeline | Must pass dry-run |
| Product readers | **Remain inactive** |
| Licence | External approval + package fields |
| Identity | Full checksum-bound identity |

### Pilot non-goals

```text
no estimate builder default pin
no UI “use latest catalogue”
no automatic reprice
no marketing claim of national commercial book parity
```

### Until legal approval

Use **synthetic** or **explicitly approved non-production** fixtures only for
technical dry-runs. Do not treat synthetic packs as production pilots.

---

## 12. Technical validation gate

Sequence **before** production draft persistence:

| # | Step | Existing implementation | Existing test | Missing | Manual evidence | Blocking? |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | Package structure (MANIFEST + snapshot inside revision root) | CLI path realpath checks | dry-run tests | — | — | Blocking |
| 2 | Manifest schema | `parseCatalogueManifest` | B1 tests | Production field extensions | — | Blocking |
| 3 | Raw-artifact byte limits | persist RPC / app validation | pgTAP + unit | — | — | Blocking |
| 4 | Input checksum | B1 package checksum | dry-run | — | — | Blocking |
| 5 | Normalisation (unit aliases) | `normaliseCatalogueSnapshot` | B1B pipeline tests | — | — | Blocking |
| 6 | Canonical unit validation | pure validate | validation tests | — | — | Blocking |
| 7 | Rate-key grammar | pure validate | validation tests | — | — | Blocking |
| 8 | Duplicate detection | pure validate | validation tests | — | — | Blocking |
| 9 | Numeric precision | B1 decimal grammar | tests | — | — | Blocking |
| 10 | Positive-rate validation | pure validate | tests | — | — | Blocking |
| 11 | Source-reference validation | production ⇒ required | tests | — | — | Blocking |
| 12 | Content checksum | pure checksum | tests | — | — | Blocking |
| 13 | Entry count | pure + DB | tests | — | — | Blocking |
| 14 | Cross-revision semantic checks | **Missing** as automated product gate | partial comparative ideas in 4C2E-A | Implement under D1 tooling or ops script | SME review | Blocking for production |
| 15 | Coverage calculation | **Missing** automated | — | coverageProfile tool | Product sign-off | Blocking |
| 16 | Approval-identity match | **Missing** automated binding | — | approval checker | Dual approvals | Blocking |
| 17 | Licence gate for production | Blocks `production:true` today | persist tests | Approved status path | Legal record | Blocking |
| 18 | Rights policy at publish | lifecycle denies rights_unverified publish | B2E verifier | Production licence path | — | Blocking |

---

## 13. Cross-revision controls

Against the **prior published** revision (if any):

| Check | Rule | Threshold approach |
| --- | --- | --- |
| Unexpected rate-key deletion | Report deleted keys in mandatory set | **0** mandatory deletions without product waiver |
| Unexpected unit change same key | Treat as **new key required** | Any unit change = **block** |
| Unexpected cost-type change | Same | **block** |
| Unbounded price movement | Per-key absolute % change | **No single global %**. Defaults by cost type (planning): labour ≤ 25%, materials ≤ 40%, combined ≤ 30% vs prior; exceedance requires SME waiver bound to identity |
| Source-reference removal | Non-empty → empty | **block** |
| active → deprecated | Requires `replacement_rate_key` present in pack | **block** if missing |
| replacement-key validity | Target exists, ≠ self | **block** |
| Coverage regression | `overall_coverage` drop | > **5 pp** drop = **block** unless product waiver |
| effective-date regression | `effective_from` moves backward | **block** without explicit supersession note |

Thresholds may be tightened per trade in coverageProfile.

---

## 14. Publication dry-run

### Environment

Local or **staging only**. Fail closed if target is production without
allowlist.

### Sequence

```text
1.  read immutable package from revision path
2.  run B1 validation (catalogue:dry-run)
3.  verify package identity fields
4.  verify dual approvals match identity
5.  persist draft (catalogue-persist or application command)
6.  read draft state via service_role SELECT / inspection query
7.  publish exact revision (application lifecycle command — not yet a public CLI)
8.  authority-load exact revision (loadMeasuredBoqCatalogueSnapshot purpose=authority)
9.  recompute content checksum; match stored
10. verify entry count
11. retire only via separate explicit command + new request ID
12. clean isolated environment / fixtures
```

### Fixture policy until legal gate

```text
synthetic OR explicitly approved non-production packages only
licenceStatus must not be claimed production-approved without decision record
```

---

## 15. Production publication runbook

**Not executed in D0.** Future 4C2E-D operators follow this controlled sequence.

### Preconditions

```text
- decision record complete and unexpired
- readiness matrix all PASS
- production migration deploy already approved and applied (separate op)
- package on approved path with exact identity
- operator on allowlist
- dual approvals attached to identity
- environment verification script PASS
```

### Command-by-command outline

| Step | Action | Identity captured |
| --- | --- | --- |
| 0 | Record operator identity, time, ticket | operator |
| 1 | Verify environment name + Supabase project ref match allowlist | env |
| 2 | Confirm linked project (if any) is the **intended** production project — no silent reuse | project ref |
| 3 | Confirm package path | path |
| 4 | Record revision identity (all six binding fields) | identity |
| 5 | Allocate new UUIDs: `persist_request_id`, `publish_request_id` | request IDs |
| 6 | `pnpm catalogue:dry-run` with expected checksums | dry-run report |
| 7 | Verify approval documents match identity | approvals |
| 8 | Persist draft (after production licence path authorised) | draft result |
| 9 | Inspect draft revision row + package + entry counts | SQL evidence |
| 10 | Publish via trusted application/RPC path only | publish result |
| 11 | Authority-load exact revision; recompute checksum | load result |
| 12 | Verify audit event `accepted` for publish scope | event ID |
| 13 | Write evidence bundle (§17) | bundle path |
| 14 | Final status: PUBLISHED — **readers still inactive** | status |

### Explicit non-steps

```text
do not set latest pointer
do not change builders or UI
do not reprice historical estimates
do not print service-role secrets
do not use browser credentials for catalogue writes
```

### Gap note

[Repository-confirmed] There is **no** production lifecycle CLI today. Publish
is an application/RPC path. D1/D ops may add a **fail-closed** operational
entrypoint under separate authorisation; until then production publish is
performed only by named operators through the controlled server path with
logged request IDs.

---

## 16. Environment safety

Future runbook **fails closed** unless all pass:

| Control | Requirement |
| --- | --- |
| Explicit production environment name | e.g. `refurb-genius-production` — no default |
| Explicit Supabase project reference | compared to allowlist file/secret |
| Operator confirmation | interactive typed revision + checksum |
| Approved revision allowlist | exact `catalogRevision` |
| Exact checksum allowlist | `inputChecksum` + `contentChecksum` |
| No default production target | empty config ⇒ refuse |
| No automatic linked-project reuse | must re-state project ref each run |
| No browser credentials | service role only via secure secret mount |
| No printed service-role secret | redact logs |
| Ambiguous commands | prohibited (no multi-env flags without explicit name) |

---

## 17. Evidence bundle

Tamper-evident ops artifact (not browser; no secrets):

```text
reports/catalogue/<catalogRevision>/<contentChecksumPrefix>-publish.json
```

### Required fields

```text
catalogRevision
inputChecksum
contentChecksum
entryCount
sourceId
effectiveFrom
normaliserVersion
approvalReferences[]
operator
persistRequestId
publishRequestId
databaseRevisionId
packageId
publicationEventId
publicationTimestamp
authorityLoadResult
postPublicationChecksumResult
coverageReport
validationRunReferences[]
```

### Forbidden in bundle

```text
raw secrets / service-role key
full commercial licence text
private supplier credentials
unredacted confidential contracts
full rate payload dumps
```

---

## 18. Retirement and rollback

### Retirement

| Field | Requirement |
| --- | --- |
| reason | mandatory free text ≤ schema limit |
| request ID | new UUID |
| affected revision | exact `catalogRevision` |
| replacement revision | optional pin guidance only (not auto-activated) |
| product impact | written assessment |
| authority-reader after | `CATALOG_REVISION_NOT_PUBLISHED` |
| reproduction-reader after | still loads retired |
| audit evidence | retirement event row |

### Rollback (`rollback_measured_boq_catalog_publication`)

[Repository-confirmed] B2E/B2E1 semantics:

```text
erroneous target revision → retired
named prior revision → remains unchanged (not re-published, not activated)
reason + request ID required
audit event recorded
no deadlock on opposite-order concurrent rollbacks (UUID ordered locks)
```

**Rollback does not activate or republish the prior revision.** Future
authority pins remain an explicit product decision.

---

## 19. Incident response

| Class | Severity | Immediate containment | Retire? | Rollback? | Customer impact | Legal notify owner | Evidence | Republication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Licensing defect | Critical | Stop further publishes; revoke production package path | Yes | If dual-rev confusion, use rollback carefully | Review estimates pinned to revision | Legal | Full bundle + decision void | Only with new lawful package |
| Incorrect source attribution | High | Freeze package path | Usually | Optional | Review | Legal | Bundle | New revision |
| Checksum mismatch | Critical | Do not serve; fail closed | If published corrupt | Yes if dual state | High | Engineering lead | Load errors | New revision only |
| Coverage defect | High | Block activation / new pins | Optional | Optional | Product | Product | Coverage report | Expanded pack |
| Material rate error | High | Retire for authority | Yes | Prefer new fix revision | Review | Product + Engineering | Diff evidence | New revision |
| Duplicate / conflicting request | Medium | Rely on request_conflict | No | No | Low | Engineering | RPC outcomes | Retry with new request |
| Wrong environment target | Critical | Rotate secrets if exposed; halt | If wrong env published | Yes | High | Engineering + Legal | Env evidence | Correct env only |
| Unauthorised publication | Critical | Retire; access review | Yes | As needed | High | Legal + Security | Audit trail | After governance fix |
| Reader activation before approval | Critical | Disable activation path | N/A | N/A | High | Product + Engineering | Config diff | After 4C2F approval |

---

## 20. Reader separation

[Repository-confirmed] 4C2E-D (when later authorised) **publishes catalogue data
only**.

It must **not**:

```text
activate latest/current selection
create an active-revision pointer
change estimate builders
change routes or UI
automatically reprice estimates
enable production authority reads by default
begin 4C2F-A implementation
```

Exact-revision load remains available for **server-side** composition when an
explicit `catalogRevision` is supplied. Product default paths stay dormant
until a **separate** activation programme.

---

## 21. Database-deployment separation

| Operation | What it is | Approvals needed | D0 |
| --- | --- | --- | --- |
| Repository migrations already merged | Code on `main` | Engineering (done in B2) | No action |
| Production migration deployment | Apply SQL to production Supabase | Engineering lead + change management | **Not performed** |
| Production package persistence | Draft RPC with production package | Legal + Product + Technical | **Not performed** |
| Production revision publication | Publish RPC | Same dual model + technical | **Not performed** |
| Product reader activation | 4C2F | Product + Engineering | **Not performed** |

These are **separate** operations. Completing one never silently implies the next.

---

## 22. Readiness matrix

| Gate | Required evidence | Decision owner | Current state | Blocking defect | Closure action | Verification command / method |
| --- | --- | --- | --- | --- | --- | --- |
| Source ownership | Decision record + ownership refs | Legal + Product | **BLOCKED** | No signed source decision | Complete §7 record | External legal file ref |
| SaaS redistribution rights | Written rights for every source class used | Legal | **BLOCKED** | No SaaS rights attested | Legal opinion / contract | External |
| Methodology approval | Methodology reference + SME sign-off | Estimating SME + Product | **BLOCKED** | No methodology pack | Build QS method pack | External review |
| Coverage definition | Signed coverageProfile with keys | Product | **BLOCKED** | Keys not frozen | Freeze rate-key list | Doc review |
| Pilot coverage threshold | Measured report ≥ pilot thresholds | Product | **BLOCKED** | No production pack | Build pilot package | Coverage tool (to build) |
| Source-reference completeness | 100% on production entries | Engineering | **BLOCKED** | No production pack | Validate snapshot | dry-run + pure validate |
| Package identity | Six binding fields present | Engineering | **BLOCKED** | No production pack | Emit identity sheet | dry-run JSON |
| Technical validation | Full §12 sequence green | Engineering | **PASS** for synthetic path; **BLOCKED** for production path | Production licence path missing | Authorise D1 tooling + package | `pnpm catalogue:dry-run`; local B2 verifiers |
| Database environment identity | Allowlist + project ref | Engineering / Ops | **NOT VERIFIED** | Production project not verified here | Ops runbook bind | Env verify script (future) |
| Operator authorisation | Named operators | Engineering lead | **BLOCKED** | No operator list | Name operators | Access control list |
| Dual approval | Three-role sign-off on identity | Legal + Product + Engineering | **BLOCKED** | No approvers named | Sign identity sheet | Checklist |
| Publication evidence | Bundle schema ready | Engineering | **PASS** (schema defined); pack not produced | — | Produce at publish | Bundle schema review |
| Retirement procedure | B2E RPC + runbook | Engineering | **PASS** (RPC exists); ops drill not done | No production drill | Staging drill | B2E verifier + drill |
| Incident response | §19 table | Engineering + Legal | **PASS** (defined) | Unexercised | Tabletop | Review |
| Reader separation | No activation in D0/D | Product + Engineering | **PASS** | — | Maintain exclusion | Invariants + code review |

**Any mandatory gate not PASS prevents production publication.**

---

## 23. Implementation sequence

```text
1. Legal + Product: sign source strategy (recommended C) and decision record
2. Estimating SME: build company-owned pilot rates; attestation against contamination
3. Product: freeze coverageProfile keys and thresholds
4. Engineering (separately authorised):
     - extend licenceStatus / production gate for approved packages only
     - coverage calculator + approval-identity checker
     - optional fail-closed production publish entrypoint
5. Staging: full dry-run + persist + publish + authority load + retire drill
6. Change management: production migration deploy (if not already)
7. 4C2E-D1: first lawful package + controlled publication (only if matrix all PASS)
8. 4C2E-E: post-publication verification
9. 4C2F-A: reader activation planning (separate)
```

No step auto-authorises the next.

---

## 24. Acceptance criteria

### D0 planning acceptance

```text
[x] clean main baseline at B2 merge
[x] B2 programme recognised as merged infrastructure
[x] source classes inventoried with statuses
[x] prohibited sources explicit
[x] legal/business decisions separated from engineering
[x] checksum-bound approval identity defined
[x] measurable coverage thresholds defined
[x] pilot pack bounded
[x] technical validation mapped to existing/missing
[x] runbooks defined but not executed
[x] reader activation excluded
[x] readiness matrix complete
[x] documentation-only change surface
```

### Production publication acceptance (future D1)

```text
[ ] readiness matrix all PASS
[ ] decision record unexpired
[ ] package identity dual-approved
[ ] technical validation green on exact package
[ ] staging drill green
[ ] production env verified
[ ] evidence bundle written
[ ] readers still inactive
```

---

## 25. Final recommendation

```text
PLAN QUALITY: PASS
PRODUCTION READINESS: BLOCKED — SOURCE OR LICENSING DECISION REQUIRED

INFRASTRUCTURE: B2 merged — secure persist/publish/retire/rollback available
DATA: synthetic only — no lawful production package
LEGAL: unresolved for all non-synthetic production source classes
PRODUCT: coverage profile not signed
NEXT SAFE STEP: complete decision record + pilot package under dual approval;
               then authorise 4C2E-D1 only when readiness matrix is all PASS

4C2E-D1 remains blocked pending named source, licensing, coverage, and approval decisions.
```

### Leadership checklist

| # | Decision | Options |
| --- | --- | --- |
| 1 | Source strategy | Confirm **C Blended** / A / B OEM / D block |
| 2 | Fund internal QS build | Yes / No |
| 3 | Pursue commercial OEM | Yes / No / Later |
| 4 | Freeze pilot coverageProfile | Sign / defer |
| 5 | Name dual approvers + operators | Assign / defer |
| 6 | Authorise production licence path in code | Only after 1–5 |

---

## Appendix A — B2 surface index (repository-confirmed)

| Path | Role |
| --- | --- |
| `packages/services/src/measured-boq/catalogue/*` | Pure validation, checksum, dry-run |
| `scripts/catalogue-dry-run.ts` | Read-only package validation CLI |
| `scripts/catalogue-persist.ts` | Draft persist CLI (no publish) |
| `src/features/estimate/application/measuredBoq/*` | Draft + lifecycle application commands |
| `src/features/estimate/infrastructure/catalogue/*` | Loader + RPC repositories |
| `supabase/migrations/20260802*.sql` … `20260803140000_*.sql` | Persistence + lifecycle |
| `catalogue-sources/measured-boq/revisions/mboq-2099.01.01/` | Synthetic only |

## Appendix B — Explicit D0 non-goals

```text
no production package assembly
no production MANIFEST/snapshot
no DB writes (local production-like optional inspection only if already available)
no production Supabase access
no scraping
no 4C2E-D1 implementation
no reader activation
no estimate repricing
no merge of this plan without independent review
```
