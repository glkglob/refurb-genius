# L3 Measured-BOQ Catalogue Foundation Plan

```text
Status: Discovery and architecture decision complete (Ticket 4C2C-A)
Parent contract: l3-estimate-authority-contract.md
Parent integration plan: l3-save-seam-integration-plan.md
Implementation status: Planning only — no production catalogue, migration, or resolver
Ticket: 4C2C-A
Base SHA at planning: 9408b203fd27dd171455cf663bd9e47ee58c9309
Branch: plan/4c2c-measured-boq-catalogue
Issue #90: OPEN — unrelated full database.types.ts baseline debt (out of scope)
```

This document is the **implementation-ready plan** for Ticket **4C2C-B**
(catalogue mechanism + minimum per-item library provenance). It does **not**
implement schema, rates, resolver, measured-BOQ persistence, or builder cutover.

---

## 1. Status and scope

### In scope (4C2C-A)

```text
Discovery of engine contract and rate inventory
Architecture decisions for catalogue ownership, keys, units, cost types
Revision, resolver, provenance, RLS, immutability, reproduction
4C2C-B file allowlist, test matrix, go/no-go gates
Documentation only
```

### Out of scope (strict)

```text
catalogue tables / JSON / production rate data
database migrations
resolver or measured-BOQ RPC implementation
manual / AI builder integration
reader cutover, cache keys, ROI / report / pitch-deck changes
user-quote authority, fuzzy matching, scraping
engine formula changes (runMeasuredBoqEngine / repriceMeasuredBoq /
  runPricingEngine / regional multipliers / VAT / contingency / low-high)
4C2B category path changes
issue #90 full type-generation baseline repair
```

### Locked rules (from parent contracts)

```text
library amounts come only from a trusted resolver
caller supplies rate identity only
catalogue snapshots are immutable
initial canonical measured-BOQ estimates must use exactly one catalogue revision
commands containing more than one revision are rejected with MIXED_CATALOG_REVISIONS
minimum library provenance is part of 4C2C
builder integration is not part of 4C2C
user quotes remain deferred
fuzzy catalogue matching is forbidden
```

---

## 2. Executive decision

| Decision | Choice |
| --- | --- |
| Production rate-data readiness | **C** — rate data exists in repo but rights/provenance for a line catalogue are unclear; **no production measured-BOQ library** |
| Catalogue ownership model | **Option C — Hybrid** (version-controlled reviewed source → immutable DB revision) |
| 4C2C-B implementation readiness | **GO WITH DATA GATE** — mechanism, provenance schema, resolver, and tests can land; **production rate publication blocked** until lawful source + licence approval |
| Engine redesign | **Not required** as a prior ticket — gaps closed at resolver, application composition, result mapping, and optional **additive** catalogue entry fields |
| Initial authority lines | **Library-only** (user-quote deferred; AI/fallback remain draft) |

```text
GO/NO-GO: GO WITH DATA GATE — FOUNDATION CAN BE BUILT, PRODUCTION RATES REQUIRE APPROVAL
```

**Rationale in one paragraph:** The measured-BOQ engine already accepts a
synchronous trusted resolver and rejects caller-supplied library money. Header
slots for `pricing_authority = measured-boq-engine` and `catalog_revision`
exist from 4C2B. What is missing is an immutable production catalogue, discrete
item provenance columns, mixed-revision rejection, unit/cost-type compatibility
gates, and a lawful line-rate data package. Existing production rates
(category lumps, £/m² libraries, trade day bands) are **not** eligible measured-BOQ
catalogue entries without re-authoring under a stable-key + revision contract
and confirmed redistribution rights.

---

## 3. Current engine contract

**Owner:** `@repo/services` — `packages/services/src/measured-boq/measuredBoqEngine.ts`  
**Application wrapper:** `src/features/estimate/application/repriceMeasuredBoq.ts` (pure pass-through)

### Policy constants

| Symbol | Value |
| --- | --- |
| `MEASURED_BOQ_POLICY_VERSION` | `"2026-07-30.1"` |
| Contingency | 10% (`MEASURED_BOQ_CONTINGENCY_RATE` = pricing engine) |
| VAT | 20% after contingency |
| Low / high | 0.85 / 1.15 of mid |
| Rounding | two-decimal GBP (`roundMeasuredBoqMoney`) |
| Regional mult (library) | `getRegionalMultiplier(region)` |
| Regional mult (user-quote) | 1 |

### Trusted catalogue entry (today)

```ts
MeasuredBoqLibraryCatalogEntry = {
  rateKey: string;
  catalogRevision: string;
  baseUnitRate: number;
  currency: "GBP";
  vatBasis: "exclusive";
}
```

**Absent on entry:** `unit`, `costType`, category, display name, deprecation.

### Resolver

```ts
type MeasuredBoqLibraryRateResolver = (
  reference: { rateKey: string; catalogRevision: string },
) => MeasuredBoqLibraryCatalogEntry | null;
```

Synchronous. Null → `MISSING_LIBRARY_REFERENCE`. Engine requires returned identity
to **exactly** match request.

### Untrusted caller input

