# Domain ownership audit — overlapping implementations

**Date:** 2026-07-23  
**Policy:** Classify every module; remove duplicates only after automated tests
prove the canonical path covers behaviour.  
**Related:** [FEATURE_SLICE.md](./FEATURE_SLICE.md) (request flow + freeze).

Classification key:

| Label | Meaning |
|-------|---------|
| **canonical implementation** | Source of truth for this behaviour |
| **public facade** | Stable import surface; re-exports or thin UI wrapper over canonical |
| **compatibility adapter** | Older API shape that delegates to canonical |
| **infrastructure adapter** | IO / ports implementation (storage, serverFn, engine port) |
| **deprecated implementation** | Marked or intended for removal; still may have callers |
| **duplicate logic** | Parallel rules that can diverge (must not grow) |

---

## 1. Estimate / pricing

| Path | Classification | Notes |
|------|----------------|-------|
| `packages/services/src/pricing/pricingEngine.ts` | **canonical implementation** | `runPricingEngine` — sole financial authority for category-based refurb mid/low/high |
| `packages/services/src/enhanced-estimate/*` | **canonical implementation** | Advisory **scope-based** £/m² estimator (complements pricing; not a second mid_total authority) |
| `packages/services/src/new-build/*` | **canonical implementation** | Advisory new-build engine (same package family) |
| `src/features/estimate/**` | **canonical implementation** | Product use cases: create/save estimates, AI estimate serverFn, repository — **does not re-implement pricing math** |
| `src/features/estimate/infrastructure/adapters/ai-estimate.adapter.server.ts` | **infrastructure adapter** | OpenAI → line items; pricing still via engine |
| `src/features/estimate/infrastructure/repositories/estimate.repository.ts` | **infrastructure adapter** | Persist `PricingEngineResult` |
| `src/core/pricing/pricingEngine.ts` | **public facade** | Re-exports `@repo/services` pricing |
| `src/core/pricing/pricingData.ts` | **public facade** / tables | Lookup tables; engine in package uses `@repo/core` pricing data — keep aligned |
| `src/core/pricing/index.ts` | **public facade** | Barrel: engine + legacy `calculateEstimate` |
| `src/lib/estimate.ts` | **compatibility adapter** | `calculateEstimate()` wraps `runPricingEngine` with older `EstimateInputs` / `EstimateResult` shape |

### Consumers (high level)

- UI estimate flows: `@/features/estimate` + `@/core/pricing` / `@repo/services`
- Enhanced / new-build panels: `@repo/services` directly
- Almost **no** direct imports of `@/lib/estimate` (only re-exported via `@/core/pricing`)

### Duplicate risk

| Risk | Status |
|------|--------|
| Second pricing engine in slice | **None** — slice orchestrates |
| `lib/estimate` vs `runPricingEngine` | **Compatibility only** — same engine underneath |
| Enhanced vs category pricing | **Intentional dual models** — document which is authoritative (category `mid_total` for ROI) |

### Removal readiness

| Candidate | Safe to delete now? | Gate |
|-----------|---------------------|------|
| `src/lib/estimate.ts` | **No** | Need route/component migration off `calculateEstimate` / types via `@/core/pricing`, then delete + invariant that no `calculateEstimate` remains outside package tests |
| Enhanced-estimate package | **No** — not a duplicate | Keep; ensure UI labels it advisory |

---

## 2. ROI

| Path | Classification | Notes |
|------|----------------|-------|
| `packages/services/src/roi/roiEngine.ts` | **canonical implementation** | `runRoiEngine` |
| `src/features/roi/domain/*` | **public facade** | Re-exports engine from `@repo/services` + slice domain types |
| `src/features/roi/application/*` | **canonical implementation** | Slice use cases (sensitivity, report) over ports |
| `src/features/roi/infrastructure/adapters/roi-engine.adapter.ts` | **infrastructure adapter** | Port → `runRoiEngine` |
| `src/core/roi/roiEngine.ts` | **public facade** | Re-exports `@repo/services` |
| `src/core/roi/index.ts` | **compatibility adapter** | Re-exports `@/features/roi` |

### Consumers

- Estimate route + reports: `@/features/roi` or dynamic `@repo/services`
- Deal Copilot: `@repo/services` directly (`src/lib/deal-copilot/dealAnalysis.ts`)

### Duplicate risk

**None for math** — single engine. Multiple facades only.

### Removal readiness

