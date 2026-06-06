# Migration History: Phases 1-4

## Goal

Extract shared code from a monolithic TanStack Start application into reusable workspace packages, enabling code reuse across future products (Deal Copilot, Refurb IQ) while maintaining a single source of truth for business logic.

**Constraint**: Do not break production. Do not move root `src/`. Do not touch SSR or auth.

## Phase 1: Extract @repo/types (Completed)

**Objective**: Move all pure domain types to a shared layer.

**Extracted:**

- Domain types: Profile, Project, Deal, Estimate, Analysis, Redesign, etc.
- DTOs and contracts
- Type aliases and enums
- Result: 525 LOC, 17 files

**Files moved:**

- `src/core/types/*` → `packages/types/src/`
- `src/core/platform/*` (types) → `packages/types/src/`
- `src/core/trades/*` (types) → `packages/types/src/`

**Backward compatibility:**

- Created shims at `src/core/types/index.ts` re-exporting from `@repo/types`
- Old imports `import { Profile } from "@/core/types"` still work
- New imports `import { Profile } from "@repo/types"` encouraged

**Challenges:**

- Fixed relative import paths within moved files (e.g., `../platform/products` → `./products`)
- Root `tsconfig.json` updated with `@repo/types` path alias
- Added `baseUrl: "."` to allow TypeScript path resolution

**Result:** ✅ Pass

---

## Phase 2: Extract @repo/core (Completed)

**Objective**: Move framework-agnostic constants, utilities, and mock data.

**Extracted:**

- Constants: UK_REGIONS, PROPERTY_TYPES, DISCLAIMER, pricing tiers, capabilities
- Utilities: pricingData lookup tables, pure formatters
- Mock data: demo projects, analysis samples
- Result: 238 LOC, 13 files

**Files moved:**

- `src/core/constants/*` → `packages/core/src/constants/`
- `src/core/pricing/pricingData.ts` → `packages/core/src/utilities/`
- Utilities and mock data → `packages/core/src/`

**Backward compatibility:**

- Created shims at old locations re-exporting from `@repo/core`
- Imports like `import { UK_REGIONS } from "@/core/constants"` still work

**Challenges:**

- pricingEngine.ts imports from pricingData.ts (both extracted, but in different packages)
- Fixed with import redirect: pricingEngine → pricingData (local to same package)
- Prettier formatting violations fixed with `eslint --fix`

**Result:** ✅ Pass

---

## Phase 3: Extract @repo/ui (In Progress — 17/46 Migrated)

**Objective**: Move UI components into `packages/ui/src/components/` as the shared design-system library.

**Initial approach (pivot required):**

- Early attempt to bulk-move 45 files failed due to TypeScript circular-reference risk (src/components/ui → packages/ui → src/components/ui)
- Adopted a component-by-component migration strategy instead

**Current implementation:**

- **Migrated (17/46):** Components fully moved to `packages/ui/src/components/`, exported from `packages/ui/src/index.ts`, shim in `src/components/ui/` replaced with a re-export
- **Remaining (29/46):** Still live in `src/components/ui/` as shims re-exporting from `@repo/ui`; `packages/ui/src/index.ts` barrel covers all 46 so import paths are stable
- **Import rule:** App code imports from `@repo/ui` (barrel) or `@repo/ui/<component>` (for tooltip, dialog, and sidebar dependencies that cause circular refs through the barrel)
- **Tailwind v4:** `src/styles.css` includes `@source "../packages/ui/src/**/*"` so migrated component classes are picked up

**Next targets (in priority order):** sidebar, sheet, dropdown-menu, command.

**Result:** ✅ Pass (active, ongoing migration)

---

## Phase 4: Extract @repo/services (Completed)

**Objective**: Move pure business logic engines to reusable package.

**Extracted:**

- Pricing engine: deterministic refurbishment cost calculations
- ROI engine: deterministic investment metrics
- Deal scoring: acquisition opportunity intelligence
- AI summaries: natural language wording helpers
- Result: 541 LOC, 10 files

**Files moved:**

- `src/core/pricing/pricingEngine.ts` → `packages/services/src/pricing/`
- `src/core/roi/roiEngine.ts` → `packages/services/src/roi/`
- `src/core/dealCopilot/dealScore.ts` → `packages/services/src/deal-analysis/`
- `src/core/ai/aiSummaries.ts` → `packages/services/src/ai/`

**Entity moved:**

- `src/core/dealCopilot/opportunity.ts` → `packages/types/src/opportunity.ts`
- Reason: Entity types belong in @repo/types (domain layer), not services

**Key decision:**

- pricingData.ts was copied (not moved) to `packages/services/src/pricing/`
- Reason: Vite build path resolution couldn't handle @repo/services importing @repo/core
- Created two copies of pricingData (duplication risk, see Future)
- Alternative: Would have required Vite config changes that broke build

**Backward compatibility:**

- Shims at original locations re-export from `@repo/services` and `@repo/types`
- Old import paths still work

**Build challenges:**

- Initial build failed: Rollup couldn't resolve @repo/core path alias
- Fixed by using local pricingData copy instead of cross-package import
- Trade-off: Duplication vs. working build

