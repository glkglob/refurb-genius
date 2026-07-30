# L3 Estimate Authority Contract

## Status

```text
Status: Approved architecture contract
Scope: Project-bound L3 estimate workflow
Implementation status: Not yet consolidated
Base SHA at contract authoring: 0181dd45727abeb1c6c512d64666549982599e95
```

This document is the **authority contract** for project-bound L3 estimates. It
records approved product and architecture decisions only. It does **not** claim
that runtime code already enforces every rule.

| Layer | Meaning |
| --- | --- |
| **Current behaviour** | What `main` does today (may violate the target) |
| **Approved target contract** | What implementation must converge to |
| **Deferred work** | Explicitly out of Ticket 4B and initial Ticket 4C |

---

## Product levels

| Level | Surface | Persistence | Product confidence |
| --- | --- | --- | --- |
| **L1** | Instant estimate (`/estimate/instant`, details closed) | none | `low` only |
| **L2** | Same progressive route (details open) | none | `low` or `medium`; never `high` |
| **L3** | Project-bound category estimate and measured room/BOQ estimate (`/projects/$id/estimate`) | project-bound when **authority-priced** | initially `low` \| `medium`; **`high` blocked** |

**L3 is not a wrapper around L1 or L2.** L1/L2 remain a separate non-persisting
progressive journey. L3 is a separate project workflow and use-case surface.

L1/L2 money authority remains:

```text
Route → L1EstimateForm → runL1Estimate | runL2Estimate
  → resolveL1Inputs | resolveL2Inputs → runPricingEngine → CostSummary
```

That path is **live and must not change** under this contract.

---

## L3 mode classification

| Surface | Classification | Authoritative money path | Persistence eligibility |
| --- | --- | --- | --- |
| Quick category estimate | **L3 authoritative** | `runPricingEngine` | Yes (when saved as authority-priced) |
| AI-assisted room builder | **L3 draft until repriced** | Measured-BOQ engine in `@repo/services` (**planned**) | Only after deterministic repricing |
| Manual room builder | **L3 draft until repriced** | Measured-BOQ engine in `@repo/services` (**planned**) | Only after deterministic repricing |
| Enhanced estimate | **Adjacent indicative calculator** | `runEnhancedEstimate` | Not canonical |
| New-build estimate | **Adjacent indicative calculator** | `runNewBuildEstimate` | Not canonical |

**Enhanced** and **New Build** are **not** canonical L3 modes. They may remain
on the estimate page as adjacent tools only when clearly non-authoritative.
They must not overwrite the canonical project estimate.

### Current behaviour (code map)

| Surface | Current location | Current money path |
| --- | --- | --- |
| Quick category | `src/routes/_authed/projects.$id.estimate.tsx` (quick tab) | `runPricingEngine` via `@/core/pricing` shim |
| AI room builder | `src/components/AIEstimateBuilder.tsx` | AI rates + `calculateLineItem` / `calculateEstimateTotals` (region mult + VAT; **no** full category engine) |
| Manual room builder | `src/components/EstimateBuilder.tsx` | Presentation `qty × unit_cost` + local 10% contingency + 20% VAT |
| Enhanced | `src/components/estimate/EnhancedEstimatePanel.tsx` | `runEnhancedEstimate` (`packages/services/src/enhanced-estimate/`) |
| New build | `src/components/estimate/NewBuildEstimatePanel.tsx` | `runNewBuildEstimate` (`packages/services/src/new-build/`) |
| AI normalizer | `src/core/ai/normalizers.ts` | Clamps / risk uplift; **not** product money authority |
| Category save | `saveProjectEstimate` in `estimate.repository.ts` | Persists `PricingEngineResult` |
| Room save | `saveAIEstimate` + `build*EstimateBuilderSaveInput` | Persists **client-supplied** totals |
| Canonical category use-case (exists, thin) | `createEstimate.ts` | `runPricingEngine` then repository |

---

## Canonical money authority

### Approved target

```text
Category estimates:
  runPricingEngine (@repo/services)

Room / measured BOQ estimates:
  a deterministic measured-BOQ engine under @repo/services (planned)

Presentation (routes, React components, hooks):
  never owns authoritative money
```

### Why room BOQ must not be lossily forced into categories

