# L3 Save-Seam and Authority-Input Integration Plan

```text
Status: Living integration plan (hardened — Ticket 4C2A1 / 4C2A2R)
Parent contract: l3-estimate-authority-contract.md
Implementation status: 4C2B COMPLETED; 4C2C-A planning complete; later tickets not started
Scope: Ticket 4C2 save-seam and authority-input integration
Base SHA at planning: 922ee4ce08a491eabdffff460293c66eb5eeabdc
Hardening amendments:
  Ticket 4C2A1 — runtime decoder, private RPC, markers, idempotency, gates
  Ticket 4C2A2R — scalar bounds, atomic ownership, provenance, sequencing
Programme updates:
  Ticket 4C2B — COMPLETED (category authority persistence foundation)
  Ticket 4C2C-A — COMPLETED
  Ticket 4C2C-B — IMPLEMENTED (production catalogue rates BLOCKED)
  Ticket 4C2C-B — NOT STARTED (catalogue mechanism + provenance implementation)
```

This document maps **current behaviour**, **security/trust gaps**, **approved
existing contracts**, **recommended target**, and **deferred work**. Authority-priced
**category** persistence is implemented (4C2B). Authority-priced **measured-BOQ**
persistence and production catalogue data are **not** implemented; catalogue
foundation planning lives in
[`l3-measured-boq-catalogue-foundation-plan.md`](./l3-measured-boq-catalogue-foundation-plan.md).

Parent contract: [`l3-estimate-authority-contract.md`](./l3-estimate-authority-contract.md).

---

## 1. Executive summary

| Topic | Finding |
| --- | --- |
| Measured-BOQ engine | **Exists** (`runMeasuredBoqEngine`, `repriceMeasuredBoq`) — pure, no persistence |
| Production line-level catalogue | **Does not exist** (test map only in `measuredBoqEngine.test.ts`); plan: 4C2C-A |
| Browser draft save trust | **Untrusted for drafts** — client may still supply draft money; **canonical category** is server-only (4C2B) |
| Room draft vs canonical | **Partially separated** — markers/RLS for category authority; room builders still draft-path until 4C2E |
| Existing `status` / `ai_generated` | **Cannot** identify authority-priced estimates (use `pricing_authority`) |
| Quote provenance path | **Not ready** for `MeasuredBoqUserQuoteRate` without schema/file-evidence work |
| Quick category path | **Server writer live (4C2B)** — `saveAuthorityCategoryEstimateServerFn` + private RPC |
| Primary decision gate | **GO WITH GATES** — remaining cumulative prerequisites: catalogue (4C2C), draft/cache (4C2D), builders (4C2E), readers (4C2F) |

```text
NO-SCHEMA 4C2 IS UNSAFE
```

for full draft/canonical separation, rate provenance retention, write-protected
authority markers, and trusted library resolution. Narrow no-schema experiments
would still leave financial readers and RLS bypass risks unsolved.

**Hardening (4C2A1 + 4C2A2R):** runtime allowlisted decoder with scalar/enum
bounds and request-size limits; browser cannot escalate markers; private RPC
with atomic owner recheck; durable idempotency; per-item library provenance;
canonical `estimate_done` only (never `estimated_gdv`); builder/cache separation
before reader cutover; one immutable catalogue revision per initial authority
estimate.

---

## 2. Current save paths (route → database)

### 2.1 Manual room builder

```text
src/components/EstimateBuilder.tsx
  → presentation totals: qty × unit_cost; contingency = 10% of subtotal;
    VAT = 20% of (subtotal + contingency); total = subtotal + contingency + VAT
  → buildEstimateBuilderSaveInput (pure mapper)
  → useSaveEstimateBuilder (useMutation + optimistic cache)
  → saveAIEstimate (browser Supabase repository)
  → estimates INSERT
  → estimate_rooms INSERT
  → estimate_items INSERT
```

| Concern | Current location / behaviour |
| --- | --- |
| Quantity | User edit in `EstimateBuilder` local state |
| Unit cost | User free-typed `unit_cost` (not engine/library) |
| Line total | Presentation: `quantity * unit_cost` (mapper recomputes same) |
| Room subtotal | Sum of line totals in component / repository re-sums for room row |
| Contingency | Component only (10%); **not** written to DB on room save (`contingency: 0`) |
| VAT | Component (20% after contingency); mapper passes `vat_amount`; repo stores `vat_rate: 20` |
| low / mid / high | Repository: `mid_total = high_total = input.total`; `low_total = round(total * 0.85)` — **caller-controlled mid/high** |
| Caller-controlled money | `subtotal`, `vat_amount`, `total`, all `unit_cost` / `total_cost` |
| Discarded / rewritten | Mapper sets `is_ai_suggested: false`; **repository overwrites `is_ai_suggested: true` for every item**; labour/materials/weeks forced to 0; `condition_level`/`finish_level` hard-coded Dated/Standard |
| Optimistic cache | `useSaveEstimateBuilder` writes `{ estimate: { mid_total: optimistic.total }, rooms… }` into **canonical** `estimateQueryOptions` key |

### 2.2 AI room builder

```text
AI generation (generateEstimateServerFn / scope mapping)
  → AIEstimateBuilder local rooms (base_unit_cost from AI / scope)
  → calculateLineItem(base × regional multiplier) + calculateEstimateTotals (VAT 20%)
  → optional normalizeAIEstimate (clamp/risk — advisory only)
  → buildAIEstimateBuilderSaveInput
  → useAIEstimateBuilderSave → useSaveAIEstimate
  → saveAIEstimate → same DB path as manual
```

| Concern | Current behaviour |
| --- | --- |
| Origin of `base_unit_cost` | AI adapter / scope recommended_items / user edit of AI lines |
| Regional adjustment | Client `getRegionalMultiplier` + `calculateLineItem` in mapper |
| Normalisation | Optional `normalizeAIEstimate` — **not** money authority |
| Provenance | All items stored `is_ai_suggested: true` (repo); header `ai_generated: true` |
| Client totals | `totals.subtotal / vat_amount / total` passed through mapper unchanged |
| Repository rewrites | Same as manual: zeros labour/materials/contingency; mid=high=client total |

