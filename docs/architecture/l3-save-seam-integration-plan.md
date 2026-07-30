# L3 Save-Seam and Authority-Input Integration Plan

```text
Status: Proposed integration plan (hardened — Ticket 4C2A1)
Parent contract: l3-estimate-authority-contract.md
Implementation status: Not started
Scope: Ticket 4C2 save-seam and authority-input integration
Base SHA at planning: 922ee4ce08a491eabdffff460293c66eb5eeabdc
Hardening amendment: Ticket 4C2A1 (documentation only)
Ticket: 4C2A / 4C2A1 — no production implementation
```

This document maps **current behaviour**, **security/trust gaps**, **approved
existing contracts**, **recommended target**, and **deferred work**. Nothing
below is claimed as already implemented for authority-priced measured-BOQ
persistence.

Parent contract: [`l3-estimate-authority-contract.md`](./l3-estimate-authority-contract.md).

---

## 1. Executive summary

| Topic | Finding |
| --- | --- |
| Measured-BOQ engine | **Exists** (`runMeasuredBoqEngine`, `repriceMeasuredBoq`) — pure, no persistence |
| Production line-level catalogue | **Does not exist** (test map only in `measuredBoqEngine.test.ts`) |
| Browser save trust | **Untrusted** — client supplies totals; RLS allows owner inserts of arbitrary money |
| Room draft vs canonical | **Collapsed** — room saves write `status: draft` + `ai_generated: true` and still feed financials |
| Existing `status` / `ai_generated` | **Cannot** identify authority-priced estimates |
| Quote provenance path | **Not ready** for `MeasuredBoqUserQuoteRate` without schema/file-evidence work |
| Quick category path | Live via browser `runPricingEngine` + `saveProjectEstimate` — **must migrate to server writer before reader cutover** |
| Primary decision gate | **GO WITH GATES** — **all** cumulative prerequisites (see §17) |

```text
NO-SCHEMA 4C2 IS UNSAFE
```

for full draft/canonical separation, rate provenance retention, write-protected
authority markers, and trusted library resolution. Narrow no-schema experiments
would still leave financial readers and RLS bypass risks unsolved.

**Hardening (4C2A1):** runtime allowlisted decoder; browser cannot escalate
markers; private RPC; durable idempotency; one immutable catalogue revision per
initial authority estimate; safe category-path transition before reader cutover.

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
  - receive unknown JSON
  - runtime-decode allowlisted command (reject forbidden/unknown fields)
  - authenticate current user; derive userId from session only
  - verify project ownership
  - compose trusted catalogue resolver internally
  - call repriceMeasuredBoq / runMeasuredBoqEngine
  - reject draft outcomes for canonical persistence
  - derive payload hash + enforce durable idempotency
  - invoke private atomic persistence RPC with engine output only
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
| Resolver | Resolve all entries against an **immutable snapshot** for that revision |
| Deploy | New rate data → **new** catalog revision (no in-place mutation of published revisions) |
| Existing estimates | Remain reproducible against **saved** revision |
| Future mixed-revision estimates | Require line-level durable revision, revision-set model, or separate migration — **not** authorised in initial 4C2 |

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

Canonical readers **must not** switch to marker-only queries until at least one
live trusted writer can create marked canonical rows.

```text
1. deploy marker / RLS / private RPC / durable idempotency foundation
2. deploy trusted quick-category server writer
3. verify marked category-engine rows
4. only then switch ROI / report / canonical readers to marker filtering
5. add measured-BOQ canonical writer after catalogue foundation
```

Do **not** heuristically backfill legacy rows. Transition policy:

```text
existing users retain editable history
legacy rows do not silently become canonical (pricing_authority = none)
a fresh server-side category recomputation can establish a canonical row
```

This prevents reader cutover from removing live category authority without
replacement.

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

Must use an **explicit allowlist** and validate every nested field **before**
authentication completion is insufficient alone — decode first, then
authenticate, ownership, catalogue, engine, persistence.

**Reject** rather than strip-and-continue for forbidden or unknown properties
at every nesting level (observable rejection, not silent pass-through).

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
unitRate, baseUnitRate, resolvedUnitRate
regionalMultiplier
currency amount supplied for library rates
authority, pricingAuthority, engineSource, policyVersion
catalogue entry objects, catalogue maps
resolver functions, resolveLibraryRate
userId
acceptedByUserId supplied as authority identity
any unknown property at any nesting level
```

#### Structured failure semantics (names provisional)

```text
INVALID_AUTHORITY_COMMAND
FORBIDDEN_AUTHORITY_FIELD
UNSUPPORTED_AUTHORITY_RATE_SOURCE
MIXED_CATALOG_REVISIONS
IDEMPOTENCY_CONFLICT
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
decode unknown → SaveAuthorityMeasuredBoqCommand | structured error
→ authenticate (session userId only)
→ verify project ownership
→ enforce single catalogRevision across all library lines
→ resolve catalogue internally (immutable snapshot for that revision)
→ run repriceMeasuredBoq / runMeasuredBoqEngine
→ if draft → return issues; do not write canonical
→ if authority-priced → derive payload hash; idempotency check
→ private RPC persists engine rows + marker + idempotency record atomically
→ return persisted estimate
```

### 10.6 Draft command (separate)

May include `ai-assisted` / `fallback` / `unclassified` rates. Writes only
`pricing_authority = none`. Never drives ROI/report.

### 10.7 Category authority command (parallel; formula unchanged)

```text
accept category-engine inputs (region, condition, finish, categories, size) — not totals
authenticate
verify project ownership
run runPricingEngine on the server (do not change formula)
persist only server-produced engine totals
write pricing_authority = category-engine
write category pricing_policy_version
same private RPC + durable idempotency boundary
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
| catalog revision | `catalog_revision` | Common immutable revision |
| ai_generated / status | Compatibility only | **Not** authority markers |