Full `MeasuredBoqEngineInput`: `region`, rooms, lines (`id`, `name`, `category?`,
`quantity`, `unit`, `costType?`, `notes?`, `rate`).  
Library rate from caller: **identity only** `{ source: "library", rateKey, catalogRevision }`.

### Emitted line result (authority)

`rateSource`, `rateReference` (composite `key@rev` for library), `baseUnitRate`,
`regionalMultiplier`, `unitRate`, `totalCost`, structural fields, `costType`
(default `combined`).

### Header result gaps

- No discrete header `catalogRevision` field on `MeasuredBoqPricingResult`
- No discrete `rateKey` / `catalogRevision` on line result (only `rateReference`)
- No mixed-revision detection
- No unit / cost-type compatibility checks against catalogue
- User-quote evidence not retained on result (deferred product)

### Engine Q&A (discovery evidence)

| # | Question | Answer |
| --- | --- | --- |
| 1 | Untrusted caller fields | Full BOQ structure + library identity / quote / draft rates |
| 2 | Trusted resolver fields | `rateKey`, `catalogRevision`, `baseUnitRate`, GBP, exclusive VAT |
| 3 | Emitted resolved values | Line money + `rateSource`/`rateReference` + header rollups |
| 4 | Absent provenance | Discrete key/rev; header rev; catalogue unit/costType; quote evidence |
| 5 | Enough to reproduce | Money yes; full library identity as separate DB fields no |
| 6 | Resolver contract change? | Lookup shape OK; widen entry for unit/costType; app mixed-rev gate |
| 7 | Backward compatible? | Optional additive entry fields yes; required fields need adapter |
| 8 | Unit match verified? | **No** |
| 9 | Cost-type compatibility? | **No** |
| 10 | Category/item identity? | **No** (only rateKey + revision) |
| 11 | Key + incompatible unit? | **Yes** today |
| 12 | Material rate on labour line? | **Yes** today |
| 13 | Exact key/revision checked? | **Yes** per line |
| 14 | Mixed revisions detected? | **Neither** engine nor wrapper |

### Required 4C2C-B engine-adjacent changes (plan only)

Prefer **minimal** surface:

1. **Application composition (required):** after BOQ decode, assert all library
   lines share one `catalogRevision`; reject `MIXED_CATALOG_REVISIONS` before engine.
2. **Resolver / catalogue entry (required for integrity):** durable `unit` and
   `costType` on catalogue entries; validate match at snapshot build or before
   engine (if engine entry type expanded, do so **additively** with required
   fields only after all resolvers updated — production resolver is new).
3. **Result mapping for persistence (required):** map discrete `rateKey`,
   `catalogRevision` from library rate input + resolution (do not rely on
   parsing `rateReference` alone).
4. **Optional engine issue codes:** `CATALOG_UNIT_MISMATCH`,
   `CATALOG_COST_TYPE_MISMATCH`, `MIXED_CATALOG_REVISIONS` — may live in
   application layer if engine remains pure money resolver.

**Do not** change contingency, VAT, low/high, regional formula, or
`runPricingEngine` during 4C2C-B.

---

## 4. Current catalogue / rate inventory

### Production readiness classification

```text
C. RATE DATA EXISTS BUT RIGHTS/PROVENANCE ARE UNCLEAR
```

Sub-finding (measured-BOQ library specifically):

```text
NO PRODUCTION MEASURED-BOQ LINE CATALOGUE EXISTS
```

Only test map in `measuredBoqEngine.test.ts` (`paint.m2`, `tile.m2`, `pence.item` @ `2026.07`).

### Candidate table (summary)