### 2.3 Quick category estimate (protect formula; migrate trust)

```text
src/routes/_authed/projects.$id.estimate.tsx (quick tab)
  → runPricingEngine (via @/core/pricing shim → @repo/services)
  → saveProjectEstimate(projectId, PricingEngineResult)
  → estimates + estimate_items (category line items; no estimate_rooms)
```

| Property | Evidence |
| --- | --- |
| Money authority (formula) | `runPricingEngine` in `@repo/services` using `@repo/core` tables |
| Totals | Engine-owned labour/materials/subtotal/contingency/VAT/low/mid/high |
| Persistence | **Browser** repo inserts engine result; **no** server reprice gate |
| Readers | `getLatestProjectEstimate` (any latest row by `created_at`) |
| Ticket 4C2 constraint | **Do not change** `runPricingEngine` formula; **must** move save behind trusted server writer before marker-only readers |

`createEstimate` use-case (`makeCreateEstimate`) also: `runPricingEngine` →
`estimates.saveProjectEstimate` — thin orchestration, still browser repo port.

### 2.4 Client money locations (summary)

| Location | Owns money? |
| --- | --- |
| `EstimateBuilder` calculations | Yes — presentation totals |
| `AIEstimateBuilder` + `calculateLineItem` / `calculateEstimateTotals` | Yes — presentation totals |
| `build*EstimateBuilderSaveInput` | Passes totals; does not reprice from engine |
| `saveAIEstimate` | Accepts and persists caller totals |
| `saveProjectEstimate` | Persists engine result shape (trusted only if caller already used engine) |
| `runMeasuredBoqEngine` / `repriceMeasuredBoq` | Trusted pure engine — **not on save path today** |

---

## 3. Trust boundary map

### 3.1 Can a browser caller bypass `repriceMeasuredBoq` and submit arbitrary totals?

**Yes.**

Evidence:

1. `saveAIEstimate` / `saveProjectEstimate` run in the **browser** via
   `@/platform/supabase/browser` and insert numeric totals from the caller.
2. RLS (`estimates_all_own`, `estimate_items_all_own`, rooms managed via own
   estimates): any authenticated owner may INSERT/UPDATE/DELETE own rows with
   **any** money values. Policies check `auth.uid() = user_id` (or estimate
   ownership for rooms) — **not** that totals came from an engine.
3. There is **no** estimate-save `createServerFn` / RPC that recomputes money.
4. Calling `repriceMeasuredBoq` in the browser would **not** establish authority
   if the same client can still call Supabase directly with different totals.

```text
Calling the measured-BOQ engine in the browser does not by itself establish
financial authority when the browser may bypass that call and write directly.
```

### 3.2 Boundary classification

| Boundary | Can caller replace totals? | Trusted catalogue hidden from caller? | Atomic save possible? | Recommendation |
| --- | ---: | ---: | ---: | --- |
| React component | **Yes** | No | No | Draft preview only; never authority write |
| Presentation hook | **Yes** (forwards totals) | No | No | Compose draft/authority commands; no money authority |
| Browser repository | **Yes** | No | No (compensating delete only) | Draft only (`pricing_authority = none`); **not** authority |
| Authenticated serverFn | **No** after runtime decoder | **Yes** (server-side resolver) | Partial without RPC | **Authority entry + decoder** |
| Supabase RPC (private) | **No** (not browser-callable) | **Yes** | **Yes** | Atomic persistence only |
| Edge/server function | Same as serverFn | Yes | Depends | Prefer TanStack serverFn + private RPC |

### 3.3 Recommended canonical save boundary

```text
Authenticated serverFn:
  - enforce request-size limit
  - receive unknown JSON
  - runtime-decode allowlisted command (reject forbidden/unknown fields;
    validate scalars, enums, lengths, collection bounds)
  - authenticate current user; derive userId from session only
  - verify project ownership; derive expectedOwnerId (never from browser)
  - compose trusted catalogue resolver internally
  - call repriceMeasuredBoq / runMeasuredBoqEngine
  - reject draft outcomes for canonical persistence
  - derive payload hash + enforce durable idempotency
  - invoke private atomic persistence RPC with engine output + expectedOwnerId
  - return persisted estimate or structured issues
```

Browser repository remains usable for **explicit draft** saves with
`pricing_authority = none` only, and only after readers stop treating drafts as
financial authority.

---

## 4. Rate catalogue inventory

### 4.1 Candidates

| Candidate | Path/table | Stable key | Revision | Unit | GBP net rate | VAT basis | Region handling | Coverage | Authority eligible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Measured-BOQ test catalogue | `measuredBoqEngine.test.ts` only | test keys e.g. `paint.m2` | `2026.07` | implicit | yes (test) | exclusive | via engine | test only | **No (tests only)** |
| Category base tables | `packages/core/.../pricingData.ts` `CATEGORY_BASE` | category name | none | room-category lump | labour+materials lump | exclusive (engine) | `REGION_MULTIPLIERS` | 12 categories | **No** for measured line BOQ |
| Cost library | `packages/services/.../costLibrary.ts` | none | none | £/m² tiers | tier amounts | not line-level | own multipliers | broad categories % | **No** (Enhanced/New Build) |
| Trade day rates | `packages/services/.../tradeRates.ts` | `TradeRate.id` | `lastUpdated` string | day/hour | min/max bands | exclusive labour | per-trade multipliers | trade labour only | **Not** `MeasuredBoqLibraryRate` shape |
| AI / scope defaults | adapters, scope items | none | none | item | invented | unknown | client mult | variable | **No** |
| Manual free type | EstimateBuilder | none | none | free | user number | unknown | none | N/A | **No** |
| DB rate tables | *(none found)* | — | — | — | — | — | — | — | **No** |
| Marketplace `quote_requests` | `quote_requests` table | request id | none | N/A | **no unit rate** | N/A | N/A | messaging only | **No** |

