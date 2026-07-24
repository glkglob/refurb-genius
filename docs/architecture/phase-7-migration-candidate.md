# Phase 7 — Architecture Migration Candidate Selection

**Status:** C6 **implemented** — commit/push not authorised until explicit gate
**Date:** 2026-07-24
**Prior:** Phase 6 C1 (trades → `@/features/trades`) **CLOSED** on commit `9d7a8d5`
**Governing sequence:** `verify → baseline → select one candidate → plan → approve → migrate incrementally`
**Policy:** [overview.md](./overview.md) · [ADR 0001](./adr/0001-adopt-rules-first-incremental-architecture-governance.md) · [Phase 6](./phase-6-migration-candidate.md)

Every factual claim is tagged **VERIFIED**, **INFERRED**, or **UNRESOLVED**.

---

## Phase result

```text
PASS (planning)
PASS (C6 implementation — awaiting independent verification and commit authorisation)
```

Exactly **one** candidate selected after re-scoring against **post-C1** repository evidence.
**Candidate C2 is superseded** by C6 (see selection rationale).

---

## Repository verification

| Check | Result | Tag |
| ----- | ------ | --- |
| Branch / HEAD | `main` @ `9d7a8d5` = `origin/main` | VERIFIED |
| Working tree | clean | VERIFIED |
| `src/features/trades` exists (public API + infrastructure repositories) | yes | VERIFIED |
| `src/services/trades` | absent | VERIFIED |
| `rg "@/services/trades\|src/services/trades" src` | **0** | VERIFIED |
| `rg "@/features/trades/infrastructure" src/routes` | **0** | VERIFIED |
| Overview trades ownership | `@/features/trades` (Phase 6 C1) | VERIFIED |
| `pnpm test:invariants` | **162/162 pass** | VERIFIED |
| Schema / packages / CI dirty | no | VERIFIED |

**Drift:** none material. Phase 6C/D close-out remains valid. Proceed.

---

## Candidate inventory

| ID | Candidate | Disposition |
| -- | --------- | ----------- |
| C1 | Trades services → feature | **Complete** (historical) |
| C2 | Seal estimate public API (reduce `@/features/estimate/infrastructure` deep imports) | Deferred runner-up |
| C3 | DealChat realtime Supabase extraction | Deferred |
| C4 | Migrate `src/lib/projects` (+ hooks fan-out) to feature | Deferred |
| C5 | Migrate `src/lib/photos` / storage ownership | Deferred |
| **C6** | **Retire unused `src/services` facades (projects + storage)** | **Selected** |
| C7 | Org multi-tenancy / RLS redesign | Rejected — schema/RLS |
| C8 | Multi-app `apps/*` | Rejected — restructure |
| C9 | Split `@repo/services` | Rejected — package boundary |

---

## Evidence summary

### C6 — Retire unused `src/services` facades (SELECTED)

| Field | Value | Tag |
| ----- | ----- | --- |
| Current owner | Transitional `src/services` | VERIFIED |
| Current files | `src/services/projects/index.ts`, `src/services/storage/index.ts` (+ README) | VERIFIED |
| App importers of `@/services/projects` or `@/services/storage` | **0** under `src/` | VERIFIED |
| What projects facade does | Re-export of `@/core/projects` | VERIFIED |
| What storage facade does | Re-export of `@/lib/photos` + thin `getPublicPhotoUrl` / `canUseStorage` | VERIFIED |
| Freeze entries | 2 remaining in `SERVICES_ALLOWLIST` | VERIFIED |
| Baseline edges `@/services/*` | **0** (no route/hook/component imports) | VERIFIED |
| Production criticality of facades | None if zero importers | INFERRED |
| Rollback | Restore two files + freeze rows | INFERRED |

**Architectural meaning:** After C1, `src/services` only holds **dead facades**. Removing them completes the transitional **services layer** retirement and leaves freezes focused on `lib` / `hooks` only.