| Name | Path | Prod/test | Stable key | Revision | Unit | Cost type | Currency | VAT | Geo | Regional adj | Effective date | Source evidence | Licence | Cadence | Measured-BOQ eligible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CATEGORY_BASE + REGION_MULTIPLIERS | `packages/core/src/utilities/pricingData.ts` | Production (L1/L2/category) | Category name | none | category lump @ 90 m² | labour+materials | GBP (implicit) | exclusive then engine VAT | UKRegion | stored mult | none | product constants | internal | ad hoc | **No** — lumps not qty×unit lines |
| Pricing policy constants | `packages/services/src/pricing/pricingEngine.ts` | Production | N/A | none | N/A | policy | GBP | 20% | UKRegion | getRegionalMultiplier | none | code | internal | ad hoc | **No** — shared policy only |
| DEFAULT_COST_LIBRARY | `packages/services/src/cost-library/costLibrary.ts` | Production (enhanced/new-build) | none | none | £/m² tiers | combined | GBP | unstated line | UKRegion | own mult table | none | refurb-estimator comment | unclear | ad hoc | **No** |
| Enhanced / new-build rates | `enhanced-estimate/`, `new-build/` | Production UI | enum/id | none | £/m² / lumps | combined | GBP | layered % | UKRegion | cost-library | runtime only | hardcoded | unclear | ad hoc | **No** |
| TRADE_RATES | `packages/services/src/trade-rates/tradeRates.ts` | Production labour guide | `id` | lastUpdated string | hour/day bands | labour only | GBP | ex-VAT (notes) | per-trade mult | per-trade | 2026-04-02 | Checkatrade/TraderStreet attributed | **unclear redistribution** | ad hoc / claimed annual uplift | **No** — day bands not BOQ unit rates; licence unclear |
| Measured-BOQ engine | `packages/services/src/measured-boq/` | Production code; **no data** | required | required | free string | labour/materials/combined | GBP | exclusive | UKRegion | engine | N/A | contract | N/A | policy version pin | **Path ready; data missing** |
| TEST_CATALOGUE | `measuredBoqEngine.test.ts` | **Test only** | paint.m2 etc. | 2026.07 | implicit in key | line costType | GBP | exclusive | via engine | via engine | none | test | test | N/A | **No (tests only)** |
| AI mock / LLM costs | `ai-estimate.adapter.server.ts` | Runtime fallback / AI | none | none | kitchen, lm, sqm, item, … | labour/materials/both/fees | GBP | pre-VAT prompt | UK guidance | later | none | invented/AI | not catalogue | continuous | **No** |
| Manual builder seed | `EstimateBuilder.tsx` | UI seed | none | none | set/item | free | GBP | unknown | none | none | none | free-typed | N/A | N/A | **No** |
| Photo mapping defaults | `mapPhotoAnalysesToEstimateRooms.ts` | Heuristic | none | none | free | free | GBP | unstated | none | none | none | AI/heuristic | N/A | N/A | **No** |
| estimates / estimate_items | Supabase | Result store | ids | header catalog_revision only | free unit | free category | stored money | columns | region | N/A | timestamps | persisted outputs | project data | N/A | **No** — not a library |
| quote_requests | Supabase | Messaging | id | none | **no unit rates** | N/A | N/A | N/A | N/A | N/A | created_at | title/message | N/A | N/A | **No** |

**Do not promote** trade rates, category lumps, AI, marketplace quotes, or test
fixtures as the production measured-BOQ catalogue without separate acquisition
and licence confirmation.

---

## 5. Production rate-data readiness

| Field | Finding |
| --- | --- |
| Classification | **C** |
| Source | Fragmented product tables + third-party attributions; no approved line book |
| Owner | Product engineering owns code tables; **no formal catalogue owner / publisher role** documented |
| Licence | Trade rates cite Checkatrade/TraderStreet without redistribution terms; estimator import lacks licence file |
| Geographic basis | UK (multiple inconsistent multiplier tables) |
| Price date | Partial (`lastUpdated` on trade rates only) |
| VAT basis | Mixed / often exclusive-implied |
| Update cadence | Ad hoc code change |
| Blocking gaps | Lawful line-rate source; licence; stable keys; immutable revision packaging; QC process |

### Blocking acquisition / governance gate (required before production rates)

```text
1. Name lawful source (internal survey or licensed third-party book)
2. Written redistribution / derived-use rights for app + historical storage
3. Geographic and price-date basis documented
4. VAT exclusive GBP confirmation
5. Peer review of normalised keys/units/cost types
6. Signed publication checklist (checksum, entry count, effective_from)
```

Until the gate clears:

```text
4C2C-B may ship catalogue mechanism + empty/test revisions only
4C2C-B must not invent production rates or promote test fixtures
```

---

## 6. Catalogue ownership decision

### Options evaluated

| Option | Summary | Fit |
| --- | --- | --- |
| **A — Versioned code snapshot** | JSON/TS in repo, deploy-bound | Strong reviewability; weak multi-revision historical retention after deploys; bundle leakage risk if not server-gated |
| **B — Database only** | tables + service-role load | Strong runtime retention/RLS; weaker peer-review of raw edits; needs import process |
| **C — Hybrid (selected)** | reviewed VCS source → published immutable DB revision | Best match for determinism + review + historical reproduction |

### Selected model: **Option C — Hybrid**

| Concern | Decision |
| --- | --- |
| Source of truth | Version-controlled **reviewed source package** (validated JSON under a non-browser path, e.g. `packages/measured-boq-catalogue/` or `supabase/catalogue-sources/` — exact path chosen in 4C2C-B; **not** client-importable) |
| Runtime storage | Immutable DB tables `measured_boq_catalog_revisions` + `measured_boq_catalog_entries` |
| Loading | Server-only async loader (service_role) → in-memory Map → **sync** resolver for engine |
| Exact lookup | In-memory exact `(catalog_revision, rate_key)` — no SQL per line |
| Browser access | **None** for raw catalogue tables; resolved line money may appear in estimate **results** after trusted pricing |
| Historical retention | All published/retired DB revisions retained; never delete published |
| Publication | Import job / migration-style publication command after validation + checksum |
| Rollback | Publish new revision **or** pin product to a prior `catalog_revision`; never mutate published rows |

**Rejected pure A:** deploy-coupled history loses old rates when code ships.  
**Rejected pure B:** ad-hoc DB edits without VCS review/checksum.

---

## 7. Stable rate-key contract

### Grammar

```text
<trade-or-domain>.<work-item>.<unit>[.<variant>]
```

Illustrative only (not production keys): `decoration.emulsion_walls.m2`,
`tiling.ceramic_wall.m2.standard`.

### Rules