### 4.2 Production catalogue answer

```text
Does a production line-level catalogue currently exist that can satisfy
MeasuredBoqLibraryRate { rateKey, catalogRevision }?

No.

No production measured-BOQ library currently exists.
Ticket 4C2 cannot produce authority-priced library lines until a separately
versioned catalogue foundation is implemented.
```

### 4.3 Catalogue-revision consistency (initial library-only authority)

```text
Every library line in one canonical measured-BOQ estimate must use exactly one
identical catalogRevision.
```

| Rule | Contract |
| --- | --- |
| Mixed revisions in one command | **Reject** before pricing/persistence with `MIXED_CATALOG_REVISIONS` |
| Header `catalog_revision` | Must equal that common revision |
| Item `catalog_revision` | Must equal the header common revision |
| Item library provenance | Durable `rate_source`, `rate_key`, `catalog_revision`, resolved rates (Ticket 4C2C) |
| Resolver | Resolve all entries against an **immutable snapshot** for that revision |
| Deploy | New rate data → **new** catalog revision (no in-place mutation of published revisions) |
| Existing estimates | Reproducible **only** when immutable catalogue snapshot **and** per-line `rateKey`/`catalogRevision` provenance are retained |
| Future mixed-revision estimates | Require line-level mixed-revision model or separate migration — **not** authorised in initial 4C2 |

```text
A canonical measured-BOQ estimate is reproducible only when the immutable
catalogue snapshot and every saved line’s stable rateKey/catalogRevision
provenance are retained.

Header revision alone is insufficient to identify which catalogue rate produced
each line.
```

---

## 5. Builder input classification

| Current input | Current origin | Required engine source | Authority status now | Permitted target treatment |
| --- | --- | --- | --- | --- |
| Manual `unit_cost` | User free typing | `unclassified` unless evidenced quote | Draft | Preserve as draft |
| AI `base_unit_cost` | AI generation | `ai-assisted` | Draft | Preserve as draft |
| Scope fallback cost | Mapping/default | `fallback` | Draft | Preserve as draft |
| Exact catalogue selection | **Not present in product UI** | `library` | N/A | Only through trusted resolver |
| Documented quote | **Not present** on estimate lines | `user-quote` | N/A | Only with complete evidence |

### Locked rules (approved)

```text
A manual numeric unit cost is not automatically a documented user quote.

An AI-suggested amount remains ai-assisted even when the user edits or accepts
the line.

Matching a name, category, or unit to a catalogue entry by fuzzy text is not
sufficient to confer authority.

A catalogue reference must be selected or derived through an approved,
deterministic mapping with an exact stable key and revision.

User acceptance alone never changes AI-assisted into user-quote.
```

---

## 6. Quote support investigation

### 6.1 Required `MeasuredBoqUserQuoteRate` evidence fields

```text
supplierName, quoteReference, issuedAt (date), evidenceRef,
acceptedByUserId, acceptedAt (datetime), netUnitRate, currency GBP,
vatBasis exclusive
```

### 6.2 Current product storage

| Need | Present? | Notes |
| --- | --- | --- |
| Supplier / quote ref / dates / evidence | No on estimate lines | |
| Marketplace `quote_requests` | RFQ messaging only | Not a priced BOQ quote ledger |

### 6.3 Verdict

```text
QUOTE PATH REQUIRES SCHEMA/FILE-EVIDENCE WORK
```

**Initial Ticket 4C2 authority-priced lines must be library-only** (once a
catalogue exists). Do **not** weaken `MeasuredBoqUserQuoteRate`.

---

## 7. Persistence semantics audit and write-protected markers

### 7.1 Columns in use today

| Column | Current usage |
| --- | --- |
| `estimates.status` | Room save always `"draft"`. Workflow values only — **not** pricing authority |
| `estimates.ai_generated` | Room path always `true`; category defaults `false` |
| `estimate_items.is_ai_suggested` | Repository forces `true` for all room items — **unreliable** |

### 7.2 Why existing predicates fail as authority markers

| Predicate | Why unsafe |
| --- | --- |
| `status = 'approved'` | Sales workflow, not engine authority |
| `ai_generated = false/true` | Collides with drafts; financials prefer room drafts |
| `is_ai_suggested` | Overwritten; not rate provenance |

**Option A (existing-column predicate) rejected.**

### 7.3 Locked provisional marker contract (Option B — schema design; not implemented)

```text
pricing_authority:
  none
  category-engine
  measured-boq-engine

pricing_policy_version:
  required whenever pricing_authority != none

catalog_revision:
  required for measured-boq-engine library estimates
  null for none and category-engine unless separately contracted
```

Migration design **must** include database constraints equivalent to:

```text
pricing_authority defaults to none
authority rows require pricing_policy_version
measured-boq-engine rows require catalog_revision
draft/browser rows cannot set an engine authority value
```

### 7.4 RLS requirement (design only — not implemented)

Current authenticated browser writes must be restricted so they may only create
or retain:

```text
pricing_authority = none
```

An authenticated browser write **must not** be able to:

```text
insert category-engine
insert measured-boq-engine
update none → engine authority
change pricing_policy_version
change catalog_revision on an authority row
```

Authority-marker columns must be written **only** through the controlled
canonical persistence boundary (server role → private RPC).

```text
An authority marker is not trustworthy merely because it exists in the row.
It is trustworthy only when browser roles cannot create or escalate it.
```

### 7.5 Separate draft storage (Option C)

localStorage remains **editor UX only**. Preferred durable model: same tables
with `pricing_authority = none` for drafts + write-protected engine markers for
canonical rows.

### 7.6 Selected persistence decision

