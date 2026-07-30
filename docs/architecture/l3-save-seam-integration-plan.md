# L3 Save-Seam and Authority-Input Integration Plan

```text
Status: Proposed integration plan
Parent contract: l3-estimate-authority-contract.md
Implementation status: Not started
Scope: Ticket 4C2 save-seam and authority-input integration
Base SHA at planning: 922ee4ce08a491eabdffff460293c66eb5eeabdc
Ticket: 4C2A (documentation only — no production implementation)
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
| Quick category path | Live via `runPricingEngine` + `saveProjectEstimate` — **must not break** |
| Primary decision gate | **GO WITH GATES** — trusted catalogue **and** server/RPC authority boundary **and** authority marker required before 4C2 product wiring |

```text
NO-SCHEMA 4C2 IS UNSAFE
```

for full draft/canonical separation, rate provenance retention, and trusted
library resolution. Narrow no-schema experiments would still leave financial
readers and RLS bypass risks unsolved.

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

### 2.3 Quick category estimate (authoritative path — protect)

```text
src/routes/_authed/projects.$id.estimate.tsx (quick tab)
  → runPricingEngine (via @/core/pricing shim → @repo/services)
  → saveProjectEstimate(projectId, PricingEngineResult)
  → estimates + estimate_items (category line items; no estimate_rooms)
```

| Property | Evidence |
| --- | --- |
| Money authority | `runPricingEngine` in `@repo/services` using `@repo/core` tables |
| Totals | Engine-owned labour/materials/subtotal/contingency/VAT/low/mid/high |
| Persistence | Browser repo still inserts engine result fields; **no reprice on server** |
| Readers | `getLatestProjectEstimate` (any latest row by `created_at`) |
| Ticket 4C2 constraint | **Must not break** category engine or this save path |

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
| Browser repository | **Yes** | No | No (compensating delete only) | Keep for draft or category shim only; **not** authority |
| Authenticated serverFn | **No** if designed correctly | **Yes** (server-side resolver) | Partial (still multi-statement unless RPC) | **Recommended authority entry** |
| Supabase RPC (security definer / controlled) | **No** if totals not accepted | **Yes** (server catalogue) | **Yes** (single transaction) | Preferred for atomicity gate |
| Edge/server function | Same as serverFn | Yes | Depends | Optional; prefer TanStack serverFn + RPC |

### 3.3 Recommended canonical save boundary

```text
Authenticated serverFn (and/or RPC for atomicity):
  - accept no caller totals
  - authenticate current user
  - verify project ownership (project.user_id = auth user)
  - compose trusted catalogue resolver internally (never client-supplied)
  - call repriceMeasuredBoq / runMeasuredBoqEngine
  - reject draft outcomes for canonical persistence
  - persist only engine output
  - return structured issues when not authority-priced
```

Browser repository remains usable for **explicit draft** saves only after
readers stop treating drafts as financial authority.

---

## 4. Rate catalogue inventory

### 4.1 Candidates

| Candidate | Path/table | Stable key | Revision | Unit | GBP net rate | VAT basis | Region handling | Coverage | Authority eligible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Measured-BOQ test catalogue | `measuredBoqEngine.test.ts` only | test keys e.g. `paint.m2` | `2026.07` | implicit | yes (test) | exclusive | via engine | test only | **No (tests only)** |
| Category base tables | `packages/core/.../pricingData.ts` `CATEGORY_BASE` | category name | none | room-category lump | labour+materials lump | exclusive (engine) | `REGION_MULTIPLIERS` | 12 categories | **No** for measured line BOQ |
| Cost library | `packages/services/.../costLibrary.ts` | none | none | £/m² tiers | tier amounts | not line-level | own multipliers | broad categories % | **No** (Enhanced/New Build) |
| Trade day rates | `packages/services/.../tradeRates.ts` | `TradeRate.id` | `lastUpdated` string | day/hour | min/max bands | exclusive labour | per-trade multipliers | trade labour only | **Not** `MeasuredBoqLibraryRate` shape; not materials BOQ |
| AI / scope defaults | adapters, scope items | none | none | item | invented | unknown | client mult | variable | **No** (ai-assisted / fallback) |
| Manual free type | EstimateBuilder | none | none | free | user number | unknown | none | N/A | **No** (unclassified) |
| DB rate tables | *(none found)* | — | — | — | — | — | — | — | **No** |
| Marketplace `quote_requests` | `quote_requests` table | request id | none | N/A | **no unit rate** | N/A | N/A | messaging only | **No** for BOQ quotes |

### 4.2 Production catalogue answer

```text
Does a production line-level catalogue currently exist that can satisfy
MeasuredBoqLibraryRate { rateKey, catalogRevision }?