| Rule | Specification |
| --- | --- |
| Case | **lowercase** only |
| Allowed characters | `a-z`, `0-9`, `_`, `.` |
| Separator | `.` between segments; `_` within segments |
| Max length | **160** (align `MAX_RATE_KEY_LENGTH` in authority policy) |
| Unique within | one `catalog_revision` |
| Across revisions | same key may reappear only if **semantic work item + unit + cost_type unchanged**; price may change |
| Semantic change | **new key** required |
| Aliases | **forbidden** in 4C2C (no alias table) |
| Fuzzy / display match | **forbidden** |
| UUIDs | keys must not be UUIDs |
| Deprecation | entry `status=deprecated` + optional `replacement_rate_key`; deprecated keys still resolve for historical repro if present in that revision |
| Duplicates | fatal at import / snapshot validation |

---

## 8. Unit taxonomy

### Observed unit strings (inventory)

`m2`, `sqm`, `lm`, `item`, `each`, `ea`, `set`, `lot`, `suite`, `kitchen`,
`room`, `skip`, hour/day (trade rates fields only). `m²` appears in UI copy only.

### Canonical codes (4C2C-B vocabulary)

| Canonical code | Display | Semantics | Qty precision | Min | Max | Conversion |
| --- | --- | --- | --- | --- | --- | --- |
| `m2` | m² | area | 3 dp | > 0 | none (reason: large commercial floors) | **none** |
| `m` | m | linear run | 3 dp | > 0 | none | **none** |
| `lm` | linear m | same as linear measure alias — **prefer `m`** | 3 dp | > 0 | none | import normalises `lm` → `m` only in **import tool**, never at resolve |
| `item` | item | countable | 0–2 dp | > 0 | none | **none** |
| `each` | each | alias of item — **prefer `item`** | same | > 0 | none | import normalises `each`/`ea` → `item` only in import |
| `hr` | hour | labour time | 2 dp | > 0 | none | **none** |
| `day` | day | labour day | 2 dp | > 0 | none | **none** |

### Policy

```text
Caller unit MUST exactly match catalogue entry unit (canonical codes).
No implicit runtime conversion.
No fuzzy unit matching.
Import may normalise known aliases once into canonical codes before publication.
MeasuredBoqLibraryCatalogEntry MUST gain durable `unit: string` (canonical code).
Engine or pre-engine gate MUST reject mismatches (CATALOG_UNIT_MISMATCH).
```

---

## 9. Cost-type model

### Recommendation

```text
Distinct catalogue identity implies fixed cost_type:
  labour | materials | combined

Catalogue entry stores cost_type (required).
Caller costType, if supplied, MUST equal catalogue cost_type.
If caller omits costType, engine continues to default combined TODAY —
  4C2C-B should instead default from catalogue cost_type for library lines
  at composition (preferred) without changing non-library behaviour.
```

| Model | Verdict |
| --- | --- |
| Single baseUnitRate + fixed costType | **Selected** — matches engine line totals |
| Separate labour/materials unit rates on one key | Rejected — engine expects one unit rate per line |
| Distinct labour and material keys | Allowed as two keys; not forced |

**Prevents:** material rate on labour line; combined mis-allocation; caller
overriding catalogue cost type.

---

## 10. Catalogue revision model

### Identifier

```text
Format: mboq-YYYY.MM.DD[.N]
Example: mboq-2026.08.01
Max length: 64 (existing estimates.catalog_revision CHECK)
Not allowed: "current", "latest", empty, mutable aliases
```

### Revision metadata (table)

| Field | Required |
| --- | --- |
| `id` (uuid internal PK) | yes |
| `catalog_revision` (text unique natural key, `mboq-YYYY.MM.DD[.N]`) | yes |
| `status` | draft \| published \| retired |
| `schema_version` | yes |
| `currency` | GBP |
| `vat_basis` | exclusive |
| `regional_basis` | `uk-region-multipliers-v1` (documents engine mult table) |
| `source_description` | yes |
| `entry_count` | yes |
| `content_checksum` | SHA-256 of canonical serialisation |
| `effective_from` | date |
| `published_at` / `retired_at` | timestamps |
| `created_by` | publisher identity |
| `release_notes` | optional text |

### States

| State | Editable | Authority eligible | Resolver readable |
| --- | --- | --- | --- |
| draft | yes (pre-publish only) | **no** | test/admin only |
| published | **no** | **yes** | yes |
| retired | **no** | no new authority pins preferred; **still readable** for reproduction | yes |

### Rules

```text
published rows immutable (trigger + grants)
never delete published/retired revisions or entries
new prices require new revision
initial canonical estimate pins exactly one catalog_revision
commands with more than one catalog_revision rejected with MIXED_CATALOG_REVISIONS
```

---

## 11. Catalogue-entry contract

### Minimum production entry fields