```text
STOP — AUTHORITY PERSISTENCE MARKER REQUIRED
```

(as a **cumulative gate** with catalogue + server/RPC + protected RLS — see §17)

Legacy rows: default `pricing_authority = none`. **No** heuristic backfill from
`ai_generated`, rooms presence, `status`, shape, or latest timestamp.

---

## 8. Draft vs canonical (target concepts)

| Concept | Contents | Financial use |
| --- | --- | --- |
| **Latest editable room draft** | AI / unclassified / fallback; provisional totals labelled draft | **Never** ROI / report / stage-complete |
| **Latest canonical authority-priced estimate** | Engine-priced category **or** measured-BOQ (all rates eligible) | ROI, reports, progress |

```text
A newer draft must not displace an older canonical estimate.
```

### Provisional APIs

```ts
saveMeasuredBoqDraft(projectId, structure)           // pricing_authority = none
getLatestMeasuredBoqDraft(projectId)

// server only — library-only initial authority
saveAuthorityPricedMeasuredBoq(unknown) → decode → engine → private RPC
getLatestCanonicalEstimate(projectId)  // pricing_authority in (category-engine, measured-boq-engine)

// category — also server-only after 4C2B
saveAuthorityCategoryEstimate(unknown) → runPricingEngine server-side → private RPC
```

Cache keys (provisional):

```text
projectKeys.estimateDraftByProject(projectId)
projectKeys.canonicalEstimateByProject(projectId)
```

---

## 9. Canonical readers audit

| Consumer | Current query | Can receive room draft? | Uses totals as canonical? | Required change |
| --- | --- | ---: | ---: | --- |
| Estimate tab / builder seed | `getLatestRoomEstimate` | **Yes** | Treats as product estimate | Split draft vs canonical |
| Project financials / ROI | Prefers room `mid_total` | **Yes (preferred)** | **Yes** | Canonical only after trusted writers exist |
| Report route | `getLatestProjectEstimate` latest-any | May get draft or category | Yes | Canonical only |
| Pitch deck | estimate + financials | **Yes** | Yes | Canonical only |
| Dashboard / `estimate_done` | Stage on save success | Any save | Progress | Only on **canonical** save |
| Deal Copilot | Own analysis path | Separate | Engine in analysis | Do not feed room draft mid_total |
| Enhanced / New Build | Indicative | No DB | No | **Exclude** from ordering |

### Fallback ordering (target)

```text
1. Authority-priced measured BOQ (marked measured-boq-engine)
2. Authoritative quick category estimate (marked category-engine)
3. No canonical estimate
```

### Reader-cutover gate (mandatory order)

Canonical readers **must not** switch to marker-only queries until:

```text
1. marker / RLS / private RPC / durable idempotency foundation (4C2B)
2. trusted quick-category server writer live and verified (4C2B)
3. catalogue + per-item library provenance foundation (4C2C)
4. draft/canonical data-access and cache separation (4C2D)
5. manual and AI builders stop writing caller totals into the canonical cache (4C2E)
6. only then switch ROI / report / progress to marker-filtered canonical readers (4C2F)
```

Do **not** heuristically backfill legacy rows. Transition policy:

```text
existing users retain editable history
legacy rows do not silently become canonical (pricing_authority = none)
a fresh server-side category recomputation can establish a canonical row
reader cutover cannot occur while legacy builders still mutate the canonical cache key
```

This prevents reader cutover from removing live category authority without
replacement, and prevents untrusted cache contamination of financial readers.

---

## 10. Recommended save commands and runtime decoder

### 10.1 Untrusted input

The server function receives:

```ts
unknown
```

**not** a trusted `SaveAuthorityMeasuredBoqCommand`. TypeScript shapes are
documentation aids only.

### 10.2 Runtime decoder (required contract)

```ts
function decodeSaveAuthorityMeasuredBoqCommand(
  value: unknown,
): SaveAuthorityMeasuredBoqCommand;
```

The decoder must validate the full nested payload **before** authentication,
ownership checks, catalogue resolution, pricing or persistence. Authentication
alone does not make caller input trusted.

Must use an **explicit allowlist** and validate every nested field (shape **and**
values). **Reject** rather than strip-and-continue for forbidden or unknown
properties at every nesting level (observable rejection, not silent
pass-through). Do **not** truncate strings or collections. Do **not** strip
excess array entries.

#### Allowed top-level fields

```text
projectId
region
rooms
idempotencyKey
```

#### Allowed room fields

```text
id
name
areaSqm
items
```

#### Allowed line fields (initial library-only authority)

```text
id
name
category
quantity
unit
costType
notes
rate.source = "library"   // only
rate.rateKey
rate.catalogRevision
```

Initial authority decoding **must reject** rate sources:

```text
user-quote
ai-assisted
fallback
unclassified
```

Those sources may appear only on the **separate draft command**.

#### Forbidden fields (reject — non-exhaustive money/authority/injection)

```text
subtotal, contingency, vat, vatAmount, vatRate
lowTotal, midTotal, highTotal, total, totalCost
roomSubtotal, lineTotal
unitRate, baseUnitRate, resolvedUnitRate, candidateUnitRate, netUnitRate
regionalMultiplier
currency amount supplied for library rates
authority, pricingAuthority, engineSource, policyVersion
catalogue entry objects, catalogue maps
resolver functions, resolveLibraryRate
userId
acceptedByUserId supplied as authority identity
any unknown property at any nesting level
```

The library command contains rate **identity** only (`rateKey`,
`catalogRevision`). Caller-supplied numeric rate fields are forbidden. Trusted
catalogue `baseUnitRate` remains **outside** the decoded request and is
validated by the engine as a finite number greater than zero.

#### Scalar, enum and resource-bound validation

The decoder must validate both shape and values.