### 11.2 Rooms / items

Map engine room subtotals and resolved unit rates/line totals from **engine
output only**. No durable rate_source/rateKey columns in initial 4C2 (Ticket 4D).
Do not force `is_ai_suggested = true` for library authority lines.

---

## 12. Transaction safety and private RPC

### 12.1 Current behaviour

Sequential browser inserts + compensating delete; retry → duplicates; no
idempotency store.

### 12.2 Target: serverFn → private RPC privilege boundary

#### Server function

```text
decode untrusted command
authenticate user; derive userId from server session
verify project ownership
compose trusted catalogue resolver
resolve and validate every rate
run repriceMeasuredBoq
derive payload hash
invoke atomic persistence RPC
return persisted canonical estimate
```

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
caller-supplied user_id ignored
project ownership verified before service-role persistence
```

**Alternative:** RPC independently re-verifies authentication, ownership,
authority, catalogue, and totals before write (heavier; still not browser-open
without those checks).

A browser must not invoke the RPC directly with forged engine totals.

Negative probes: direct RPC by **anon**, **authenticated owner**, and
**authenticated non-owner** must **fail** unless routed through the authorised
server command.

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

Idempotency record and canonical estimate writes **commit atomically**.

Client `isPending` is a UX guard only — **not** integrity.

---

## 14. Optimistic-cache policy (target)

```text
Never optimistically place caller-calculated totals into the canonical estimate
cache.
```

| Save type | Cache behaviour |
| --- | --- |
| Draft | Draft key only |
| Authority | Wait for server result; set canonical key |
| Rollback | Independent draft vs canonical restore |

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

### Ticket 4C2B — Authority persistence foundation and category-path hardening

```text
authority-marker migration
RLS marker escalation prevention
private atomic RPC
durable idempotency store + uniqueness
authenticated authority server command foundation (decoder)
server-side quick-category repricing and save
no measured-BOQ builder integration
```

| Exit gate |
| --- |
| browser cannot create authority rows |
| direct browser RPC call fails (anon/owner/non-owner) |
| server category save creates valid marked `category-engine` rows |
| exact replay is idempotent; conflicting replay fails |

### Ticket 4C2C — Versioned measured-BOQ catalogue foundation

```text
immutable production catalogue
stable rate keys
one revision per initial estimate
server-only resolver composition
catalogue validation and coverage tests
no builder integration
```

| Exit gate |
| --- |
| catalogue revision immutable |
| unknown keys fail |
| mixed revisions fail |
| server resolver cannot be injected |

### Ticket 4C2D — Draft/canonical readers and cache cutover

```text
separate draft and canonical readers
separate cache keys
financials and reports use canonical rows only
legacy rows remain non-canonical
reader switch only after trusted category writer is live
```

### Ticket 4C2E — Manual and AI builder adapters

```text
manual free-typed lines remain unclassified drafts
AI lines remain ai-assisted drafts
exact catalogue selection can create library references
caller totals never enter canonical command
draft work remains recoverable
```

### Ticket 4C2F — Independent verification and merge

```text
authority bypass probes
RLS probes
RPC permission probes
idempotency concurrency probes
reader fallback tests
authenticated preview smoke
exact-SHA merge and main verification
```

**Do not begin any implementation ticket during 4C2A / 4C2A1.**

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
caller userId ignored/rejected
unknown nested property rejected
caller subtotal / VAT / high/mid/low ignored (never reach persistence)
```

### Marker / RLS / RPC

```text
authenticated browser insert with pricing_authority=category-engine denied
authenticated browser insert with pricing_authority=measured-boq-engine denied
browser update none→engine authority denied
direct authenticated RPC invocation denied
direct anonymous RPC invocation denied
direct owner RPC with forged totals denied
user from another project cannot save
```

### Category transition

```text
quick-category browser payload cannot mark a canonical estimate
trusted server category command can create a marked canonical estimate
canonical readers are not switched before trusted category writer exists
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

### Catalogue

```text
mixed catalogue revisions rejected
unknown catalogue revision rejected
unknown rateKey cannot save canonically
immutable revision cannot be overwritten
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

- Ticket 4D durable line-level provenance columns
- User-quote authority path
- Fuzzy catalogue matching (**never**)
- Enhanced / New Build as canonical
- Overloading `status = approved` as pricing authority
- Mixed catalogue revisions in one estimate
- Implicit predicates on legacy rows

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
**cumulative** gates: catalogue, write-protected markers, private RPC, runtime
decoder, durable idempotency, and safe category-path cutover before measured-BOQ
product wiring.