| Field | Engine authority | Governance | UI | Reporting |
| --- | --- | --- | --- | --- |
| `rate_key` | required | required | display | required |
| `catalog_revision` | required | required | — | required |
| `base_unit_rate` | required | required | after price | required |
| `currency` = GBP | required | required | — | required |
| `vat_basis` = exclusive | required | required | — | required |
| `unit` (canonical) | **required (new)** | required | yes | required |
| `cost_type` | **required (new)** | required | yes | required |
| `display_name` | optional engine | required review | yes | yes |
| `description` | optional | review | optional | optional |
| `trade_or_domain` | optional | review | filter | yes |
| `source_reference` | optional | **required for production** | no | audit |
| `status` active/deprecated | resolve policy | required | optional | yes |
| `replacement_rate_key` | optional | optional | optional | optional |

Existing engine needs today: `rateKey`, `catalogRevision`, `baseUnitRate`, GBP,
exclusive. **Production integrity requires unit + cost_type expansion.**

---

## 12. Server-only resolver architecture

### Preferred composition (async → sync)

```text
1. Server application loads one immutable revision asynchronously (service_role)
2. Validates complete snapshot (checksum, unique keys, units, cost types, rates)
3. Builds Map<"rateKey", CatalogEntry>
4. Constructs synchronous MeasuredBoqLibraryRateResolver over the Map
5. Passes resolver to repriceMeasuredBoq / runMeasuredBoqEngine
6. Zero SQL queries per BOQ line
```

### Alternatives rejected

| Alternative | Reason |
| --- | --- |
| Make engine async | Unnecessary churn; pure engine remains sync |
| One query per line | Latency + N+1; harder transactional consistency |
| Preload all revisions always | Memory waste; pin single revision |
| Code-only resolver in prod | Historical retention weak |

### Ownership / paths (planned)

| Layer | Path (provisional) |
| --- | --- |
| Snapshot load + cache | `src/features/estimate/infrastructure/catalogue/measuredBoqCatalogue.repository.server.ts` |
| Sync Map resolver factory | same module or `…/createMeasuredBoqLibraryResolver.ts` (server-only) |
| Pure validation | `packages/services` **or** feature application pure module (no IO) |
| Composition | future measured-BOQ save use-case (post-4C2C-B persistence ticket or later) |

Package rules:

```text
@repo/services: deterministic pricing only — no DB IO
application: pure composition / ports
infrastructure *.server.ts: IO
presentation: no money resolution
browser barrels: no catalogue exports
```

### Resolver behaviour

| Case | Behaviour |
| --- | --- |
| Exact key+revision hit | return entry |
| Missing revision | `CATALOG_REVISION_NOT_FOUND` / not published |
| Draft revision for authority | `CATALOG_REVISION_NOT_PUBLISHED` |
| Missing key | null → engine `MISSING_LIBRARY_REFERENCE` or structured `CATALOG_ENTRY_NOT_FOUND` |
| Duplicate key in snapshot | fatal at load |
| Invalid entry | fatal at load |
| Unit mismatch | `CATALOG_UNIT_MISMATCH` |
| Cost-type mismatch | `CATALOG_COST_TYPE_MISMATCH` |
| Latest fallback | **forbidden** |
| Fuzzy / alias | **forbidden** |

### Cache

| Concern | Decision |
| --- | --- |
| Lifetime | process-local cache keyed by `catalog_revision` + checksum |
| Invalidation | never mutate in place; new revision = new key; optional TTL refresh of metadata only |
| Pinning | command specifies exact `catalog_revision`; cache miss loads that revision only |
| Max size assumption | ≤ 50_000 entries / revision initially; full snapshot load OK |
| Query count | 1–2 reads per operation (revision row + all entries) |

---

## 13. Minimum per-item provenance

### Existing fields (do not overload)

| Column | Semantics | Provenance? |
| --- | --- | --- |
| `unit_cost` | free money; browser draft | **No** as library base |
| `total_cost` | line total | money result, not identity |
| `labour` / `materials` | category path | not measured rate identity |
| `unit` / `quantity` | structural | keep; required |
| `is_ai_suggested` | unreliable boolean | **never** rate provenance |

### Proposed new `estimate_items` columns

| Name | SQL type | Nullable | Constraints | Draft (`none`) | Measured authority | Category authority | Browser write | Service role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rate_source` | text | NULL | `NULL` or `library` (user-quote later) | NULL | required `library` | NULL | no on authority | yes |
| `rate_key` | text | NULL | length 1–160 when set | NULL | required | NULL | no | yes |
| `catalog_revision` | text | NULL | length 1–64 when set; = header | NULL | required = header | NULL | no | yes |
| `base_unit_rate` | numeric(14,4) | NULL | > 0 when set | NULL | required | NULL | no | yes |
| `regional_multiplier` | numeric(8,4) | NULL | > 0 when set | NULL | required | NULL | no | yes |
| `resolved_unit_rate` | numeric(14,4) | NULL | > 0 when set | NULL | required | NULL | no | yes |

**Naming:** prefer snake_case to match Supabase columns (`unit_cost`, not camelCase).

**Integrity when set (library):**

```text
rate_source = 'library'
rate_key non-empty
catalog_revision = estimates.catalog_revision
base_unit_rate / regional_multiplier / resolved_unit_rate positive finite
resolved_unit_rate = round(base_unit_rate * regional_multiplier) within 0.01 GBP
quantity * resolved_unit_rate ≈ total_cost (0.01)
```

Legacy rows: all new columns NULL — remain valid.

---

## 14. Header / item consistency

### Revision identity naming contract

```text
- TypeScript uses catalogRevision.
- SQL uses catalog_revision.
- measured_boq_catalog_revisions.catalog_revision is the canonical natural key.
- measured_boq_catalog_entries.catalog_revision references that natural key.
- estimates.catalog_revision pins the estimate header revision.
- estimate_items.catalog_revision must equal the header revision and participates
  with rate_key in the catalogue-entry composite foreign key.
