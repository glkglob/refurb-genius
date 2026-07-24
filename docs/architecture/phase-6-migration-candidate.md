# Phase 6 — Architecture Migration Candidate Selection (Revised)

**Status:** C1 **implemented** — commit/push not authorised until explicit gate
**Date:** 2026-07-24
**Governing sequence:** `verify → baseline → select one candidate → plan → approve → migrate incrementally`
**Policy:** [overview.md](./overview.md) · [ADR 0001](./adr/0001-adopt-rules-first-incremental-architecture-governance.md) · [Phase 0](./phase-0-inventory-report.md)

Every factual claim is tagged **VERIFIED**, **INFERRED**, or **UNRESOLVED**.

---

## Phase result

```text
PASS (planning)
PASS (C1 implementation — awaiting commit authorisation)
```

Exactly **one** candidate selected and implemented: **C1** trades feature extraction.

---

## Findings

### VERIFIED

- Single-app monorepo: `src/` + `packages/`; no `apps/*`.
- `src/features/trades` **does not exist** (feature list has no `trades`).
- Trades persistence lives only under `src/services/trades/` (3 files).
- **9** route import sites use `@/services/trades/*` (6 route files).
- Domain types/selectors already live under `src/core/trades/`.
- Tables used: `trades_jobs`, `trades_job_interests`, `trade_profiles` via browser Supabase client.
- Freeze allowlist includes exactly those three trades service files (+ projects/storage).
- Legacy-import baseline lists **9** edges `route|@/services/trades/...`.
- Data domain `marketplace-trades` registered in Phase 4 data registry.
- `pnpm test:invariants` → **162/162 pass** at planning time.
- `rg "@/features/trades/infrastructure" src/routes` → no matches (no routes import that path today).
- `rg "@/services/trades|src/services/trades" src` → only the services modules + route imports above.

### INFERRED

- Moving files with identical function bodies preserves runtime behaviour if imports update completely.
- After migration, `@/services/trades` baseline edges can be **removed** (not rewritten to `@/features/...`) because `@/features` is not in the forbidden prefix set for `no-legacy-imports`.

### UNRESOLVED

- No automated e2e coverage for trades marketplace flows in this inventory.
- Live remote Supabase policy drift vs migrations not re-probed (local registry only).
- Whether any external/unpublished importers of `@/services/trades` exist outside `src/` (none found under `src/`).

---

## Candidate inventory

| ID | Candidate | Disposition |
| -- | --------- | ----------- |
| C1 | Extract `src/services/trades/*` → **PROPOSED NEW PATH** `src/features/trades` | **Selected** |
| C2 | Seal estimate public API (reduce `@/features/estimate/infrastructure` deep imports) | Deferred |
| C3 | Remove browser Supabase from `DealChat` realtime | Deferred (realtime risk) |
| C4 | Migrate `src/lib/projects` → feature | Deferred (high fan-out) |
| C5 | Migrate `src/lib/photos` + storage | Deferred (high fan-out) |
| C6 | Collapse Deal Copilot multi-root | **Rejected** — multi-root / broad |
| C7 | Org multi-tenancy / RLS redesign | **Rejected** — schema/RLS |
| C8 | Multi-app `apps/*` | **Rejected** — restructure |
| C9 | Split `@repo/services` | **Rejected** — package boundary |

---

## Evidence cards

### C1 — Trades services → feature (SELECTED)