No.

No production measured-BOQ library currently exists.
Ticket 4C2 cannot produce authority-priced library lines until a separately
versioned catalogue foundation is implemented.
```

Do **not** treat `CATEGORY_BASE` or `DEFAULT_COST_LIBRARY` as measured-BOQ
catalogues: they lack line-level units, stable rate identities, and revisioned
`rateKey` entries.

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
| Supplier name | No on estimates | Marketplace quotes are RFQ messages, not priced lines |
| Quote reference | No | |
| Issued date | No | |
| Evidence / file ref | No durable estimate attachment schema for quotes | |
| Accepted user / timestamp | Auth has user id; not stored on estimate_items | |
| Net unit rate | Only as free `unit_cost` | No quote provenance |
| VAT basis | Not stored per line | |

`quote_requests`: `title`, `message`, `project_id`, `tradesperson_id`, `status` —
**not** a priced BOQ quote ledger.

### 6.3 Verdict

```text
QUOTE PATH REQUIRES SCHEMA/FILE-EVIDENCE WORK
```

**Initial Ticket 4C2 authority-priced lines must be library-only** (once a
catalogue exists). Do **not** weaken `MeasuredBoqUserQuoteRate` to fit incomplete
current data.

---

## 7. Persistence semantics audit

### 7.1 Columns in use

| Column | Current usage |
| --- | --- |
| `estimates.status` | Room save always `"draft"`. Values allowed: draft \| sent \| approved \| rejected \| invoiced. **Not** used as authority-priced |
| `estimates.ai_generated` | Room path always `true`; category path defaults `false`. Used by `getLatestRoomEstimate` filter only |
| `estimates.notes` | Free text |
| `estimate_items.is_ai_suggested` | Repository forces `true` for **all** room items (manual included) — **unreliable provenance** |
| Rooms | name, area_sqm, subtotal (caller-derived), display_order |
| Timestamps | `created_at` / `updated_at` — “latest wins” readers |

### 7.2 Why existing predicates fail

| Predicate | Why unsafe as authority marker |
| --- | --- |
| `status = 'approved'` | No writer sets approved for engine-priced authority; product usage is sales workflow semantics, not pricing authority |
| `ai_generated = false` | Manual room saves still go through `saveAIEstimate` with `ai_generated: true`; category saves are false but not measured-BOQ; AI-repriced authority would need true structure + engine rates |
| `ai_generated = true` | Identifies room/AI path, **including drafts with client totals** — financials **prefer** this path today |
| `is_ai_suggested` | Overwritten; cannot distinguish manual vs AI vs library |

### 7.3 Authority-persistence options

#### Option A — Existing-column predicate

| Requirement | Provable today? |
| --- | --- |
| No draft row matches | **No** — drafts use same columns as any room save |
| All category authority estimates match | Only if predicate is “category shape” heuristics (fragile) |
| Future measured-BOQ authority matches | **No** without new marker or notes encoding (fragile) |
| Legacy deterministic treatment | Collides: latest room draft already preferred by financials |
| Reports/ROI consistent | **No** without reader rewrite + marker |

**Option A rejected.**

#### Option B — Minimal schema marker (recommended)

Minimum durable fields (names provisional):

```text
estimates.pricing_authority   text  -- 'none' | 'category-engine' | 'measured-boq-engine'
estimates.pricing_policy_version text  -- e.g. MEASURED_BOQ_POLICY_VERSION / pricing engine version
estimates.catalog_revision    text null  -- measured BOQ only when library used
-- optional later Ticket 4D:
-- estimate_items.rate_source, rate_key, rate_reference
```

Without **at least** an estimate-level authority marker (+ policy version),
canonical readers cannot safely exclude drafts.

#### Option C — Separate draft storage

| Approach | Pros | Cons |
| --- | --- | --- |
| localStorage only | Already used for builder draft key | Multi-device loss; not server truth |
| Same table draft-only query | Simple | Needs marker/status discipline; race with latest-wins |
| Dedicated draft table | Clean isolation | Migration + dual writers |
| JSON workspace | Flexible | Query/ROI hard |

**Preferred:** Option **B** marker on `estimates` + keep draft rows in same tables
with explicit non-authority values; separate query methods. localStorage remains
**editor UX only**, not financial authority.

### 7.4 Selected persistence decision

```text
STOP — AUTHORITY PERSISTENCE MARKER REQUIRED
```

(as a **gate** before 4C2 product save; listed under multi-gate verdict below)

---

## 8. Draft vs canonical (target concepts)

| Concept | Contents | Financial use |
| --- | --- | --- |
| **Latest editable room draft** | AI / unclassified / fallback rates; provisional totals labelled draft | **Never** ROI / report / stage-complete authority |
| **Latest canonical authority-priced estimate** | Engine-priced category **or** measured-BOQ (all rates eligible) | ROI, reports, progress |

Rules:

```text
A newer draft must not displace an older canonical estimate.
Draft may display provisional totals with clear draft labelling.
Canonical may drive financials and reports only.
```

### Provisional APIs (use repo conventions when implementing)

```ts
// Draft (browser or server; money not authoritative)
saveMeasuredBoqDraft(projectId, structure)
getLatestMeasuredBoqDraft(projectId)