### C2 — Estimate public API seal

| Field | Value | Tag |
| ----- | ----- | --- |
| Deep imports of `@/features/estimate/infrastructure` | **8** production files (+ README example) | VERIFIED |
| Consumers | 2 routes, `EstimateBuilder`, pitch/floorplan/photo components, `lib/queries/projects`, `lib/pitchDeck` | VERIFIED |
| Public `src/features/estimate/index.ts` | Exports domain + application + presentation **only** — intentionally not infrastructure | VERIFIED |
| Symbols needed | `saveProjectEstimate`, `getLatestProjectEstimate`, `persistedEstimateInput`, `saveAIEstimate`, `getLatestRoomEstimate`, `Persisted*` types | VERIFIED |
| Freeze / baseline impact | **0** (infra path is allowed by public-api-boundary; not a legacy baseline edge) | VERIFIED |
| Policy tension | `src/features/README.md` currently documents infrastructure as an allowed cross-slice import | VERIFIED |

### C3 — DealChat realtime

| Field | Value | Tag |
| ----- | ----- | --- |
| Surface | `DealChat.tsx` uses `supabase.channel` on `deal_messages` | VERIFIED |
| Persistence CRUD | Already via `serverFns/dealChat` | VERIFIED |
| Related debt | `opportunityStore.ts` also uses browser Supabase | VERIFIED |
| Risk | Realtime subscribe/unsubscribe, auth, invalidation races | INFERRED |

### C4 — Projects (`lib/projects`)

| Field | Value | Tag |
| ----- | ----- | --- |
| LOC | ~319 (`src/lib/projects.ts`) | VERIFIED |
| Import sites | hooks, serverFns, core facades, deal intake, estimate infra type, ≥11 files for `@/lib/projects` | VERIFIED |
| Baseline edges | ≥4 involving `lib/projects` | VERIFIED |
| Freeze | File remains on `LIB_ALLOWLIST` | VERIFIED |

### C5 — Photos / storage (`lib/photos`)

| Field | Value | Tag |
| ----- | ----- | --- |
| LOC | ~319 (`src/lib/photos.ts`) | VERIFIED |
| Consumers | ai-upload feature repos, components, core re-exports, services/storage | VERIFIED |
| Baseline edges | ≥3 involving `lib/photos` | VERIFIED |

---

## Weighted scoring

Weights (sum 100) — Phase 7 scheme:

| Criterion | Weight | Scoring notes |
| --------- | -----: | ------------- |
| Architectural value | 30 | Ownership clarity, boundary improvement, platform direction |
| Governance improvement | 20 | Freeze / baseline / registry shrinkage (measurable) |
| Risk (inverse) | 20 | Higher score = lower runtime/regression risk |
| Implementation cost (inverse) | 15 | Higher score = fewer files / simpler change |
| Validation complexity (inverse) | 10 | Higher score = easier to prove green |
| Rollback simplicity | 5 | Higher score = pure git revert |

| ID | Arch | Gov | Risk↓ | Cost↓ | Valid↓ | Roll | **Total** | Notes |
| -- | ---: | --: | ----: | ----: | -----: | ---: | --------: | ----- |
| **C6** | 18 | **20** | **19** | **15** | **10** | **5** | **87** | Zero importers; finish services layer |
| C2 | 24 | 10 | 18 | 12 | 9 | 5 | **78** | Strong boundary win; **no** freeze/baseline delta |
| C4 | 27 | 17 | 7 | 5 | 4 | 3 | **63** | High value, high fan-out |
| C5 | 25 | 16 | 7 | 5 | 4 | 3 | **60** | Coupled to ai-upload already partial |
| C3 | 16 | 8 | 8 | 11 | 6 | 4 | **53** | Realtime risk; incomplete alone |

**Weak evidence not hidden:**