| Field | Value | Tag |
| ----- | ----- | --- |
| Current owner | Transitional `src/services` (marketplace) | VERIFIED |
| Target owner | Feature slice `trades` (marketplace product surface) | INFERRED from architecture policy |
| Current files | `src/services/trades/tradesJobStore.ts`, `tradesJobInterestStore.ts`, `tradeProfileStore.ts` | VERIFIED |
| Current imports | `@/platform/supabase/browser`, `@repo/supabase` types, `@/core/trades`, `@/lib/logger` (interest store) | VERIFIED |
| Call sites | 6 route files / 9 import lines (see §Current architecture) | VERIFIED |
| Persistence | Browser Supabase client + RLS | VERIFIED |
| Tables | `trades_jobs`, `trades_job_interests`, `trade_profiles` | VERIFIED |
| Buckets | None in these modules | VERIFIED |
| Tenant scope | mixed / party-scoped (posted jobs public; interests party) | VERIFIED (registry + policies) |
| Tests | No dedicated store unit tests found | VERIFIED (absence) |
| Freezes | 3 paths in `SERVICES` allowlist | VERIFIED |
| Baselines | 9 legacy-import edges | VERIFIED |
| Production criticality | Marketplace + dashboard trades widgets | INFERRED |
| Rollback | Single PR revert; no DB repair | INFERRED |
| Unresolved | e2e coverage | UNRESOLVED |

### C2 — Estimate infrastructure seal

| Field | Value | Tag |
| ----- | ----- | --- |
| Current | 8 consumers of `@/features/estimate/infrastructure` | VERIFIED |
| Public index | Intentionally does not re-export infrastructure | VERIFIED |
| public-api-boundary | Allows `…/infrastructure/index` | VERIFIED |
| Schema | none | VERIFIED |
| Risk | Low | INFERRED |
| Why not selected | Lower freeze debt reduction than C1 | INFERRED |

### C3 — DealChat Supabase removal

| Field | Value | Tag |
| ----- | ----- | --- |
| Current | `DealChat.tsx` realtime `supabase.channel` on `deal_messages` | VERIFIED |
| Risk | Realtime/auth regression | INFERRED |
| Schema | none if only client move | VERIFIED |
| Why not selected | Higher behavioural risk; incomplete isolation alone | INFERRED |

### C4 / C5 — lib/projects / lib/photos

| Field | Value | Tag |
| ----- | ----- | --- |
| Consumers | ~14 / ~12 import sites; large LOC | VERIFIED (counts) |
| Why not selected | Scope exceeds single narrow PR | INFERRED |

### C6–C9

Rejected for schema, multi-root, package-boundary, or speculative multi-app structure — **VERIFIED** against constraints.

---

## Candidate scoring

Weights (sum 100):

| Criterion | W |
| --------- | -: |
| Scope smallness | 20 |
| Evidence strength | 15 |
| Existing ownership seam | 15 |
| Measurable architecture gain (freeze/baseline) | 20 |
| Behaviour risk (inverse) | 15 |
| Rollback ease | 10 |
| Test/verification ease | 5 |

| ID | Scope | Evidence | Seam | Gain | Risk↓ | Rollback | Test | **Total** | Notes |
| -- | ----: | -------: | ---: | ---: | ----: | -------: | ---: | --------: | ----- |
| **C1** | 18 | 15 | 14 | 18 | 12 | 10 | 4 | **91** | 3 files, 9 sites, freeze shrink |
| C2 | 16 | 14 | 12 | 10 | 14 | 9 | 5 | **80** | Clean API; less freeze impact |
| C3 | 14 | 12 | 10 | 12 | 7 | 8 | 3 | **66** | Realtime risk |
| C4 | 6 | 12 | 10 | 16 | 5 | 6 | 2 | **57** | Large fan-out |
| C5 | 6 | 12 | 10 | 15 | 5 | 6 | 2 | **56** | Large fan-out |

Weak evidence is not hidden: C1 test coverage is weak (score 4/5 on test ease).

---

## Selected candidate

**C1 — Trades marketplace persistence extraction into a feature slice.**

### Selection rationale

1. Smallest durable architecture win that **shrinks a frozen transitional layer**.
2. Complete call-site inventory (all under `src/routes`).
3. Domain types already separated (`@/core/trades`).
4. No schema/RLS/package changes.
5. Public API can re-export existing function names 1:1.
6. Rollback is a pure git revert.

---

## Migration statement

```text
Move verified trades marketplace persistence (jobs, interests, trade profiles)
from EXISTING path src/services/trades/* to PROPOSED NEW PATH src/features/trades
(public API + infrastructure repositories), preserving behaviour and public function
interfaces, without changing schema, RLS, package boundaries or runtime contracts.
```