// Authority (server only; no caller totals)
saveAuthorityPricedMeasuredBoq(command) // serverFn
getLatestCanonicalEstimate(projectId)   // predicate: pricing_authority in (...)

// Existing (preserve)
saveProjectEstimate / getLatestProjectEstimate  // category engine path
```

Cache keys (provisional — not implemented in 4C2A):

```text
projectKeys.estimateDraftByProject(projectId)
projectKeys.canonicalEstimateByProject(projectId)
// Deprecate dual use of estimateByProject for both draft and money
```

---

## 9. Canonical readers audit

| Consumer | Current query | Can receive room draft? | Uses totals as canonical? | Required change |
| --- | --- | ---: | ---: | --- |
| Estimate tab / builder seed | `estimateQueryOptions` → `getLatestRoomEstimate` (`ai_generated=true`, latest) | **Yes** | Treats as product estimate | Split draft vs canonical readers |
| Project financials / ROI | `financialsQueryOptions` prefers room `mid_total`, else project estimate | **Yes (preferred)** | **Yes** | Prefer **canonical only**; never draft mid_total |
| Report route | `getLatestProjectEstimate` (latest any) | May get room or category | Yes when present | Canonical only; rebuild only from engine if allowed |
| Report engine | May re-run `runPricingEngine` if rebuilding | N/A | Yes | Keep category engine; do not use draft BOQ |
| Pitch deck | `estimateQueryOptions` + financials | **Yes** | Yes | Canonical only |
| Dashboard / `estimate_done` | Stage flag via `useSetProjectStage` | Stage may be set on any save success | Progress authority | Set complete only on **canonical** save |
| Deal Copilot | Own deal analysis pricing path | Separate | Uses `runPricingEngine` in analysis | Do not feed room draft mid_total |
| Enhanced / New Build | Indicative only | No DB | No | **Exclude** from canonical ordering |

### Fallback ordering (approved target)

```text
1. Authority-priced measured BOQ (if marked + present)
2. Authoritative quick category estimate (runPricingEngine result, marked)
3. No canonical estimate
```

**Do not** include Enhanced or New Build in this ordering.

### Draft exclusion

Today: **no safe exclusion**. After marker + reader changes: drafts filtered by
`pricing_authority` (or equivalent) **and** never written into financial cache
from optimistic client totals.

---

## 10. Recommended save commands (design only)

### 10.1 Authority command

```ts
type SaveAuthorityMeasuredBoqCommand = {
  projectId: string;
  region: UKRegion;
  rooms: MeasuredBoqRoomInput[]; // structure + rate provenance only — no totals
};