| Candidate | Safe to delete now? | Gate |
|-----------|---------------------|------|
| `src/core/roi/*` | **Not yet** | Grep callers → point at `@/features/roi` or `@repo/services` → delete shims |

---

## 3. Projects

> **There is no `src/features/projects/` slice.** Ownership is split across legacy layers.

| Path | Classification | Notes |
|------|----------------|-------|
| `src/lib/projects.ts` | **canonical implementation** (runtime types + browser store) | Supabase-backed cache store; types `Project`, `UKRegion`, etc. |
| `src/lib/queries/projects.ts` | **infrastructure adapter** | React Query options; also runs ROI via `@repo/services` for overview |
| `src/hooks/useProjects.ts` | **public facade** (presentation) | React Query list/get/create/stage; **create** → serverFn |
| `src/serverFns/projects.ts` | **infrastructure adapter** | Canonical **authenticated create** (cookie session) |
| `src/core/projects/projectHelpers.ts` | **canonical / helpers** | Progress, estimatedRefurbCost, etc. (pure-ish helpers over Project) |
| `src/core/projects/projectStore.ts` | **deprecated implementation** path | Older store pattern; still exported |
| `src/core/projects/mockProjects.ts` | **compatibility adapter** | Mocks |
| `src/core/projects/index.ts` | **public facade** | Re-exports helpers + types from `@/lib/projects` + photoStore |
| `src/services/projects/index.ts` | **public facade** | Thin re-export of `@/core/projects` — **zero app importers found** |

### Consumers

| Import surface | Approx. use |
|----------------|-------------|
| `@/hooks/useProjects` | Routes (dashboard, project pages, new project) — primary UI path |
| `@/lib/projects` | Types + store for serverFn types / mappers |
| `@/core/projects` | Helpers + types in components/routes (~11 files) |
| `@/services/projects` | **Unused** by application code |

### Duplicate risk

| Risk | Status |
|------|--------|
| Two project stores (`lib/projects` vs `core/projects/projectStore`) | **Yes** — overlapping ownership; live UI prefers hooks + lib queries |
| Types duplicated in `serverFns/projects` (UK_REGIONS lists) | **Pragmatic copy** for Zod (documented) — not full domain fork |
| No feature slice | **Gap** — competing homes until `features/projects` exists |

### Removal readiness

| Candidate | Safe to delete now? | Gate |
|-----------|---------------------|------|
| `src/services/projects` | **Almost** | Confirm zero imports (grep clean) + drop from freeze allowlist intentionally when deleting |
| `core/projects/projectStore` | **No** | Prove no callers; migrate to hooks/serverFns |
| Merge into `features/projects` | **Not started** | New slice + migrate hooks/serverFns/types to `@repo/types` |

---

## 4. Photos

> **There is no `src/features/photos/`.** Photo product surface is **`src/features/ai-upload`**.  
> **There is no `src/hooks/usePhotos.ts`** — hooks live under the slice.

| Path | Classification | Notes |
|------|----------------|-------|
| `src/lib/photos.ts` | **canonical implementation** | `photoStore` — storage + `photos` table |
| `src/features/ai-upload/presentation/hooks/usePhotos.ts` | **public facade** | React Query over `photoStore` |
| `src/features/ai-upload` (slice) | **canonical implementation** | Vision analysis domain/application/adapters |
| `src/features/ai-upload/infrastructure/repositories/photo-catalog.repository.ts` | **infrastructure adapter** | Uses `photoStore` |
| `src/services/storage/index.ts` | **public facade** | Re-exports `photoStore` |
| `src/lib/queries/projects.ts` (`photosQueryOptions`) | **infrastructure adapter** | Shared query key/options |
| `src/components/photos/*` | UI composition | Types from `@/lib/photos` |

### Duplicate risk

**Low for storage** — single `photoStore`. Hooks are not a second store.

### Removal readiness

| Candidate | Safe to delete now? | Gate |
|-----------|---------------------|------|
| Move `photoStore` into `ai-upload` infrastructure | Later | Large; keep facade until all type imports migrate |
| `services/storage` re-export | Optional | Only if unused |

---

## 5. Gallery

| Path | Classification | Notes |
|------|----------------|-------|
| `src/features/gallery/**` | **scaffolded / incomplete canonical** | Application stubs only; **not** wired as runtime path |
| `src/lib/gallery.ts` | **infrastructure adapter** | Cover image upload/delete (storage) |
| `src/lib/queries/gallery.ts` | **infrastructure adapter** | Public list / by project / leads queries |
| `src/hooks/useGallery.ts` | **public facade** | Owner upsert mutation |
| `src/components/gallery/*` | UI | Uses hooks + lib queries + lib/gallery |
| `src/routes/gallery*.tsx` | Routes | Use `lib/queries/gallery` |

