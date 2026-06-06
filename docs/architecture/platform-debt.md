# Platform Debt: Known Trade-Offs

This document tracks deliberate trade-offs and technical debt introduced during monorepo extraction (Phases 1-4). Each item records the why, impact, and resolution path.

## Current Debt Items

### 1. pricingData Duplication (Phase 4)

**Status**: Acceptable, targeted for Phase 5

**What:** Two identical copies of `pricingData.ts` exist:

- `packages/core/src/utilities/pricingData.ts` (source of truth)
- `packages/services/src/pricing/pricingData.ts` (duplicate copy)

**Why accepted:**

- During Phase 4, `pricingEngine.ts` was extracted to `@repo/services`
- `pricingEngine.ts` depends on `pricingData.ts` (lookup tables)
- Initial attempt: Have `@repo/services` import from `@repo/core`
- Build failure: Vite rollup couldn't resolve `@repo/core` path alias during bundling
- Solution chosen: Created local copy to unblock extraction
- Trade-off was acceptable because: Phase 4 completion > perfect deduplication

**Impact:**

- Maintenance risk: If pricingData needs updates, both copies must be synchronized
- Low frequency: pricingData is stable (pricing tier definitions rarely change)
- Caught quickly: Any divergence would cause test failures or incorrect pricing

**Resolution path (Phase 5 — Option A):**

1. Investigate Vite path alias resolution in Nitro SSR context
2. Remove duplicate from `@repo/services`
3. Update `@repo/services/src/pricing/pricingEngine.ts` to import from `@repo/core`
4. Verify build succeeds
5. Run full test suite
6. Deploy to staging for smoke test

**Prevention for future:**

- Always attempt cross-package imports first
- Only duplicate if Vite build explicitly fails on path resolution
- Document duplication with issue tracking and cleanup deadline

**Test coverage:**

- Unit tests for `pricingEngine` catch divergence immediately
- Integration tests verify pricing calculations against expected costs

---

### 2. @repo/types Importing from @/lib (Current)

**Status**: Acceptable, blocks npm publish but not a current requirement

**What:** `packages/types/src/index.ts` and related files import types from root `@/lib`:

```typescript
import type { Project } from "@/lib/projects";
import type { UKRegion } from "@/lib/projects";
```

**Why exists:**

- Extracted types need to reference root domain concepts (Project, UKRegion, etc.)
- Root app maintains canonical definitions for backward compatibility
- Moving these types to `@repo/types` would require rewriting all root code
- Scope creep: Not worth refactoring entire root app just for npm publishability

**Impact:**

- @repo/types is not independently npm-publishable (has external dependencies)
- Not a blocker: This is an internal monorepo, npm publishing not planned
- Type safety: Still provides full type checking, just not at npm registry

**Resolution path (Phase 5 — Option B, optional):**

1. Extract root `@/lib` type definitions to `@repo/types` or separate package
2. Rewrite root app to import types from `@repo/types`
3. Update all packages to import from bottom layer
4. Make @repo/types have zero external dependencies
5. Document as "types layer truly independent" milestone
6. Effort: 2-3 days (significant refactoring)

**Prevention for future:**

- When adding new types, prefer placing in `@repo/types` first
- Only add to root `@/lib` if truly app-specific (not domain concepts)
- Review during code review: should this type be in @repo/types instead?

**Acceptable pragmatism:**