`runPricingEngine` prices a **selected set of refurbishment categories** with
regional, condition, finish, and size multipliers against category base rates.
It does **not** accept arbitrary room line items, measured quantities, or
user/AI unit rates.

Converting a measured BOQ into broad categories solely to reuse
`runPricingEngine` would:

- discard quantity and item-level evidence;
- silently change totals;
- destroy provenance needed for medium/high confidence later.

Therefore the approved target for room/BOQ is a **separate deterministic
measured-BOQ engine** in `@repo/services`, sharing contingency/VAT conventions
where product policy aligns, but **not** pretending BOQ lines are category
averages.

### Shared helpers (current)

`calculateLineItem` and `calculateEstimateTotals` live beside the pricing
engine and apply regional multipliers and VAT to pre-priced lines. Under this
contract they are **supporting helpers**, not a substitute for full
authority-priced category or measured-BOQ calculation, until the measured-BOQ
engine absorbs and owns that responsibility.

---

## Draft vs authority-priced states

### Approved target

```text
Draft:
  may contain AI-assisted, user-entered, or fallback rates
  may show provisional totals only when clearly labelled as draft
  not eligible to become the canonical project estimate

Authority-priced:
  all totals recomputed by the approved deterministic engine path
  eligible for canonical persistence and report consumption
```

### Current behaviour

- Quick path already produces engine totals and can save via
  `saveProjectEstimate`.
- AI and manual builders currently **persist client totals** via
  `saveAIEstimate` without a measured-BOQ engine reprice.
- That is **draft-as-canonical** behaviour and is **not** the approved target.

---

## AI contract

### Approved target

```text
AI may propose scope, quantities, and candidate rates.

AI may not produce authoritative totals or product confidence.

User acceptance alone does not make an AI-generated rate authoritative.
```

Rates remain `ai-assisted` (or worse) until replaced by library/engine rates or
an approved quote provenance and then **repriced** by the deterministic path.

### Current behaviour

- Server adapter (`ai-estimate.adapter.server.ts`) invents rooms and
  `base_unit_cost` values.
- Client may run `normalizeAIEstimate` (clamps/risk) then display and save
  totals.
- Photo apply (`mapPhotoAnalysesToEstimateRooms`) can inject fallback unit
  costs.

All of the above is **advisory / draft input**, not authority.

---

## Source and provenance vocabulary

Keep these **separate concepts**. Ticket 4B does **not** add runtime types.

### Estimate result source

```text
engine | ai-assisted | fallback | mock
```

The final **authority-priced** estimate result source is **`engine`**, even
when AI assisted with scope generation.

### Input provenance

```text
user | project | ai-assisted | assumed | fallback
```

Examples: finish chosen in UI → `user`; region from project row → `project`;
defaulted Dated/Standard on AI save → `assumed` (current gap).

### Rate provenance

```text
library | user-quote | ai-assisted | fallback
```

### Durable storage

Runtime provenance fields are **not** required for Ticket 4B or the initial
Ticket 4C money-path consolidation. Durable provenance columns may require a
**later Ticket 4D migration**, subject to separate approval. This contract does
**not** promise that migration.

---

## Confidence contract

### Product display confidence

```text
L1: low
L2: low | medium
L3 initially: low | medium
L3 high: blocked until evidence gates are implemented and approved
```

### Future high-confidence requirements (approved checklist; not authorised now)

High confidence at L3 requires **all** of:

* explicit condition and finish (user-provided, not silent defaults);
* valid project size and confidence-eligible region/postcode;
* project-bound **saved** authority-priced estimate;
* user-reviewed room measurements or quantities;
* no unresolved AI or fallback rates on priced lines;
* authoritative deterministic repricing of all displayed/saved totals;
* canonical contingency and VAT from the approved engine path;
* no unresolved engine/product warnings that force low confidence;
* durable provenance (when that storage is approved).

### Engine internal confidence

`runPricingEngine` currently computes an internal `confidence` field from
selected category count (including `high` when ≥3 categories). That value is
**engine metadata**, not product `displayConfidence`.

**Internal engine confidence must not be surfaced as product confidence**
without an explicit product policy resolution. Progressive L1/L2 already ignore
it in favour of policy-owned `displayConfidence`.

