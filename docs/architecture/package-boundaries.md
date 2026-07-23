# Package Boundaries

Platform context: [platform-architecture-plan.md](./platform-architecture-plan.md)
(shared **domain services** vs shared **platform capabilities**).

## Responsibility Matrix

| Package            | Owns                              | Imports From                             | Exports                   | Cannot Import                      |
| ------------------ | --------------------------------- | ---------------------------------------- | ------------------------- | ---------------------------------- |
| @repo/types        | Domain types, contracts, DTOs     | (nothing)                                | Types only                | Services, core, UI, root app       |
| @repo/core         | Constants, utilities, mock data   | @repo/types, @/lib (types)               | Constants, utils, types   | Services, UI, root runtime logic   |
| @repo/services     | **Domain engines** (pricing, ROI, estimating, …) — deterministic, React-free | @repo/core, @repo/types, @/lib (types) | Business engines, helpers | UI, routes, features, apps |
| @repo/ui           | Shared UI primitives              | Radix, cva, `@repo/ui/lib/utils`         | Components                | Services, core, root app logic     |
| @repo/supabase     | **Platform capability** — client factories | `@supabase/ssr`, `@supabase/supabase-js` | Browser/server clients | UI, root business logic, features |
| @repo/integrations | (Reserved — prefer `ai` / capability packages) | (nothing yet) | (nothing yet) | (TBD) |
| Root / app runtime | SSR, routes, **features**, app `platform/` seams | All packages (@repo/\*) | Integrated app | Other apps (when multi-app) |

### Two package kinds

| Kind | Examples | Solves |
|------|----------|--------|
| **Domain services** | `@repo/services` (pricing, roi, estimating) | Business questions — pure/deterministic where possible |
| **Platform capabilities** | supabase, future auth/ai/storage/billing | Technical infrastructure — often IO |

## What Belongs Where?

### ✅ @repo/types

**Include:**

- Type definitions: `Profile`, `Project`, `Deal`, `Estimate`
- Type aliases: `ProjectStatus = "Draft" | "Analysing" | ...`
- DTOs: input/output contracts
- Enums: `PRODUCT_IDS`, `REGION_MULTIPLIERS` (as types)
- Entity creation functions: pure, deterministic (e.g., `createDealMetadata`)

**Exclude:**

- React components
- Hooks
- Loaders
- Auth state
- Supabase clients
- Runtime orchestration
- Business logic (use services)

### ✅ @repo/core

**Include:**

- Constants: `UK_REGIONS`, `PROPERTY_TYPES`, `DISCLAIMER`, capability lists
- Formatting helpers: `formatGBP`, date formatters, status strings
- Lookup tables: region multipliers, property condition mappings
- Mock data: demo projects, analysis samples
- Pure utility functions: calculations, transformations
- Type selectors: functions that pull data from types

**Exclude:**

- React components
- Hooks
- Business logic calculations (use services)
- Supabase operations
- External API calls
- Auth state
- Runtime stores

**Example of misplaced code:**

```typescript
// ❌ WRONG: belongs in @repo/services
export function calculateDealScore(opportunity) {
  const roiResult = runRoiEngine(...);
  return score;
}

// ✅ RIGHT: belongs in @repo/core
export const CAPABILITY_FLAGS = {
  DEALS: "deal-copilot",
  REFURB_IQ: "refurb-iq",
  // ...
};
```

### ✅ @repo/services

**Include:**

- Deterministic calculation engines: `runPricingEngine`, `runRoiEngine`
- Pure business logic: `scoreDealOpportunity`, `getMissingDealFields`
- AI helper wording: `reportHeadline`, `executiveSummary`, `recommendedWorks`
- Transformation pipelines: `buildReport`
- Any pure function that could theoretically be tested without React

**Exclude:**

- React components
- Hooks (useCallback, useState, etc.)
- Supabase clients or queries
- External API initialization
- Auth state or checks
- Providers
- Stores (Zustand, TanStack Query)
- Route loaders
- Server-side orchestration logic

**Example of misplaced code:**

```typescript
// ❌ WRONG: uses React hook, belongs in root component
export function useDealScore(opportunity) {
  const [score, setScore] = useState(null);
  useEffect(() => {
    setScore(scoreDealOpportunity(opportunity));
  }, []);
  return score;
}

// ✅ RIGHT: pure function, belongs in @repo/services
export function scoreDealOpportunity(input) {
  const missingFields = getMissingDealFields(input);
  if (missingFields.length > 0) return { ready: false, missingFields };
  // ...
}
```