- C6 architectural value is **narrow** (deletes unused facades; does not move live product logic). Score 18/30 reflects that honesty while still rewarding completion of a transitional layer.
- C2 scores higher on pure “feature boundary purity” but **cannot** shrink freezes/baselines under current rules — the same reason Phase 6 ranked it below freeze-shrinking work.

---

## Selected candidate

**C6 — Retire unused transitional `src/services` facades (`projects` + `storage`).**

### Selection rationale

1. **Post-C1 reality:** Trades no longer occupy `src/services`. Remaining modules are **facades with zero `src/` importers** (**VERIFIED**).
2. **Highest governance ROI:** Removes the last two `SERVICES_ALLOWLIST` freeze entries and can retire the services transitional layer narrative.
3. **Lowest behavioural risk:** No production call sites; pure deletion + docs/registry prose.
4. **Smallest implementation cost:** Two TypeScript modules + README/freeze/registry text.
5. **C2 remains valuable** but is **not** the top next step: sealing estimate public API improves feature hygiene without reducing structured freezes/baselines and collides with current “infrastructure import allowed” documentation.

```text
Candidate C2 is superseded by C6 (retire unused src/services facades).
```

---

## Migration statement

```text
Delete verified unused transitional facades at EXISTING paths
src/services/projects/* and src/services/storage/* (and empty services tree if empty),
update freezes and architecture prose to record that src/services no longer hosts
product facades, preserving all runtime behaviour (no live importers) without
changing schema, RLS, package boundaries, or feature public APIs.
```

---

## Current architecture (C6)

### Ownership

| Layer | Owner | Tag |
| ----- | ----- | --- |
| Project domain store | `src/lib/projects` + `src/core/projects` re-exports + hooks/serverFns | VERIFIED |
| Photo storage | `src/lib/photos` (+ feature ai-upload infrastructure) | VERIFIED |
| Dead facades | `src/services/projects`, `src/services/storage` | VERIFIED (unused) |
| Freezes | 2 services files allowlisted | VERIFIED |

### Dependency diagram (current)

```text
(app routes / hooks / features)
        │
        │  @/lib/projects , @/lib/photos , @/core/projects , hooks
        ▼
live product code

src/services/projects  ──re-export──► @/core/projects     [NO IMPORTERS]
src/services/storage   ──re-export──► @/lib/photos        [NO IMPORTERS]
```

---

## Target architecture (C6)

### Ownership

| Layer | Target |
| ----- | ------ |
| Projects | Unchanged live paths (`lib` / `core` / hooks / serverFns) |
| Photos | Unchanged live paths (`lib/photos` / ai-upload) |
| `src/services` | **Removed** (or empty directory with README pointing to features/lib only) |

### Dependency diagram (target)

```text
(app routes / hooks / features)
        │
        │  @/lib/* , @/core/* , @/features/* , @/hooks/*
        ▼
live product code

src/services   ── deleted / gone ──
(no facade hop)
```

**Routes must not gain any new `@/services/*` imports** (already true).

---

## File-level plan

| Action | Path | Status |
| ------ | ---- | ------ |
| Delete | `src/services/projects/index.ts` | EXISTING |
| Delete | `src/services/storage/index.ts` | EXISTING |
| Delete or rewrite | `src/services/README.md` | EXISTING — mark layer retired / point to features |
| Modify | `tests/invariants/config/frozen-path-allowlists.ts` | Remove both SERVICES entries (empty allowlist OK) |
| Modify | `tests/invariants/config/exceptions.ts` | Prose: services freeze retired or empty |
| Modify | `tests/invariants/config/transitional-layers.ts` | Register services as removed / historical |
| Modify | `tests/invariants/config/architecture-areas.ts` | Paths/purpose for transitional-services |
| Modify | `tests/invariants/config/data/persistence.ts` | Drop `src/services` from browser-client paths if empty |
| Modify | `docs/architecture/overview.md` | Path inventory: services gone / retired |
| Unchanged | All feature/store/SQL/RLS/packages/CI | EXISTING |
| Unchanged | `src/lib/projects`, `src/lib/photos` | EXISTING — **not** migrated in C6 |