- Many SSR monorepos have this exact pattern
- Root types provide stability for evolution
- Not a blocker for scaling to Deal Copilot, Refurb IQ (they'll use @repo/types as is)

---

### 3. @repo/ui Partial Migration (Active Work — Not Debt)

**Status**: Migration in progress. 17/46 components moved; 29 remaining.

**Current state:**

- Migrated components (17): fully in `packages/ui/src/components/` — `@repo/ui` is the source of truth
- Remaining components (29): still in `src/components/ui/` as shim files that re-export from `@repo/ui`
- All components accessible via `import { X } from "@repo/ui"` regardless of migration state

**Why partial:**

- Migration is done component-by-component to avoid bulk-move circular-reference risk
- Each component gets moved, tested, and the shim replaced with a re-export

**Next targets (priority order):** sidebar, sheet, dropdown-menu, command

**Resolution path:**

1. Move component to `packages/ui/src/components/<name>.tsx`
2. Export from `packages/ui/src/index.ts`
3. Replace `src/components/ui/<name>.tsx` shim with bare re-export
4. Run typecheck + lint

**This is tracked work, not design debt.** See CLAUDE.md "UI System Rules" for the full migration protocol.

---

### 4. Packages Share Root Build Output (Current)

**Status**: Acceptable, appropriate for SSR monorepo

**What:** All packages build together to single `.vercel/output/` directory:

- No per-package `dist/` folders
- No per-package build artifacts
- Single bundled output for Vercel deployment

**Why this is correct:**

- This is an SSR application, not a library monorepo
- Shared build process is more efficient than per-package isolation
- Packages are not independently deployable
- No need for package-level `package.json` exports

**Impact:**

- Cannot publish packages to npm independently
- Cannot test package in isolation
- Cannot reuse packages outside this monorepo (currently)

**Resolution path (Phase 7 — if needed):**

- Only required if we need to publish packages to npm
- Effort: 1-2 weeks (per-package build setup)
- Not a current requirement

**Why not done now:**

- Premature optimization
- Adds maintenance burden (per-package tsconfig, build scripts)
- No business requirement for npm publishing
- Blocks better to wait until clear need emerges

**Acceptable trade-off:**

- Speeds up development (single build)
- Reduces complexity in CI/CD
- Easier to reason about (one output)

---

### 5. Backward Compatibility Shim Files (Transitional)

**Status**: Temporary, enable gradual migration

**What:** Old import paths still work via shim re-exports:

```typescript
// Old way (still works)
import { runPricingEngine } from "@/core/pricing/pricingEngine";
// ↓ resolves to ↓
import { runPricingEngine } from "@repo/services";
```

**Files with shims:**

- `src/core/types/index.ts` → re-exports from `@repo/types`
- `src/core/constants/index.ts` → re-exports from `@repo/core`
- `src/core/pricing/pricingEngine.ts` → re-exports from `@repo/services`
- `src/core/roi/roiEngine.ts` → re-exports from `@repo/services`
- etc.

**Why created:**

- Enabled gradual migration path
- Allowed extraction without breaking all existing code
- Developers can migrate at own pace

**Impact:**

- Shims add 40-50 LOC of re-export boilerplate
- Temporary clutter in `src/core/`
- No performance impact (removed at build time)

**Resolution path (Phase 5+ cleanup):**

1. After team fully migrated to `@repo/*` imports
2. Search codebase for old import paths: `grep -r "@/core/pricing" src/`
3. Migrate remaining imports to `@repo/*` equivalents
4. Delete shim files
5. Update docs/architecture/overview.md to remove "backward compatibility" section

**When to migrate:**

- Not urgent (shims work indefinitely)
- Suggested: After Phase 4.5 stabilization + Phase 5 consolidation
- Clean up during quarterly refactoring sprint

**Prevention for future:**

- New code should use `@repo/*` paths from day one
- Code review: suggest package imports when reviewing new code

---

### 6. Integration Client Initialization at Root (Permanent Boundary)

**Status**: By design, cannot move

**What:** Supabase and OpenAI clients initialize at root:

- `src/lib/auth.ts` → Creates Supabase client
- `src/integrations/supabase/client.ts` → Client initialization
- `src/integrations/openai/client.ts` → Client initialization

**Why cannot extract:**

- Auth hydration reads `import.meta.env` at build time
- Must happen before route resolution
- TanStack Start plugin cannot defer this
- Extracting would break SSR and session persistence

**Impact:**

- Integration setup code is NOT reusable for future apps
- Each app (Deal Copilot, Refurb IQ) will have own `src/lib/auth.ts`
- This is correct for multi-app architecture

**Why this is NOT debt:**

- By design (documented in runtime-boundaries.md)
- Future apps will have identical setup (boilerplate, not code reuse)
- Alternative (centralized auth package) would require more complexity

**Prevention for future:**

- Do NOT attempt to move `src/integrations/`
- Do NOT attempt to create `@repo/integrations` facade
- Each app bootstrap is its own concern

See runtime-boundaries.md section "Integration Client Initialization" for full explanation.

---

## Known Risks (Unresolved)

| Risk                                                  | Likelihood | Impact                             | Mitigation                   |
| ----------------------------------------------------- | ---------- | ---------------------------------- | ---------------------------- |
| pricingData divergence if copies not synced           | Low        | Incorrect pricing in one code path | Unit tests catch immediately |
| Forgotten backward compatibility shim after migration | Low        | Import errors during build         | Linting + code review        |
| Accidental upward import (services → ui)              | Low        | Build warning (non-breaking)       | ESLint configuration warns   |
| Type import from wrong location                       | Low        | Type checking catches              | TypeScript strict mode       |
| New package extraction breaks build                   | Low        | Build failure, rollback            | Phase 4.5 validation process |

---

## Debt Decision Matrix

| Item                      | Phase Created | Phase Resolved    | Effort   | Risk     | Status       |
| ------------------------- | ------------- | ----------------- | -------- | -------- | ------------ |
| pricingData duplication   | 4             | 5A (optional)     | 1-2 hrs  | Low      | Tracked      |
| @repo/types @/lib imports | 1             | 5B (optional)     | 2-3 days | Med      | Acceptable   |
| @repo/ui facade design    | 3             | Never (by design) | N/A      | None     | Correct      |
| Shared build output       | 1-4           | 7 (if needed)     | 1-2 wks  | Low      | Deferred     |
| Backward compat shims     | 1-4           | 5+ cleanup        | 2-4 hrs  | Very low | Transitional |
| Integration init at root  | 1             | Never (immovable) | N/A      | None     | By design    |

---

## Conclusion

**Total intentional debt items:** 2 (pricingData, @repo/types imports)

- Both low-impact and well-understood
- Clear resolution paths documented
- No blockers for Phase 4.5 stabilization or Phase 5 consolidation
- Can be addressed in Phase 5 or deferred to later phases

**By-design boundaries (not debt):**

- @repo/ui facade structure
- Integration clients at root
- Shared build output
- Backward compatibility shims

**No surprising gotchas or hidden issues.** Monorepo is production-ready with acceptable trade-offs clearly documented.