---

## Persistence contract

### Approved target

```text
Only authority-priced totals may become the canonical saved project estimate.

Non-authoritative Enhanced / New Build outputs must not overwrite it.

AI / manual drafts must not persist final totals before deterministic repricing.

The investor report must read an authority-eligible saved estimate.
```

### Current behaviour and risks

| Risk | Current fact |
| --- | --- |
| Latest estimate wins | `getLatestProjectEstimate` orders by `created_at` desc — any insert can become “the” estimate |
| AI save hard-codes inputs | `saveAIEstimate` stores `condition_level: "Dated"`, `finish_level: "Standard"`, zeros labour/materials/contingency |
| Client totals trusted | Room save mappers accept `subtotal` / `total` from the UI |
| Enhanced/New Build | No save path today (indicative only) — do not add canonical save without a separate decision |
| Report | Loads latest project estimate; may rebuild via report engine if absent |

Fixing “latest wins” mode labelling is **deferred** (not Ticket 4B/4C core).

### Tables (existing; no migration in 4B/4C)

```text
estimates
estimate_rooms
estimate_items
```

Writes go through `src/features/estimate/infrastructure/repositories/estimate.repository.ts`.

```text
No schema migration is required for Ticket 4B or the initial Ticket 4C
money-path consolidation.

Durable provenance may require a later Ticket 4D migration, subject to
separate approval.
```

---

## L1 / L2 promotion

### Approved target

```text
promotion is explicit (user-initiated)
promotion does not auto-save
promotion never increases confidence
project context re-runs the canonical engine (does not trust L1/L2 money blobs blindly)
defaults and assumptions remain visible
```

### Deferred

Promotion implementation is **deferred to Ticket 4D**. Ticket 4B and 4C must
not implement promote-from-instant UI or auto-seed that upgrades confidence.

### Current behaviour

There is **no** L1/L2 → L3 promotion path on `main`.

---

## Contingency and VAT (policy alignment)

| Path | Current | Target |
| --- | --- | --- |
| `runPricingEngine` | 10% contingency, 20% VAT on sub+cont | remains category authority |
| Manual builder | local 10% + 20% in presentation | must move out of presentation |
| AI builder totals | VAT on subtotal, **no** contingency | must not be canonical until measured-BOQ path owns policy |
| Enhanced / New Build | own fee/contingency models | remain indicative; not L3 canonical |

---

## Planned Ticket 4C boundary

Ticket 4C is **domain/application work only** (no UI redesign, no merge of this
contract phase into implementation without review).

### In scope for 4C

```text
- define the deterministic measured-BOQ calculation contract in @repo/services
- move authoritative contingency / VAT / total calculation out of presentation
- create a canonical repricing use-case before persistence
- prevent draft totals from becoming the canonical estimate
- preserve current L1/L2 behaviour unchanged
- add focused unit and architecture tests
```

### Explicitly excluded from 4C

```text
UI redesign
L1/L2 promotion
high confidence product surface
durable provenance migration
Enhanced / New Build consolidation into L3
pricing-table replacement
route restructuring beyond what application extraction requires
```

---

## Implementation sequence after this contract

```text
4B (this document): authority contract — complete when merged
4C: measured-BOQ engine + domain/application consolidation
4D: provenance, confidence policy wiring, promotion, optional schema
4E: presentation hygiene, formal smoke, merge of implementation PRs
```

Do not start 4C until this contract document is independently reviewed and the
implementation phase is authorised.

---

## Non-goals of Ticket 4B

```text
No production implementation
No domain TypeScript types for provenance
No migrations
No route or UI changes
No pricing-table changes
No L1/L2 behaviour changes
```

---

## Verification checklist (contract quality)

```text
[x] L3 definition is unambiguous (category + measured BOQ; not L1/L2 wrapper)
[x] Quick and measured BOQ authorities are distinct
[x] AI is advisory
[x] Presentation money is non-authoritative under target
[x] Enhanced / New Build are outside canonical L3
[x] High confidence remains blocked
[x] L1/L2 promotion remains deferred
[x] No migration is promised for 4B/4C
[x] Current behaviour and target contract are not conflated
```

```text
PASS — CONTRACT READY
```