type SaveAuthorityMeasuredBoqDependencies = {
  resolveLibraryRate: MeasuredBoqLibraryRateResolver; // server-composed
  authenticateUser: () => Promise<User>;
  verifyProjectOwnership: (projectId: string, userId: string) => Promise<void>;
  persistAuthorityEstimate: (engine: MeasuredBoqPricingResult, meta: ...) => Promise<Persisted>;
};
```

**Execution order:**

```text
authenticate
→ verify project ownership
→ resolve catalogue internally (never accept client resolver / rates for library)
→ run repriceMeasuredBoq / runMeasuredBoqEngine
→ if draft → return issues; do not write canonical
→ if authority-priced → map engine result → persist trusted rows only
→ return persisted estimate
```

**Must not accept:** subtotal, VAT, contingency, low/mid/high, room subtotal,
line total, regional multiplier, authority boolean, engine source, catalogue
amounts.

### 10.2 Draft command (separate)

```ts
type SaveMeasuredBoqDraftCommand = {
  projectId: string;
  region: UKRegion;
  rooms: MeasuredBoqRoomInput[]; // may include ai-assisted / unclassified
  // optional provisional display totals for UI only — not financial authority
};
```

Draft persist may remain browser-side **only after** financial readers ignore it.

---

## 11. Persistence mapping (`MeasuredBoqPricingResult` → tables)

### 11.1 Estimate header

| Engine field | Target column | Notes |
| --- | --- | --- |
| region | `region` | |
| labourTotal | `labour_total` | |
| materialsTotal | `materials_total` | |
| **combinedTotal** | **blocking** | No `combined_total` column — see §11.2 |
| subtotal | `subtotal` | Engine |
| contingency | `contingency` | Engine rate |
| vat | `vat_amount` + `vat_rate` | Engine |
| lowTotal / midTotal / highTotal | `low_total` / `mid_total` / `high_total` | Engine only |
| policyVersion | **no column** | Needs marker field (`pricing_policy_version`) |
| authority | **no column** | Needs `pricing_authority` |
| catalog revision | **no column** | Needs `catalog_revision` or notes-only (weak) |
| ai_generated | Compatibility | Prefer `false` for engine authority; do not use as sole marker |
| status | Keep workflow default | **Not** authority marker; avoid overloading `approved` |
| timeline | `timeline_weeks` | May be 0 / N/A for BOQ |

### 11.2 `combinedTotal` decision

```text
The estimates table has labour_total and materials_total but no combined_total.
```

| Option | Assessment |
| --- | --- |
| Fold into labour_total | Mislabels cost type |
| Fold into materials_total | Mislabels cost type |
| Split by policy | Needs product rule + durable type |
| Retain only in subtotal | Loses labour/materials split for combined lines |
| Schema field | Cleanest |
| Block combined lines for canonical | **Recommended for no-schema attempt** |

**Selection for initial 4C2:** **Block `combined` costType lines for canonical
persistence** until schema or explicit split policy is approved. Engine may still
compute them for future use; authority save rejects or requires pre-split inputs.

### 11.3 Rooms

| Engine | Column |
| --- | --- |
| name | `name` |
| areaSqm | `area_sqm` |
| room subtotal (engine) | `subtotal` |
| order | `display_order` |

### 11.4 Items

| Engine | Column | Gap |
| --- | --- | --- |
| name | `name` | |
| category | `category` | |
| quantity | `quantity` | |
| unit | `unit` | |
| resolved unit rate | `unit_cost` | |
| line total | `total_cost` | |
| cost type | — | **No column** |
| rate source / reference | — | **No durable provenance** (Ticket 4D) |
| notes | `notes` | |
| is_ai_suggested | boolean | Must **not** force true for library/quote lines |

**Cannot store durably today:** rate source, rateKey, catalogRevision, quote
evidence block, policy version, combined cost type, authority flag.

---

## 12. Transaction safety

### 12.1 Current behaviour

Sequential inserts with best-effort delete of estimate header on room/item
failure. Failure modes:

| Case | Risk |
| --- | --- |
| Header OK, rooms fail | Compensating delete attempted; can fail → orphan header |
| Rooms OK, items fail | Same |
| Network retry | Duplicate full estimates (no idempotency key) |
| Double-click | Multiple mutations → multiple rows; “latest wins” |
| Catalogue revision mid-save | N/A until catalogue exists |

### 12.2 Recommendation

```text
Minimum safe canonical persistence:
  - server-side orchestration (createServerFn)
  - Supabase RPC (single transaction) for header+rooms+items
  - idempotency key (client mutation id) unique per project save intent
  - reject duplicate-submit when pending