### ✅ @repo/ui

**Include:**

- Re-exports from `src/components/ui/` (Radix UI wrappers, custom components)
- Utility re-export: `cn` from `src/lib/utils`
- **Nothing else** — this is a facade layer

**Exclude:**

- New component implementations (keep at root)
- Business logic
- Hooks that require app context
- Styling that's app-specific

**Valid import from @repo/ui:**

```typescript
import { Button, Dialog, Input, cn } from "@repo/ui";
```

### ❌ What Cannot Be Extracted (Yet)

**Must remain in root `src/`:**

1. **SSR runtime bootstrap** (`src/server.ts`, route definitions)
   - TanStack Start plugin requires this
   - Nitro SSR initialization
   - Env var reading happens here

2. **Authentication hydration** (`src/lib/auth`)
   - Supabase client initialization
   - Session management
   - Auth context providers
   - Lovable auth wrapper

3. **Route tree** (`src/routes/`)
   - Route definitions
   - Loaders
   - Route-specific logic
   - Must be discoverable at build time

4. **Application providers** (`src/lib/providers`)
   - React Context providers
   - Zustand stores
   - TanStack Query client
   - Error boundaries

5. **Platform + integrations**
   - `src/platform/` — vendor SDK seams (OpenAI, PostHog, Supabase re-exports)
   - `src/integrations/supabase/` — generated types only (do not import in app code)
   - `@repo/supabase` — actual client factories

6. **App-specific components** (`src/components/`)
   - Most UI components belong here
   - Only ultra-generic primitives in @repo/ui

## Boundary Enforcement

### Import Rule: The One-Way Hierarchy

```
@repo/services ──┐
                 │
@repo/core ──────┼──> @repo/types
                 │
@repo/ui ────────┘
                    ^
                    │
             root src/ (everything)
```

**Forbidden imports** (will fail code review):

- ❌ `@repo/types` importing from `@repo/core`
- ❌ `@repo/core` importing from `@repo/services`
- ❌ `@repo/services` importing from `@repo/ui`
- ❌ `@repo/ui` importing from `@repo/core`
- ❌ Any package importing from root `src/` except types from `@/lib`

**Allowed exceptions** (documented, minimal):

- @repo/types imports types from `@/lib/projects` (types only, acceptable pragmatism)
- @repo/core imports constant `TRADES_JOB_CATEGORIES` from `@/core/trades` (constant reuse, acceptable)
- @repo/services imports types from `@/lib/analysis` (types only, acceptable)

## Testing Package Boundaries

### Detect violations:

```bash
# Check for @/ imports in packages (should be types only)
grep -r "^import [^t].*from.*['\"]@/" packages/*/src --include="*.ts"

# Check for upward imports (should be none)
grep -r "@repo/services" packages/core --include="*.ts"
grep -r "@repo/core\|@repo/services" packages/ui --include="*.ts"
```

### Type checking enforces hierarchy:

```bash
npm run typecheck
# Fails if circular imports detected
# Fails if types can't be resolved
```

## Adding New Code

**Decision tree:**

```
Is it a type/interface/enum?
  → @repo/types

Is it a constant or formatting helper?
  → @repo/core

Is it pure business logic (no hooks, no React)?
  → @repo/services

Is it an ultra-generic UI primitive?
  → @repo/ui

Does it use React hooks, stores, or require app context?
  → src/ (root)

Does it touch auth, SSR, routing, or orchestration?
  → src/ (root, immovable)
```

## Future Package Boundaries (Phase 5+)

Packages that do NOT exist yet but may be extracted later:

### @repo/integrations (placeholder)

When ready to extract:

- Supabase client initialization (if achievable)
- OpenAI provider setup (if achievable)
- External API clients
- **Risk**: Auth hydration happens early; extraction is uncertain

### @repo/features (hypothetical)

For multi-product separation:

- Deal Copilot specific logic
- Refurb IQ specific logic
- Trades Marketplace specific logic
- **Currently not recommended**: app is too tightly coupled

## No Breaking Changes

All extraction work uses backward-compatibility shims:

```typescript
// Old import still works:
import { runPricingEngine } from "@/core/pricing/pricingEngine";

// New import is preferred:
import { runPricingEngine } from "@repo/services";

// Both paths resolve to same code (shim forwards to package)
```

This allows gradual migration without forcing all code to change at once.