`src/features/trades` is a **PROPOSED NEW PATH** — it does **not** exist today. **VERIFIED.**

---

## Current architecture

### Ownership

| Layer | Owner | Tag |
| ----- | ----- | --- |
| Route UI | App shell / marketplace UX | VERIFIED |
| Persistence modules | Transitional `src/services` | VERIFIED |
| Domain types | `src/core/trades` | VERIFIED |
| DB/RLS | Shared platform + marketplace tables | VERIFIED (registry) |

### Public API (current)

There is **no** feature public API. Routes import store modules **directly**:

```text
@/services/trades/tradesJobStore
@/services/trades/tradesJobInterestStore
@/services/trades/tradeProfileStore
```

**VERIFIED.**

### Dependency diagram (current)

```text
src/routes/trades.tsx
src/routes/trades_.$jobId.tsx
src/routes/_authed/trades_.*
src/routes/_authed/dashboard.tsx
        │
        │  @/services/trades/*
        ▼
src/services/trades/{tradesJobStore,tradesJobInterestStore,tradeProfileStore}
        │
        ├── @/platform/supabase/browser
        ├── @repo/supabase (types)
        ├── @/core/trades (types)
        └── @/lib/logger (interest store only)
        │
        ▼
Supabase Postgres (trades_jobs, trades_job_interests, trade_profiles) + RLS
```

### Call sites (complete) — VERIFIED

| File | Imports from services |
| ---- | --------------------- |
| `src/routes/trades.tsx` | `listPostedTradesJobs` |
| `src/routes/trades_.$jobId.tsx` | `getTradesJobById`; `createTradesJobInterest`, `getCurrentUserInterestForJob`, `listJobInterests`, `updateTradesJobInterestStatus`; `getTradeProfileByUserId` |
| `src/routes/_authed/trades_.new.tsx` | `createTradesJob` |
| `src/routes/_authed/trades_.$jobId_.edit.tsx` | `getTradesJobById`, `updateTradesJob` |
| `src/routes/_authed/trades_.profile.tsx` | `getCurrentUserTradeProfile`, `upsertCurrentUserTradeProfile` |
| `src/routes/_authed/dashboard.tsx` | `listCurrentUserTradesJobs`, `updateTradesJob`; `listCurrentUserInterestsWithJobs`, type `TradesJobInterestWithJob` |

### Exports present but unused by routes — VERIFIED

- `listTradesJobs`, `deleteTradesJob` (job store) — only defined in store file
- `listCurrentUserInterests` (interest store) — defined; routes use `listCurrentUserInterestsWithJobs` instead

Must still be moved/re-exported to avoid accidental API shrink if something external relies on them (none found under `src/`).

### Persistence / auth / enforcement

| Topic | Current | Tag |
| ----- | ------- | --- |
| Auth | `supabase.auth.getUser()` inside stores | VERIFIED |
| Tenant | RLS on tables; posted jobs list uses status filter | VERIFIED / INFERRED policy detail |
| Freezes | 3 service files allowlisted | VERIFIED |
| Baselines | 9 route→services edges | VERIFIED |
| Debt | Routes depend on transitional services, not features | VERIFIED |

---

## Target architecture

### Ownership

| Layer | Target |
| ----- | ------ |
| Routes | Import **only** `@/features/trades` public API |
| Feature public API | Re-export store functions/types used by routes |
| Feature infrastructure | Moved repository modules (same logic) |
| Domain types | Remain `@/core/trades` (or re-export selectively from feature if desired — optional) |

### Dependency diagram (target)

```text
src/routes/*trades* + dashboard
        │
        │  @/features/trades   (public API only)
        ▼
src/features/trades/index.ts     [PROPOSED NEW PATH]
        │
        ▼
src/features/trades/infrastructure/repositories/*   [PROPOSED NEW PATH — moved files]
        │
        ├── @/platform/supabase/browser
        ├── @repo/supabase
        ├── @/core/trades
        └── @/lib/logger
        │
        ▼
Supabase Postgres + RLS (unchanged)
```