- UUID id columns are internal row identifiers and never replace the catalogue
  revision identity used by the engine or persisted provenance.
```

### Required invariants

```text
measured-boq-engine header → catalog_revision NOT NULL (already CHECK)
measured-boq-engine library items → rate_source = library
measured-boq-engine library items → rate_key non-empty
measured-boq-engine library items → item.catalog_revision = header.catalog_revision
measured-boq-engine library items → resolved pricing columns present
category-engine → item provenance columns NULL; header catalog_revision NULL
draft/none → cannot set rate_source = library with authority money claim
```

### Enforcement preference

| Layer | Role |
| --- | --- |
| CHECK / composite FK | Prefer: `estimate_items (catalog_revision, rate_key)` references `measured_boq_catalog_entries (catalog_revision, rate_key)` for measured authority writes |
| Private RPC validation | Primary for atomic insert consistency (mirror 4C2B) |
| Triggers | Immutability of published catalogue |
| RLS | Browser cannot write provenance / authority rows |
| Application | Reject mixed revisions with `MIXED_CATALOG_REVISIONS` before engine; decoder forbids money |

Do not rely only on application checks for permanent integrity.

---

## 15. Database / RLS model

### Proposed tables (design only — not created in 4C2C-A)

#### `measured_boq_catalog_revisions`

| Column | Notes |
| --- | --- |
| `id` uuid PK | internal row identifier only |
| `catalog_revision` text NOT NULL UNIQUE | natural key (`mboq-YYYY.MM.DD[.N]`) |
| `status` | draft/published/retired |
| metadata columns (§10) | checksum, counts, dates, source |
| UNIQUE / CHECK | status enum; currency GBP; vat exclusive |

#### `measured_boq_catalog_entries`

| Column | Notes |
| --- | --- |
| `id` uuid PK | internal row identifier only |
| `catalog_revision` text NOT NULL | FK → `measured_boq_catalog_revisions(catalog_revision)` |
| `rate_key` text NOT NULL | |
| UNIQUE (`catalog_revision`, `rate_key`) | natural composite identity |
| `unit`, `cost_type`, `base_unit_rate`, currency, vat_basis | required |
| display/governance fields | optional/required as §11 |

Composite catalogue identity for estimate-item provenance:

```text
estimate_items (catalog_revision, rate_key)
  references measured_boq_catalog_entries (catalog_revision, rate_key)

estimate_items.catalog_revision must equal estimates.catalog_revision
```

Runtime casing:

```text
TypeScript: catalogRevision
SQL:        catalog_revision
```

No runtime or persistence layer introduces a second natural identifier named
`revision_id`.

### Privileges

```text
REVOKE ALL from PUBLIC, anon, authenticated on both tables
GRANT SELECT, INSERT to service_role (INSERT only via controlled publication)
UPDATE/DELETE on published: denied via trigger even for service_role
  (or service_role publish path uses SECURITY DEFINER publisher function only)