```

Atomic RPC is a **separate migration approval gate** — do not implement in 4C2A.

Draft saves may keep compensating rollback if non-financial.

---

## 13. Optimistic-cache policy (target)

```text
Never optimistically place caller-calculated totals into the canonical estimate
cache.
```

| Save type | Cache behaviour |
| --- | --- |
| Draft | Update **draft** key only (or local editor state); label provisional |
| Authority | Prefer **wait for server result**; then set canonical key |
| Rollback | Independent restore of draft vs canonical keys |

Current `useSaveEstimateBuilder` optimistic write into `estimateQueryOptions`
**violates** this rule and must change in implementation tickets.

---

## 14. No-schema feasibility

```text
NO-SCHEMA 4C2 IS UNSAFE
```

| Dimension | Safe without schema? |
| --- | --- |
| Authority identification | **No** |
| Draft preservation | Partial (localStorage / latest draft heuristic fragile) |
| Canonical reader filtering | **No** |
| Rate provenance | **No** durable |
| Policy / catalogue revision | **No** durable |
| Combined cost | Only by **blocking** combined lines |
| Quote evidence | **No** |
| Transaction safety | **No** true atomicity without RPC |
| Legacy rows | Treat all pre-marker room rows as **draft / non-canonical** |

A narrow schema migration (authority marker + policy version + optional catalog
revision) is **preferred** over inventing implicit predicates.

---

## 15. Proposed implementation sequence

### Ticket 4C2B — Trust-boundary + catalogue foundation

| | |
| --- | --- |
| **Goal** | Server-side save command shell + trusted catalogue adapter contract; no builder UX |
| **Allowed** | `src/features/estimate/serverFns/*`, services catalogue package module, invariants |
| **Excluded** | Builder components, migrations unless catalogue seed approved, report rewrites |
| **Tests** | Auth, ownership, “no caller totals”, fake resolver rejection |
| **Rollback** | Delete serverFn; no data migration |
| **Entry** | 4C2A plan approved |
| **Exit** | Catalogue exists **or** explicit decision that library authority remains blocked; server boundary cannot be bypassed by browser repo for authority path |

### Ticket 4C2C — Draft/canonical separation (+ schema if approved)

| | |
| --- | --- |
| **Goal** | Authority marker; draft save; canonical save; reader predicates; cache keys |
| **Allowed** | migrations (if approved), repository, `projects.ts` queries, financials |
| **Excluded** | Full AI/manual UX polish |
| **Tests** | Draft excluded from financials/report; newer draft ≠ replace canonical |
| **Entry** | 4C2B exit or parallel if schema-only |
| **Exit** | Financials use canonical only |

### Ticket 4C2D — Manual builder adapter

| | |
| --- | --- |
| **Goal** | Map manual lines → unclassified draft; optional exact library refs; remove caller totals from authority submit |
| **Excluded** | Fuzzy catalogue matching |
| **Entry** | 4C2C readers safe |
| **Exit** | Manual draft save + authority only via server |

### Ticket 4C2E — AI builder adapter

| | |
| --- | --- |
| **Goal** | AI → ai-assisted draft; block direct canonical; allow exact library replacement |
| **Entry** | 4C2D patterns |
| **Exit** | AI draft preserved; no AI money in ROI |

### Ticket 4C2F — Verification and merge

| | |
| --- | --- |
| **Goal** | Full negative probe suite + authenticated smoke |
| **Exit** | Main-ready after review |

---

## 16. Required negative probes (implementation tickets)

```text
caller subtotal is ignored
caller VAT is ignored
caller high/mid/low totals are ignored
unknown rateKey cannot save canonically
wrong catalogRevision cannot save canonically
AI rate cannot save canonically
fallback rate cannot save canonically
free-typed manual rate cannot save canonically
missing quote evidence cannot save canonically
user from another project cannot save
browser caller cannot inject a fake resolver
newer draft does not replace canonical financials
draft does not mark estimate stage complete
draft does not enter report
canonical engine result does enter ROI/report
failed room/item persistence leaves no partial canonical estimate
duplicate retry does not create duplicate canonical estimates
```

---

## 17. Decision gate

```text
GO WITH GATES — TRUSTED CATALOGUE OR SERVER BOUNDARY REQUIRED FIRST
```

**Primary gates (all required before 4C2 product integration):**

1. **Trusted production measured-BOQ catalogue** (`rateKey` + `catalogRevision` + GBP exclusive rates) — today: **missing**.
2. **Server/RPC authority save boundary** — browser repo not trusted.
3. **Authority persistence marker** (schema) — existing `status` / `ai_generated` insufficient.
4. **Canonical reader rewrite** so drafts cannot drive financials/reports.
5. **Atomic persistence** (RPC recommended) for canonical multi-table writes.
6. **Quote path deferred** until file-evidence schema; library-only authority initially.
7. **Combined costType** blocked or schema-extended before canonical BOQ with combined lines.

Secondary labels that also apply as stop-conditions until resolved:

```text
STOP — NO TRUSTED RATE CATALOGUE EXISTS
STOP — AUTHORITY PERSISTENCE MARKER REQUIRED
STOP — CANONICAL READER CANNOT EXCLUDE DRAFTS SAFELY
```

**Do not begin Ticket 4C2 implementation from this plan alone.**

---

## 18. Deferred work

- Ticket 4D durable line-level provenance columns
- User-quote authority path
- Fuzzy catalogue matching (never)
- Enhanced / New Build as canonical
- Overloading `status = approved` as pricing authority
- Implicit predicates on legacy rows

---

## 19. Evidence index (inspected)

```text
packages/services/src/measured-boq/*
packages/services/src/pricing/*
packages/services/src/cost-library/*
packages/services/src/trade-rates/*
packages/core/src/utilities/pricingData.ts
src/components/EstimateBuilder.tsx
src/components/AIEstimateBuilder.tsx
src/features/estimate/application/{repriceMeasuredBoq,build*SaveInput,createEstimate}.ts
src/features/estimate/presentation/hooks/{useSaveEstimateBuilder,useAIEstimateBuilderSave,useEstimate}.ts
src/features/estimate/infrastructure/repositories/estimate.repository.ts
src/lib/queries/projects.ts
src/routes/_authed/projects.$id.estimate.tsx
src/routes/_authed/projects.$id.report.tsx
packages/supabase/src/database.types.ts (estimates, estimate_rooms, estimate_items, quote_requests)
supabase/migrations/*estimates* RLS and schema
docs/architecture/l3-estimate-authority-contract.md
```

---

## 20. Relationship to parent contract

Parent contract already states room saves persist client totals and that
`is_ai_suggested` is unreliable. This plan **confirms** those facts at the save
seam and elevates catalogue + marker + server boundary as **implementation
gates** before Ticket 4C2 wiring.