**Routes must never import** `@/features/trades/infrastructure` or deep repository paths.
**VERIFIED today:** zero such imports (path does not exist yet). **Post-migration verification required.**

### Registry / freeze updates (implementation phase)

| Artefact | Change |
| -------- | ------ |
| `frozen-path-allowlists.ts` | Remove 3 trades service paths |
| `legacy-import-baseline.ts` | Remove 9 `@/services/trades` edges |
| Data registry lineage | Optional path refresh for trades evidence |
| `src/services/trades` | Delete after move |

---

## File-level plan

| Action | Path | Status |
| ------ | ---- | ------ |
| Create | `src/features/trades/index.ts` | **PROPOSED NEW PATH** |
| Create | `src/features/trades/infrastructure/index.ts` | **PROPOSED NEW PATH** (optional barrel; not imported by routes) |
| Move | `src/services/trades/tradesJobStore.ts` → `src/features/trades/infrastructure/repositories/tradesJobStore.ts` | EXISTING → PROPOSED |
| Move | `src/services/trades/tradesJobInterestStore.ts` → `…/tradesJobInterestStore.ts` | EXISTING → PROPOSED |
| Move | `src/services/trades/tradeProfileStore.ts` → `…/tradeProfileStore.ts` | EXISTING → PROPOSED |
| Modify | `src/routes/trades.tsx` | EXISTING — import path only |
| Modify | `src/routes/trades_.$jobId.tsx` | EXISTING — import path only |
| Modify | `src/routes/_authed/trades_.new.tsx` | EXISTING — import path only |
| Modify | `src/routes/_authed/trades_.$jobId_.edit.tsx` | EXISTING — import path only |
| Modify | `src/routes/_authed/trades_.profile.tsx` | EXISTING — import path only |
| Modify | `src/routes/_authed/dashboard.tsx` | EXISTING — import path only |
| Modify | `tests/invariants/config/frozen-path-allowlists.ts` | EXISTING |
| Modify | `tests/invariants/config/legacy-import-baseline.ts` | EXISTING |
| Delete | `src/services/trades/*` (after move) | EXISTING |
| Unchanged | `src/core/trades/**` | EXISTING — validated |
| Unchanged | `src/services/projects`, `src/services/storage` | EXISTING — out of scope |
| Unchanged | Schema, RLS, packages, CI | EXISTING |

**Public API surface to export from `src/features/trades/index.ts` (minimum used + unused store exports for parity):**

```text
listCurrentUserTradesJobs, getTradesJobById, listTradesJobs, listPostedTradesJobs,
createTradesJob, updateTradesJob, deleteTradesJob,
createTradesJobInterest, listCurrentUserInterests, listCurrentUserInterestsWithJobs,
listJobInterests, updateTradesJobInterestStatus, getCurrentUserInterestForJob,
TradesJobInterestWithJob,
getCurrentUserTradeProfile, getTradeProfileByUserId, upsertCurrentUserTradeProfile
```

---

## Behaviour preservation

| Behaviour | Preserve how | Verify how |
| --------- | ------------ | ---------- |
| Function names | Re-export same names from public API | typecheck + rg imports |
| Signatures / return types | Move body unchanged | typecheck |
| Errors / message prefixes | No string edits in move PR | diff review |
| SQL / filters / order | No query edits | diff review of moved files |
| Auth (`getUser`) | Unchanged calls | code review |
| Tenant filtering | Unchanged RLS + query filters | manual smoke + no SQL change |
| Storage | N/A (no buckets in these modules) | — |
| Logging | Keep logger usage in interest store | diff |
| UI | Routes change imports only | manual smoke |

---

## Dependency plan

### Removed edges

```text
routes → @/services/trades/tradesJobStore
routes → @/services/trades/tradesJobInterestStore
routes → @/services/trades/tradeProfileStore
```

### Added edges

```text
routes → @/features/trades   (public API only)
features/trades/infrastructure → platform/supabase, core/trades, lib/logger
```

### Unchanged edges