Admin SELECT optional via is_admin() policy if Studio inspection needed
Browser: no policies
```

### Estimates / items RLS (no weaken 4C2B)

```text
Draft-only browser CRUD remains for pricing_authority = none
Authority rows still service-role RPC only
New item provenance columns: browser WITH CHECK forces NULL on draft path
```

### Idempotency

`estimate_authority_idempotency` already allows `pricing_authority =
'measured-boq-engine'`. **No change in 4C2C-A.** Future measured RPC reuses table
with hard-coded authority value (mirror category RPC).

---

## 16. Immutability and publication

### Combined enforcement

| Control | Use |
| --- | --- |
| DB trigger | block UPDATE/DELETE on published/retired entries and revisions |
| Grants | no authenticated write |
| Import process | append-only new revision |
| Checksum | stored vs recomputed on load |
| CI | optional: verify source package checksum matches published revision fixture |
| Application | refuse authority pin to non-published |

### Negative cases (must fail)

```text
published entry update/delete
published revision delete
add entry to published revision
duplicate key in revision
checksum mismatch on load
currency / vat_basis change in place
unit semantic change under same key (import rejects; requires new key)
```

---

## 17. Import / release workflow

```text
1. Source evidence + licence confirmation (gate)
2. Normalise units/keys/cost types
3. Assign stable keys; detect duplicates
4. Validate finite positive rates; GBP; exclusive VAT
5. Generate content checksum + entry count
6. Peer review of source package (PR)
7. Test import to local Supabase (draft revision)
8. Publish command → status=published, published_at set
9. Post-publish verification (load snapshot, sample resolve)
10. Rollback = pin new work to previous catalog_revision (never mutate)
```

**No** ad-hoc production DB edits.  
**No** licensed raw vendor files in public repo without rights.  
Seed/test revisions may use **synthetic** rates clearly marked test-only.

---

## 18. Reproduction contract

### Method: **C — Both**

1. **Provenance verification:** saved `base_unit_rate`, `regional_multiplier`,
   `resolved_unit_rate`, qty, totals match arithmetic exactly (0.01 GBP).
2. **Historical recomputation:** reload immutable catalogue revision + pinned
   `pricing_policy_version` (`MEASURED_BOQ_POLICY_VERSION` at save) and re-run
   engine; compare totals exactly.

```text
Tolerance: exact deterministic two-decimal equality
Current catalogue must not silently reproduce historical estimates
Catalogue revision + policy version both required
```

Required saved fields: header `catalog_revision`, `pricing_policy_version`,
`pricing_authority`; per library item provenance columns; quantity; unit;
cost type; room structure; region.

---

## 19. Security analysis

| Threat | Boundary | Mitigation | Test | Residual |
| --- | --- | --- | --- | --- |
| Caller-supplied library money | decoder / engine | identity-only library rate; resolver money | decoder + engine tests | low |
| Fake catalogue entry | resolver | only published snapshot Map | load validation | low |
| Unpublished revision pin | loader | status check | unit | low |
| Key enumeration | API | no public catalogue list endpoint in 4C2C | boundary | medium (errors may leak existence) — generic messages |
| Large snapshot DoS | loader | max entry count; rate limit authority saves | load limits | medium |
| Duplicate-key poison | import | unique + fatal load | import tests | low |
| Mutable published data | trigger/grants | immutability | negative SQL tests | low |
| Cache poison | process cache | key by revision+checksum | unit | low |
| Cross-tenant | ownership RPC | FOR UPDATE project owner (future RPC) | pgTAP | low |
| Service-role leakage | server-only | dynamic import; no VITE_ | boundary invariants | low |
| Import SQL injection | tooling | parameterised SQL / validated JSON only | import tests | low |
| Licence data exposure | storage | no public table SELECT | RLS | medium if rates in estimate responses |
| Log leakage | logging | log keys not full rate sheets | review | medium |

**Display:** resolved unit rates and line totals **may** appear in authenticated
estimate UI after trusted pricing. Raw catalogue tables stay server-only.
Secrecy is not claimed for prices the product must show.

---

## 20. Migration and rollout sequence

### Ticket boundaries

| Ticket | Scope |
| --- | --- |
| **4C2C-B** | Catalogue tables, source package skeleton, loader/resolver, item provenance columns, constraints, types, tests — **no builder**, **no measured persistence RPC** unless required solely to write provenance fixtures; prefer schema + unit tests + SQL probes without product UI |
| **4C2D** | Draft/canonical data-access + cache |
| **4C2E** | Manual/AI builder adapters |
| **4C2F** | Reader cutover |
| **4C2G** | Independent verification |

### 4C2C-B recommended order

```text
1. Migration: catalogue tables + immutability triggers + RLS/grants
2. Migration: estimate_items provenance columns + checks (nullable for legacy)
3. Types generation / 4C2B-style surface verifier extension (not issue #90 full baseline)
4. Source package + validation module
5. Server loader + sync resolver factory
6. Application mixed-revision + unit/costType gates (pure)
7. Registry + invariants + pgTAP/probes
8. Reproduction unit test with synthetic test revision only
9. Data acquisition gate remains open for production rates
```

### 4C2B compatibility

```text
pricing_authority enum unchanged
category-engine path / RPC unchanged
draft RLS unchanged
estimate_done semantics unchanged
estimated_gdv untouched
service_role remains server-only
```

---

## 21. File-by-file implementation plan (4C2C-B)

| Path | New/mod | Owner | Purpose | Allowed deps | Forbidden | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| `supabase/migrations/20YYMMDDHHMMSS_measured_boq_catalogue_foundation.sql` | new | DB | tables, triggers, grants, item columns | SQL only | app code | pgTAP + probes |
| `packages/supabase/src/database.types.ts` | gen | types | surface update | generator | hand-edit | surface verifier |
| `scripts/verify-4c2b-database-types.mjs` or successor | mod | scripts | extend surface checks | node | — | CI invariant |
| `packages/measured-boq-catalogue/` or `catalogue-sources/measured-boq/` | new | data | reviewed source package (test revision OK) | pure JSON/TS data | browser import | schema validation tests |
| `packages/services/src/measured-boq/*` | mod **only if** entry fields expanded | services | optional unit/costType on entry | pure | IO | engine tests |
| `src/features/estimate/infrastructure/catalogue/*.server.ts` | new | infra | load snapshot; build resolver | service client | browser barrel | unit + boundary |
| `src/features/estimate/application/catalogue/*` | new | app | pure validation / mixed-rev gate | services types | supabase | unit |
| `src/features/estimate/infrastructure/index.ts` | mod | infra | **do not** export server catalogue | — | server paths | invariant |
| `tests/invariants/l3-measured-boq-catalogue.invariant.test.ts` | new | tests | architecture gates | fs | — | CI |
| `supabase/tests/database/*catalogue*.test.sql` | new | db tests | RLS/immutability | pgtap | — | supabase test |
| `scripts/probe-measured-boq-catalogue-4c2c.sql` | new | probes | local security probes | psql | — | manual/CI local |
| `tests/invariants/config/data/*` | mod | registry | tables/migrations inventory | — | — | registry invariant |
| `docs/architecture/l3-save-seam-integration-plan.md` | mod | docs | status links | — | — | — |
| This plan | already | docs | decision record | — | — | — |

**Not in 4C2C-B:** measured-BOQ persist RPC, serverFn product path, builders, readers.

---

## 22. Test matrix

### Catalogue validation

valid publish; draft not authority-eligible; published immutable; retired readable;
empty revision rejected; duplicate key rejected; invalid key grammar; invalid unit;
invalid cost type; zero/negative/NaN rate; non-GBP; non-exclusive VAT; checksum mismatch.

### Resolver

exact key/rev; missing rev/key; wrong rev; no latest fallback; unit/cost-type mismatch;
server-only boundary; one snapshot load; no query per line.

### Provenance schema

legacy NULL OK; draft cannot claim library provenance; measured requires columns;
category unaffected; header/item revision match; blank key rejected; browser cannot write.

### Reproduction

saved estimate reproduces with historical revision + policy version; current
revision cannot replace historical; exact 0.01 equality.

### Architecture

IO server-only; services IO-free; no fuzzy match; no builder/reader cutover.

---

## 23. Go / no-go gates

### 4C2C-A (this ticket)

```text
GO WITH DATA GATE — FOUNDATION CAN BE BUILT, PRODUCTION RATES REQUIRE APPROVAL
```

Gates satisfied for **mechanism** planning:

```text
stable key contract
unit contract
cost-type contract
revision contract
storage decision (hybrid)
resolver async/sync composition
provenance schema
RLS decision
immutability model
reproduction method
implementation file plan
```

### 4C2C-B exit (future)

```text
catalogue mechanism + tests green
provenance columns + constraints green
no production rate invention without acquisition gate pass
4C2B category path still green
```

### Production catalogue data exit (separate)

```text
acquisition/governance gate complete
first published revision with lawful rates
checksum verified in staging
```

---

## 24. Deferred work

```text
user-quote authority + evidence storage
fuzzy matching (never)
future multi-revision estimate workflows and their separate provenance,
  persistence and reader contract; initial 4C2 measured-BOQ authority continues
  to reject mixed catalogue revisions
builder integration (4C2E)
reader cutover (4C2F)
measured-BOQ private persist RPC (after or late in 4C2C-B only if needed for fixtures)
alias tables
regional multiplier unification (three tables today — separate debt)
issue #90 full database.types reproducibility
Deal Copilot / pitch-deck / ROI changes
```

### Current vs future revision-mix contract

```text
CURRENT INITIAL CONTRACT:
one catalogue revision only per canonical measured-BOQ estimate
mixed revisions rejected (MIXED_CATALOG_REVISIONS)

FUTURE SEPARATE CONTRACT:
an explicitly designed multi-revision workflow may be considered later;
it is not authorised by deferring the current rejection rule
```

---

## 25. Final recommendation

Implement **4C2C-B** as a **hybrid immutable catalogue foundation** with
**server-only snapshot loading**, **synchronous Map resolver**, and **minimum
per-item library provenance** columns, without product builder cutover.

Treat **production rate publication** as a **hard gate** after licence and source
approval. Do not invent rates, scrape commercial books, or promote test fixtures.

```text
Ticket 4C2C-A: PLAN COMPLETE
Ticket 4C2C-B: READY TO START UNDER DATA GATE
Ticket 4C2C persistence RPC / builders: NOT THIS TICKET
```

---

## Appendix A — Decision log

| Decision | Evidence | Alternatives rejected | Reason | Risk | Mitigation |
| --- | --- | --- | --- | --- | --- |
| Hybrid catalogue | 4C2B DB patterns; engine sync resolver; historical repro need | pure code; pure DB | review + retention | drift source vs DB | checksum + CI |
| Classification C | inventory of trade/category sources; no line catalogue | A/B/D | rates exist but rights unclear | illegal use | acquisition gate |
| Exact unit match | free unit strings today; no entry unit | runtime conversion | prevents silent wrong money | builder friction later | import normalisation |
| cost_type on entry | engine costType unvalidated | dual rates per key | prevents misallocation | more keys | clear key grammar |
| App mixed-rev gate | engine lacks check | engine redesign first | less churn | bypass if wrong layer | also RPC check later |
| Provenance new columns | unit_cost overloaded | reuse unit_cost as base | semantic conflict | migration width | nullable legacy |
| No production rates in 4C2C-B | classification C | invent/fixture promote | compliance | empty catalogue | test revisions only |

## Appendix B — Interaction with 4C2B

Header markers already allow `measured-boq-engine` with non-null `catalog_revision`.
Category RPC hard-codes `catalog_revision = NULL`. Item provenance is additive and
NULL for category/draft. Service-role + SECURITY DEFINER pattern is the template
for any future measured persist RPC (not 4C2C-A).