**No new production TypeScript modules required.**

---

## Behaviour preservation

| Behaviour | Preserve how | Verify how |
| --------- | ------------ | ---------- |
| Runtime projects/photos | No importers of deleted facades | `rg @/services` = 0 before/after |
| SQL / Supabase | Unchanged (not touched) | no schema diff |
| Auth / RLS | Unchanged | no RLS diff |
| Public feature APIs | Unchanged | typecheck |
| Errors / logging | Unchanged | N/A (no code path change) |

Only ownership **of dead facades** and **governance metadata** change.

---

## Dependency plan

### Removed edges

```text
(none live — facades had zero importers)
logical: package graph no longer contains src/services/* modules
```

### Added edges

```text
none
```

### Unchanged edges

```text
routes/hooks → @/lib/projects , @/lib/photos , @/hooks/useProjects , features
```

### Post-migration verification

```bash
rg "from [\"']@/services/" src
# expect: 0

test ! -e src/services/projects/index.ts
test ! -e src/services/storage/index.ts

pnpm test:invariants
```

---

## Data / security

| Item | Value |
| ---- | ----- |
| Schema changes | **none** |
| Migration changes | **none** |
| RLS changes | **none** |
| Secrets | **none** |
| Tenant model | **none** |

---

## Test plan (implementation phase)

| Type | Action |
| ---- | ------ |
| Focused | Confirm zero `@/services` imports; freeze allowlist matches disk |
| Regression | Smoke: create project, list projects, upload photo path (via existing lib/hooks — not services) |
| Invariants | `pnpm test:invariants` |
| Full | `pnpm lint` · `pnpm typecheck` · `pnpm build` |

---

## Rollback

1. `git revert` implementation commit.
2. Restores `src/services/projects`, `src/services/storage`, freeze rows, docs.
3. Validate:

```bash
pnpm lint
pnpm typecheck
pnpm test:invariants
pnpm build
```

4. **No database repair.**

---

## Success metrics

| Metric | Target |
| ------ | ------ |
| `@/services/*` imports in `src/` | **0** (already 0; must remain) |
| Files under `src/services/**/*.ts` | **0** |
| `SERVICES_ALLOWLIST` length | **0** |
| Freeze unexpected files | none |
| `pnpm test:invariants` | pass |
| Schema/RLS/package/CI diff | empty |
| Runtime behaviour | unchanged |

---

## Implementation outline (gate)

Implementation authorised and completed under:

```text
AUTHORISE IMPLEMENTATION OF PHASE 7 CANDIDATE C6
```

Commit/push remain gated until explicit commit authorisation.

**Implementation note:** `src/services/README.md` retained (retired-layer notice) so architecture-registry path `src/services` still exists; no production TypeScript remains under the directory.

---

## Deferred candidates (ordered after C6)

1. **C2 — Estimate public API seal**
   Re-export repository helpers/types from `@/features/estimate`; rewrite 8 consumers off `/infrastructure`; optionally tighten public-api policy for **routes** later.
2. **C4 / C5** — projects / photos feature ownership (large).
3. **C3** — DealChat realtime isolation (higher risk).

---

## Deviations / notes

- Phase 6 ranked **C2** second; post-C1 evidence elevates **dead services cleanup** above C2 because freeze completion is now a single PR with **zero** call-site migration.
- C6 does **not** migrate projects/photos off `lib` — that remains C4/C5.
- Supabase Preview CI flake (Phase 6D) is out of scope.

---

## Git state (planning phase)

```text
Branch: main @ 9d7a8d5 = origin/main
Dirty (planning only):
  ?? docs/architecture/phase-7-migration-candidate.md
```

No commit, no push.

---

```text
READY FOR EXPLICIT IMPLEMENTATION AUTHORISATION
```