```text
routes → @/core/trades (+ selectors)
packages → src   (still none)
```

### Post-migration verification commands

```bash
rg "@/services/trades|src/services/trades" src
# expect: no matches (or only historical comments if any)

rg "@/features/trades/infrastructure" src/routes
# expect: no matches

rg "from [\"']@/features/trades[\"']" src/routes
# expect: updated route imports only
```

---

## Data / security

| Item | Value |
| ---- | ----- |
| Schema changes | **none** |
| Migration changes | **none** |
| RLS changes | **none** |
| Secrets | **none** |
| Tenant model changes | **none** |

If any implementation PR introduces a non-none value here, **reject that PR** against this plan.

---

## Test plan

| Type | Action |
| ---- | ------ |
| Focused | typecheck after import rewrites |
| Regression | Manual: list posted jobs, open job, express interest, owner update interest status, create job, edit job, trade profile upsert, dashboard trades widgets |
| Negative | Unauthenticated access still blocked by existing routes/RLS (no new cases required if unchanged) |
| Invariants | `pnpm test:invariants` (freezes, no-legacy-imports, public-api, data registry) |
| Tenant | Spot-check posted jobs visible publicly; own jobs only in dashboard list (existing behaviour) |
| Full | `pnpm lint` · `pnpm typecheck` · `pnpm test:ui` · `pnpm build` |

Optional (nice-to-have, not required for move-only): unit test pure `rowToJob` mappers if extracted without behaviour change.

---

## Rollback

1. `git revert` the implementation commit/PR.
2. Restores files under `src/services/trades`, route imports, freezes, baselines.
3. Validate:

```bash
pnpm lint
pnpm typecheck
pnpm test:invariants
pnpm build
```

4. **No database repair** — no data migrations.

---

## Success metrics

| Metric | Target |
| ------ | ------ |
| `rg "@/services/trades\|src/services/trades" src` | **0** matches |
| `rg "@/features/trades/infrastructure" src/routes` | **0** matches |
| Freeze entries for trades services | **0** (removed) |
| Legacy baseline edges for `@/services/trades` | **0** (removed) |
| Route imports of feature public API | all former services call sites |
| Runtime trades behaviour | unchanged (smoke) |
| `pnpm test:invariants` | pass |
| Schema/RLS diff | empty |

---

## Validation (this planning phase)

| Check | Result |
| ----- | ------ |
| Path verification (`src/services/trades`, no `src/features/trades`) | **VERIFIED** |
| `rg "@/services/trades\|src/services/trades" src` | **9 route lines + 3 store files** |
| `rg "@/features/trades/infrastructure" src/routes` | **0** |
| Ownership / freeze / baseline / data domain | **VERIFIED** |
| `pnpm test:invariants` | **162/162 PASS** |
| `git status --short` | `M overview.md`, `?? phase-6-migration-candidate.md` (plan docs only) |
| `git diff --name-only` | plan docs only (no `src/`, packages, supabase, CI) |
| lint/typecheck/build for planning | **Not required** (no executable TS changes) |

---

## Deviations

- Spec file `docs/architecture/phase-6-specification.md` **does not exist**; this document follows the revised prompt as governing requirements.
- Optional temporary re-export shim under `src/services/trades` is **not** recommended if all 6 route files update in one PR; only use if a multi-PR rollout is forced.
- Domain types stay in `src/core/trades` rather than moving into the feature (smaller scope; existing seam).

---

## Git state

```text
Branch: main (aligned with origin/main for code)
Dirty (planning only):
  M  docs/architecture/overview.md
  ?? docs/architecture/phase-6-migration-candidate.md
```

No commit, no push (per constraints).

---

## Implementation gate

Implementation authorised and completed under:

```text
AUTHORISE IMPLEMENTATION OF PHASE 6 CANDIDATE C1 (trades feature extraction)
```

Commit/push remain gated until:

```text
AUTHORISE COMMIT OF PHASE 6 CANDIDATE C1
```

---

```text
READY FOR EXPLICIT COMMIT AUTHORISATION
```