```text
projectId:
  string; trimmed; non-empty; bounded length; unique-id style

idempotencyKey:
  string; trimmed; non-empty; bounded length

region:
  exact member of UKRegion

rooms:
  array; not empty; bounded room count

room.id:
  string; trimmed; non-empty; bounded length; unique within request

room.name:
  string; trimmed; non-empty; bounded length

room.areaSqm:
  optional number; when supplied: finite and greater than zero
  (engine semantic — no invented maximum unless shared policy approved)

room.items:
  array; not empty; bounded item count per room; bounded total items

item.id:
  string; trimmed; non-empty; bounded length; unique across request

item.name:
  string; trimmed; non-empty; bounded length

item.category:
  optional string; trimmed when supplied; bounded length

item.quantity:
  number; finite; greater than zero
  (engine semantic — no invented maximum unless shared policy approved)

item.unit:
  string; trimmed; non-empty; bounded length

item.costType:
  exact enum: labour | materials | combined
  (combined remains blocked at persistence until schema decision)

item.notes:
  optional string; bounded length

rate:
  plain object; source exactly "library" for initial canonical command

rate.rateKey:
  string; trimmed; non-empty; bounded length

rate.catalogRevision:
  string; trimmed; non-empty; bounded length
```

#### Resource limits (provisional implementation constants)

The command boundary must enforce limits **before** catalogue lookup, payload
hashing, engine traversal, and database work.

No established authority-command body limits were found in the repository for
this path. Ticket 4C2B must define the following in **one shared
decoder-policy module** (names provisional):

```text
MAX_AUTHORITY_REQUEST_BYTES:     256 KiB decoded JSON
MAX_ROOMS:                       100
MAX_ITEMS_PER_ROOM:              200
MAX_TOTAL_ITEMS:                 2,000
MAX_IDENTIFIER_LENGTH:           128 characters
MAX_IDEMPOTENCY_KEY_LENGTH:      128 characters
MAX_NAME_LENGTH:                 200 characters
MAX_CATEGORY_LENGTH:             100 characters
MAX_UNIT_LENGTH:                 64 characters
MAX_NOTES_LENGTH:                2,000 characters
MAX_RATE_KEY_LENGTH:             160 characters
MAX_CATALOG_REVISION_LENGTH:     64 characters
```

These are **application/abuse limits**, not financial formula limits. They:

```text
must be defined in one shared decoder-policy module
must have boundary and just-over-boundary tests
must not be silently increased by presentation code
```

#### Structured failure semantics (names provisional)

```text
INVALID_AUTHORITY_COMMAND
INVALID_AUTHORITY_FIELD_TYPE
INVALID_AUTHORITY_FIELD_VALUE
FORBIDDEN_AUTHORITY_FIELD
UNSUPPORTED_AUTHORITY_RATE_SOURCE
MIXED_CATALOG_REVISIONS
IDEMPOTENCY_CONFLICT
AUTHORITY_REQUEST_TOO_LARGE
TOO_MANY_ROOMS
TOO_MANY_ITEMS
FIELD_TOO_LONG
```

Only the **validated** result may proceed to authenticate → ownership →
catalogue resolution → engine → persistence.

### 10.3 Authority command shape (after decode)

```ts
type SaveAuthorityMeasuredBoqCommand = {
  projectId: string;
  region: UKRegion;
  rooms: MeasuredBoqRoomInput[]; // library rates only for initial 4C2
  idempotencyKey: string;
};
```

**Must not accept caller totals** (enforced by decoder, not types alone).

### 10.4 Trusted dependencies (server-composed only)

```ts
type SaveAuthorityMeasuredBoqDependencies = {
  resolveLibraryRate: MeasuredBoqLibraryRateResolver; // never from client
  authenticateUser: () => Promise<User>;
  verifyProjectOwnership: (projectId: string, userId: string) => Promise<void>;
  persistAuthorityEstimate: (...) => Promise<Persisted>; // private RPC
};
```

### 10.5 Execution order

```text
enforce raw/decoded request-size limit
decode unknown JSON
reject unknown or forbidden fields
validate scalar types, enums, lengths and collection limits
→ SaveAuthorityMeasuredBoqCommand | structured error
authenticate (session userId only)
derive expectedOwnerId from server session (never from browser command)
verify current project ownership
enforce single catalogRevision across all library lines
resolve catalogue internally (immutable snapshot for that revision)
run repriceMeasuredBoq / runMeasuredBoqEngine
if draft → return issues; do not write canonical
if authority-priced → derive payload hash; idempotency check
private RPC: lock project, recheck owner, persist estimate + provenance +
  marker + idempotency + estimate_done atomically
return persisted estimate
```

### 10.6 Draft command (separate)

May include `ai-assisted` / `fallback` / `unclassified` rates. Writes only
`pricing_authority = none`. Never drives ROI/report. **Must not** set
`projects.estimate_done = true`. **Must not** invoke the canonical project-
completion update.

### 10.7 Category authority command (parallel; formula unchanged)

```text
accept category-engine inputs (region, condition, finish, categories, size) — not totals
authenticate
derive expectedOwnerId; verify project ownership
run runPricingEngine on the server (do not change formula)
persist only server-produced engine totals
write pricing_authority = category-engine
write category pricing_policy_version
same private RPC + durable idempotency + atomic estimate_done boundary
```

Quick-category **browser** payload **cannot** mark a canonical estimate.

---

## 11. Persistence mapping (`MeasuredBoqPricingResult` → tables)

### 11.1 Estimate header

| Engine / control field | Target | Notes |
| --- | --- | --- |
| region | `region` | |
| labourTotal / materialsTotal | `labour_total` / `materials_total` | |
| **combinedTotal** | **blocking** | No column — **block `combined` costType** for initial canonical |
| subtotal, contingency, VAT, low/mid/high | matching columns | **Engine only** |
| policyVersion | `pricing_policy_version` | Required when authority ≠ none |
| authority | `pricing_authority = measured-boq-engine` | Server/RPC only |
| catalog revision | `catalog_revision` | Common immutable revision (header) |
| ai_generated / status | Compatibility only | **Not** authority markers |