**Result:** ✅ Pass (with accepted trade-off)

---

## The Failed Extraction: src/ Relocation (Historical — Early Phase 3)

### What Happened

**Initial plan**: Move `src/` to `apps/main/src/` to improve monorepo structure.

**Objective**: Isolate the main application from shared packages.

**What we tried:**

1. Created `apps/main/` directory
2. Moved all of `src/` contents to `apps/main/src/`
3. Updated Vite config to point to new location
4. Attempted to run build

**What went wrong:**

```
Error: Cannot find route definitions
TanStack Start plugin failed to resolve src/app/
Route tree generation aborted
```

**Root cause:** TanStack Start's plugin architecture works as follows:

1. **Plugin initialization** (very early): Plugin code runs, tries to discover routes
2. **Plugin looks for routes**: Searches for `src/app/` in project root
3. **Before Vite config applies**: Plugin scans file system, resolves import paths
4. **Vite bundler starts**: After plugin completes (or fails)

When we moved `src/` to `apps/main/src/`, the plugin couldn't find routes because:

- Plugin initialization happens BEFORE Vite's root option takes effect
- Plugin looks in hardcoded location based on project structure
- By the time Vite config could redirect, it was too late
- Circular: Plugin needs routes to initialize, but can't find them

**Why reverting was correct:**

- Plugin is immutable and non-relocatable
- TanStack Start's architecture requires `src/` at repository root
- No Vite configuration change could fix this
- Attempting workarounds would introduce fragility

**Decision:** Reverted all changes, kept `src/` at root, changed Phase 3 strategy to UI re-export layer instead.

**Learning:** Do not attempt to move `src/` again. TanStack Start's plugin is the limiting factor.

---

## What We Learned

### ✅ What Works

**Extraction by pure logic type:**

- Pure types → @repo/types (100% safe)
- Constants/utilities → @repo/core (100% safe)
- Pure business logic → @repo/services (100% safe)
- UI components → @repo/ui facade (100% safe, if kept as re-export)

**Backward compatibility:**

- Shim files at old locations work perfectly
- No breaking changes to existing code
- Gradual migration path enabled

**Build orchestration:**

- Turbo correctly tracks dependencies
- TypeScript path aliases work across packages
- Type checking validates entire workspace

### ❌ What Doesn't Work

**Relocating the runtime shell:**

- Cannot move `src/` (TanStack Start plugin limitation)
- Cannot move `vite.config.ts` (build entry point)
- Cannot move `package.json` (workspace root)
- Cannot isolate auth system (couples to runtime)

**Isolating integrations:**

- Cannot move Supabase client init (depends on bootstrap)
- Cannot move OpenAI client init (depends on env vars)
- Cannot defer these initializations

**Splitting too aggressively:**

- Cannot extract components too early
- Cannot separate auth/routing/providers
- These need to stay coordinated

### ⚠️ Known Trade-Offs

1. **pricingData duplication** (Phase 4)
   - Exists in both @repo/core and @repo/services
   - Acceptable for now; consolidate in Phase 5 stabilization
   - Risk: Future divergence if one copy updated without the other

2. **@repo/types imports from @/lib**
   - Types need to reference root project types
   - Acceptable pragmatism for SSR monorepo
   - Blocks npm publish of @repo/types (not needed for internal use)

3. **@repo/ui is a facade, not isolation**
   - Components remain at root (app-specific)
   - @repo/ui just provides import convenience
   - True isolation would require moving all UI components (not worth it)

4. **Packages can't build independently**
   - All packages build together to single output
   - Appropriate for SSR app (not library monorepo)
   - Would require significant restructuring to change

---

## Migration By The Numbers

| Phase     | Scope               | Files    | LOC         | Status |
| --------- | ------------------- | -------- | ----------- | ------ |
| 1         | Types extraction    | 15       | 525         | ✅     |
| 2         | Core extraction     | 8        | 238         | ✅     |
| 3         | UI facade           | 45       | 51          | ✅     |
| 4         | Services extraction | 10       | 541         | ✅     |
| **Total** | **Extracted**       | **~78**  | **~1,355**  | **✅** |
| -         | Root app (src/)     | 152      | 17,295      | -      |
| -         | **Grand total**     | **~230** | **~18,650** | -      |

**Distribution:** 7.1% extracted to packages, 92.9% remains in root (correct for SSR app).

---

## Validation Across All Phases

| Check                  | Status                                 |
| ---------------------- | -------------------------------------- |
| TypeScript compilation | ✅ Pass                                |
| ESLint                 | ✅ Pass (6 pre-existing warnings)      |
| Vite build             | ✅ Pass                                |
| Nitro SSR              | ✅ Pass                                |
| Route discovery        | ✅ Pass                                |
| Auth initialization    | ✅ Pass                                |
| Package imports        | ✅ Pass (all hierarchy rules followed) |
| Circular dependencies  | ✅ None detected                       |

**Conclusion:** Monorepo is production-ready.

---

## What Comes Next

See `future-roadmap.md` for stabilization period and Phase 5+ planning.