### Duplicate risk

| Risk | Status |
|------|--------|
| Slice stubs vs live lib path | **Yes — dual ownership** until routes use `@/features/gallery` |
| Competing publish APIs | Live path is hooks + lib; stubs unused |

### Removal readiness

| Candidate | Safe to delete now? | Gate |
|-----------|---------------------|------|
| Delete `features/gallery` stubs | **No** — wrong direction | **Wire** slice to real ports, then delete lib facades |
| Delete lib gallery modules | **No** | Only after slice has tests + route migration |

---

## 6. Redesign

> **There is no `src/features/redesign/`.** Capability lives under **`src/features/ai-design`**.

| Path | Classification | Notes |
|------|----------------|-------|
| `src/lib/redesign.ts` | **canonical implementation** (catalog data) | `REDESIGN_CONCEPTS`, styles, mock gradients |
| `src/features/ai-design/**` | **canonical implementation** (product flow) | generate redesign serverFn, scope analysis, presentation provider |
| `src/features/ai-design/presentation/redesign.provider.ts` | **infrastructure / presentation adapter** | Uses catalog + serverFn; falls back to mock concepts |
| `src/features/ai-design/infrastructure/adapters/ai-redesign.adapter.server.ts` | **infrastructure adapter** | OpenAI redesign |
| `src/core/ai/index.ts` | **compatibility adapter** | Re-exports ai-design public API |

### Duplicate risk

**Catalog vs AI path** is layered (good), not forked.  
`reportEngine` still types `RedesignConcept` from `@/lib/redesign` while listing via `@/features/ai-design` — type import inconsistency only.

### Removal readiness

| Candidate | Safe to delete now? | Gate |
|-----------|---------------------|------|
| Move `REDESIGN_CONCEPTS` into `ai-design/domain` | Later | Single type home; update imports; keep behaviour tests |

---

## Summary matrix

| Domain | Canonical home | Facades / adapters | True duplicates? | Slice gap? |
|--------|----------------|--------------------|------------------|------------|
| Pricing math | `@repo/services` pricing | `core/pricing`, `lib/estimate` | No (compat only) | N/A (engine package) |
| Enhanced estimate | `@repo/services` enhanced-estimate | UI panels | Intentional second model | Optional feature shell |
| Estimate product | `features/estimate` | — | No | Done |
| ROI math | `@repo/services` roi | `features/roi`, `core/roi` | No | Done |
| Projects | `lib/projects` + hooks + serverFn | `core/projects`, unused `services/projects` | Store overlap risk | **Yes — no features/projects** |
| Photos storage | `lib/photos` | `ai-upload` hooks, `services/storage` | No | Owned by ai-upload |
| Gallery | **Live:** lib queries/hooks | **Scaffold:** features/gallery | **Yes until wired** | Scaffold only |
| Redesign | `ai-design` + `lib/redesign` catalog | `core/ai` re-export | No | Named under ai-design |

---

## Recommended next steps (incremental, test-gated)

Do **not** delete modules in this pass.

1. **Dead facade:** Confirm and remove `@/services/projects` if still zero importers (add test: `rg` / invariant forbids reintroduction without slice).
2. **Projects slice (greenfield):** Create `src/features/projects` and migrate `useProjects` + `createProjectServerFn` + types → public API; leave `lib/projects` as infra until green.
3. **Gallery:** Implement gallery ports against existing lib storage/queries; switch routes to `@/features/gallery`; then shrink lib.
4. **Pricing cleanup:** Migrate remaining `calculateEstimate` callers to `runPricingEngine`; delete `lib/estimate` when unused.
5. **ROI/core shims:** Point all callers at `@/features/roi` or `@repo/services`; drop `src/core/roi`.
6. **Types:** Prefer `@repo/types` for `Project` / region unions to stop re-exports from `lib/projects`.

### Test gates before any deletion

```bash
pnpm test:invariants
pnpm test:ui
# plus targeted: pricing.invariant, pricing-authority, estimator-engines, scoring
```

For each deleted file: zero import hits in `src/` and `packages/` (except allowlisted shims).

---

## Explicit non-actions (this audit)

- No production files removed.
- No behaviour changes.
- Classified only; freeze allowlists still protect against *new* parallel homes under `lib`/`hooks`/`services`.