### 11.2 Rooms / items and library provenance

Map engine room subtotals and resolved unit rates/line totals from **engine
output only**. Do not force `is_ai_suggested = true` for library authority lines.

Before a measured-BOQ row may be saved with
`pricing_authority = measured-boq-engine`, each canonical **library** line must
durably retain (exact column names finalised in Ticket 4C2C; **semantics
required**):

```text
rate_source = library
rate_key
catalog_revision
resolved_base_unit_rate
regional_multiplier
resolved_unit_rate
```

Consistency constraints:

```text
item catalog_revision = estimate header catalog_revision
rate_source = library for initial measured-BOQ authority
rate_key non-empty
catalog_revision non-empty
resolved rate fields finite and positive
```

All item provenance is written from the **trusted server/engine result**, never
copied from untrusted client money.

Ticket **4D** remains for broader provenance (user quotes, evidence documents,
mixed sources, future multi-revision workflows, legacy repair). Initial 4C2
measured-BOQ authority continues to reject mixed catalogue revisions.
Minimum library `rateKey` provenance is **not** deferred past initial
canonical measured-BOQ persistence.

### 11.3 Project stage fields

A successful **canonical** save transaction sets:

```text
projects.estimate_done = true
```

Rules:

```text
authority-priced category or measured-BOQ save:
  projects.estimate_done = true (atomically with estimate + marker + idempotency)

draft save:
  must not set projects.estimate_done = true

failed canonical save:
  must not leave projects.estimate_done = true from this transaction

identical idempotent replay:
  returns the existing result without creating a second estimate and preserves
  the committed project completion state
```

```text
projects.estimated_gdv is a valuation input, not a refurbishment-pricing output.

Neither runPricingEngine nor MeasuredBoqPricingResult supplies an authoritative
GDV value.

Canonical estimate saves must leave projects.estimated_gdv unchanged.

GDV mutation requires a separate valuation-authority command and contract.
```

Do **not** invent mappings such as `estimated_gdv = midTotal` / `highTotal` /
project cost. Do not conflate refurbishment budget with post-refurbishment
property value.

---

## 12. Transaction safety and private RPC

### 12.1 Current behaviour

Sequential browser inserts + compensating delete; retry → duplicates; no
idempotency store.

### 12.2 Target: serverFn → private RPC privilege boundary

#### Server function

```text
enforce request-size limit; decode untrusted command (allowlist + scalars)
authenticate user; derive userId / expectedOwnerId from server session
verify current project ownership
compose trusted catalogue resolver
resolve and validate every rate
run repriceMeasuredBoq
derive payload hash
invoke atomic persistence RPC with expectedOwnerId (server-derived only)
return persisted canonical estimate
```

`expectedOwnerId` is server-derived and **must never** be accepted from the
browser command. The initial server-side ownership check remains required but is
**not sufficient alone** (TOCTOU: ownership may change before the service-role
RPC runs).

#### Persistence RPC

May accept **engine-produced** rows (TypeScript engine cannot run in Postgres)
but **must not** be a public authority API.

**Preferred design:**

```text
REVOKE EXECUTE from PUBLIC, anon, and authenticated
GRANT EXECUTE only to the controlled server/service database role
server-only credential never exposed to the browser
SECURITY DEFINER with search_path explicitly fixed
all table references schema-qualified
caller-supplied user_id rejected
```

Within the **same transaction** as the canonical write, the RPC must recheck
ownership under a row lock:

```sql
SELECT user_id
FROM public.projects
WHERE id = expected_project_id
FOR UPDATE;
```

Compare the locked owner with server-derived `expectedOwnerId`. Abort when:

```text
project does not exist
owner does not equal expectedOwnerId
ownership changed after initial server check
project row cannot be locked
```

Estimate rows, project-stage update and idempotency record **must not** commit
on ownership failure. Equivalent write-predicate locking is acceptable only if
it provides the same atomic guarantee.

#### Atomic transaction membership

The private RPC transaction **atomically** contains:

```text
project ownership lock/recheck
idempotency lookup/reservation
estimate header insert
estimate room inserts
estimate item inserts
per-item catalogue provenance
authority marker and policy version
projects.estimate_done update
idempotency completion/result link
```

Any failure rolls back every member.

**Not** included in this transaction:

```text
projects.estimated_gdv
```

Draft persistence remains **separate** and must never invoke the canonical
project-completion update.

A browser must not invoke the RPC directly with forged engine totals.

Negative probes: direct RPC by **anon**, **authenticated owner**, and
**authenticated non-owner** must **fail** unless routed through the authorised
server command. See §18 for ownership-race and completion probes.

---

## 13. Durable idempotency (payload-aware)

The canonical command includes allowlisted `idempotencyKey`.

Server derives a deterministic **payload hash** from:

```text
validated projectId
validated region
validated room and line structure
rate references (rateKey + catalogRevision)
catalog revision (common)
pricing policy version
```

Do **not** hash caller totals (forbidden).

Persistence stores (names provisional):

```text
project_id
idempotency_key
payload_hash
resulting estimate_id
operation status where required
```

Durable uniqueness:

```text
UNIQUE (project_id, idempotency_key)
```

Replay semantics:

| Case | Behaviour |
| --- | --- |
| same project + same key + same payload hash | Return existing committed result |
| same project + same key + different payload hash | Reject `IDEMPOTENCY_CONFLICT` |
| same key while identical op pending | Await existing / reject as already pending |
| different key | New save intent |

Idempotency record, ownership lock, provenance, estimate rows, and
`estimate_done` **commit atomically** (see §12.2).

Client `isPending` is a UX guard only — **not** integrity.

---

## 14. Optimistic-cache policy (target)

```text
Never optimistically place caller-calculated totals into the canonical estimate
cache.

Canonical cache writes accept only the persisted response returned by the
trusted server authority command.
```

| Save type | Cache behaviour |
| --- | --- |
| Draft | Draft key only; provisional presentation totals allowed on draft key |
| Authority | Wait for server result; set canonical key from **persisted** response only |
| Rollback | Independent draft vs canonical restore |

**Forbidden** on the canonical key (including optimistic writes):

```text
optimistic caller subtotal
optimistic caller VAT
optimistic caller low/mid/high
optimistic caller line totals
optimistic authority marker
optimistic policy/catalogue revision
```

Draft cache may hold provisional presentation totals but **must not** feed:

```text
ROI
reports
project stage
canonical estimate view
Deal Copilot financial authority
```

During canonical save:

```text
do not optimistically write money
retain current draft
wait for server result
set canonical key from persisted server response
invalidate canonical readers as required
```

On failure:

```text
canonical cache unchanged
draft remains recoverable
estimate_done unchanged
```

---

## 15. No-schema feasibility

```text
NO-SCHEMA 4C2 IS UNSAFE
```

Authority identification, write-protected markers, durable idempotency, private
RPC, and catalogue revision storage require schema/ops work. Prefer a **narrow
migration** over implicit predicates.

---

## 16. Proposed implementation sequence

### Ticket 4C2B — Authority persistence and category-writer foundation

```text
STATUS: COMPLETED
```

```text
authority-marker migration
RLS marker protection
private atomic RPC
atomic owner recheck (FOR UPDATE + expectedOwnerId)
durable idempotency
server-side category writer
canonical estimate_done update (not estimated_gdv)
authenticated authority server command foundation (decoder + bounds)
no measured-BOQ builder integration
```

| Exit gate |
| --- |
| browser cannot create authority rows |
| direct browser RPC call fails (anon/owner/non-owner) |
| ownership race before RPC rejects without partial writes |
| server category save creates valid marked `category-engine` rows |
| category save sets `estimate_done` atomically |
| exact replay is idempotent; conflicting replay fails |

### Ticket 4C2C — Catalogue and minimum provenance foundation

Split:

- **4C2C-A** — discovery and plan (this programme step):
  [`l3-measured-boq-catalogue-foundation-plan.md`](./l3-measured-boq-catalogue-foundation-plan.md)
  — **PLAN COMPLETE** (docs only).
- **4C2C-B** — implementation of catalogue mechanism + minimum provenance —
  **NOT STARTED**. Production rate publication remains behind a **data
  acquisition / licence gate**.

```text
immutable catalogue mechanism (hybrid VCS source → immutable DB revision)
stable rate keys
one revision per initial estimate
server-only resolver (async load → sync Map)
per-item library provenance schema (rate_source, rate_key, catalog_revision,
  resolved rates)
header/item revision constraints
resolver and persistence mapping
reproduction test from saved provenance
no builder integration
no production rates invented from fixtures
```

| Exit gate |
| --- |
| catalogue revision immutable |
| unknown keys fail |
| mixed revisions fail |
| server resolver cannot be browser-injected |
| line without rateKey cannot persist as measured-boq-engine |
| saved provenance reproduces resolver lookup |
| production rates blocked until acquisition gate passes |

### Ticket 4C2D — Draft/canonical data-access and cache foundation

```text
separate repository methods
separate draft and canonical queries
separate cache keys
draft cache accepts provisional client presentation
canonical cache accepts trusted server results only
no ROI/report reader cutover yet
legacy rows remain non-canonical
```

| Exit gate |
| --- |
| draft writes cannot mutate canonical cache |
| authority writes update canonical cache only from persisted server response |
| existing builders still function during transition |

### Ticket 4C2E — Manual and AI builder adapters

```text
manual free-typed rates map to unclassified drafts
AI rates map to ai-assisted drafts
fallback rates remain drafts
exact catalogue selection maps to library references
all builder saves use draft key unless canonical server command succeeds
no caller totals enter canonical command
draft work remains recoverable
legacy canonical-cache mutation removed
```

| Exit gate |
| --- |
| manual and AI builders no longer place caller totals in canonical cache |
| draft save and reload works |
| authority save uses persisted server result |

### Ticket 4C2F — Canonical reader and product cutover

Only after 4C2D and 4C2E pass:

```text
ROI uses canonical estimate only
reports use canonical estimate only
project progress uses canonical completion only
newer draft cannot replace canonical result
fallback ordering is measured-BOQ authority → category authority → none
Enhanced/New Build remain excluded
```

### Ticket 4C2G — Independent verification and merge

```text
decoder abuse probes (bounds, types, oversized payloads)
ownership race probes
RLS/RPC permission probes
idempotency concurrency probes
catalogue reproduction probes
cache contamination probes
reader fallback tests
authenticated preview smoke
exact-SHA merge and main verification
```

**Do not begin any implementation ticket during 4C2A / 4C2A1 / 4C2A2R.**

---

## 17. Decision gate

```text
GO WITH GATES — TRUSTED CATALOGUE, CONTROLLED SERVER/RPC BOUNDARY,
WRITE-PROTECTED AUTHORITY MARKER, AND SAFE CANONICAL READERS REQUIRED FIRST
```

**All primary gates are cumulative (AND).** None may be substituted for another.

| # | Gate |
| --- | --- |
| 1 | Trusted production measured-BOQ catalogue (immutable revisions, rateKey) |
| 2 | Controlled serverFn + private RPC (not browser-executable) |
| 3 | Write-protected authority marker (browser cannot escalate) |
| 4 | Runtime allowlisted decoder (reject forbidden money/injection fields) |
| 5 | Durable payload-aware idempotency |
| 6 | Trusted quick-category server writer live **before** marker-only readers |
| 7 | Canonical readers exclude drafts / legacy `none` rows safely |
| 8 | Atomic multi-table persistence |
| 9 | One catalogRevision per initial measured-BOQ authority estimate |
| 10 | Quote path deferred; library-only initial authority lines |
| 11 | Combined costType blocked or schema-extended |

Secondary stop-conditions (still apply until resolved):

```text
STOP — NO TRUSTED RATE CATALOGUE EXISTS
STOP — AUTHORITY PERSISTENCE MARKER REQUIRED
STOP — CANONICAL READER CANNOT EXCLUDE DRAFTS SAFELY
```

**Do not begin Ticket 4C2 product implementation from this plan alone.**

---

## 18. Required negative probes (implementation tickets)

### Runtime decoder / injection

```text
extra top-level subtotal rejected
nested baseUnitRate in a library rate rejected
nested resolvedUnitRate rejected
caller resolver rejected
caller authority marker rejected
caller policy version rejected
caller userId rejected before authentication
unknown nested property rejected
caller subtotal / VAT / high/mid/low rejected observably before authentication,
  pricing or persistence
forbidden top-level and nested money properties return FORBIDDEN_AUTHORITY_FIELD
null command rejected
array instead of object rejected
non-string projectId rejected
empty projectId rejected
oversized projectId rejected
empty idempotencyKey rejected
oversized request rejected
too many rooms rejected
too many items per room rejected
too many total items rejected
non-array rooms/items rejected
empty rooms rejected
empty room items rejected
invalid region rejected
NaN/Infinity area rejected
zero/negative area rejected
NaN/Infinity quantity rejected
zero/negative quantity rejected
invalid costType rejected
oversized notes rejected
caller numeric library rate rejected
```

### Marker / RLS / RPC / ownership

```text
authenticated browser insert with pricing_authority=category-engine denied
authenticated browser insert with pricing_authority=measured-boq-engine denied
browser update none→engine authority denied
direct authenticated RPC invocation denied
direct anonymous RPC invocation denied
direct owner RPC with forged totals denied
user from another project cannot save
ownership changes after server check but before RPC → save rejected
locked owner mismatch → rejected
project missing/deleted before RPC → rejected
non-owner expectedOwnerId → save rejected
ownership failure → no estimate, marker, idempotency or estimate_done writes
```

### Project completion

```text
canonical category save sets estimate_done atomically
canonical measured-BOQ save sets estimate_done atomically
draft save does not set estimate_done
failed canonical transaction does not set estimate_done
estimate rows fail → estimate_done unchanged
project update fails → no canonical estimate commits
identical replay → one estimate and one committed project-stage result
estimated_gdv remains unchanged on all estimate saves
```

### Category / sequence transition

```text
quick-category browser payload cannot mark a canonical estimate
trusted server category command can create a marked canonical estimate
canonical readers are not switched before trusted category writer exists
reader cutover cannot occur while legacy builder writes canonical key
legacy category/room rows are not heuristically backfilled
```

### Idempotency

```text
identical idempotent replay returns one estimate
conflicting idempotent replay fails
concurrent retry creates one estimate
lost-response retry returns the committed estimate
same key with altered quantity / rateKey / catalogRevision fails
same key used for another project is independent
```

### Catalogue / provenance

```text
mixed catalogue revisions rejected
unknown catalogue revision rejected
unknown rateKey cannot save canonically
immutable revision cannot be overwritten
canonical library line without rateKey cannot persist
item revision mismatch with header cannot persist
saved line provenance reproduces resolver lookup
header-only revision without item rateKey is insufficient
```

### Cache sequencing

```text
draft builder save touches draft key only
authority save waits for server response
caller totals never enter canonical cache
newer draft does not replace canonical financials
reader cutover cannot occur while legacy builder writes canonical key
```

### Draft vs canonical product behaviour

```text
AI / fallback / free-typed manual rate cannot save canonically
missing quote evidence cannot save canonically
newer draft does not replace canonical financials
draft does not mark estimate stage complete
draft does not enter report
canonical engine result does enter ROI/report
failed room/item persistence leaves no partial canonical estimate
```

---

## 19. Deferred work

- Ticket 4D broader provenance (user quotes, evidence documents, mixed sources,
  future multi-revision workflows, legacy provenance repair) — **minimum library
  rateKey provenance is Ticket 4C2C, not deferred**; initial 4C2 measured-BOQ
  authority continues to reject mixed catalogue revisions with
  `MIXED_CATALOG_REVISIONS`
- User-quote authority path
- Fuzzy catalogue matching (**never**)
- Enhanced / New Build as canonical
- Overloading `status = approved` as pricing authority
- Future multi-revision estimate workflows and their separate provenance,
  persistence and reader contract (not authorised in initial 4C2; mixed
  revisions remain rejected today)
- Implicit predicates on legacy rows
- Separate valuation-authority command for `estimated_gdv`

---

## 20. Evidence index (inspected at 4C2A)

```text
packages/services/src/measured-boq/*
packages/services/src/pricing/*
packages/services/src/cost-library/*
packages/services/src/trade-rates/*
packages/core/src/utilities/pricingData.ts
src/components/EstimateBuilder.tsx
src/components/AIEstimateBuilder.tsx
src/features/estimate/application/{repriceMeasuredBoq,build*SaveInput,createEstimate}.ts
src/features/estimate/presentation/hooks/*
src/features/estimate/infrastructure/repositories/estimate.repository.ts
src/lib/queries/projects.ts
src/routes/_authed/projects.$id.estimate.tsx
src/routes/_authed/projects.$id.report.tsx
packages/supabase/src/database.types.ts
supabase/migrations/*estimates* RLS and schema
docs/architecture/l3-estimate-authority-contract.md
```

---

## 21. Relationship to parent contract

Parent contract states room saves persist client totals and that
`is_ai_suggested` is unreliable. This plan **confirms** those facts and elevates
**cumulative** gates: catalogue with per-item provenance, write-protected
markers, private RPC with atomic owner recheck, runtime decoder with bounds,
durable idempotency, builder/cache separation, and safe category-path cutover
before measured-BOQ product wiring.
