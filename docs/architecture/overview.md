# Refurb Genius Architecture Overview

## Current State (June 2026)

Refurb Genius is a **real pnpm workspace monorepo** hosting a single TanStack Start SSR application with extracted shared libraries organized as workspace packages.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Production Shell (root)               │
│                                                          │
│  TanStack Start + Vite 7 + Nitro SSR + React 19       │
│  Authentication hydration + Supabase initialization     │
│  Route tree generation + Server runtime orchestration   │
│                                                          │
│  src/                                                   │
│  ├── app/                   (route definitions)          │
│  ├── components/            (app-specific UI)           │
│  ├── integrations/          (Supabase + OpenAI)        │
│  ├── lib/                   (app domain logic)          │
│  ├── server.ts              (SSR error wrapper)         │
│  └── routes/                (TanStack route tree)       │
└─────────────────────────────────────────────────────────┘
                              ▲
                              │ imports
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────────┐    ┌──────▼──────┐    ┌────────▼────┐
   │  @repo/ui   │    │ @repo/core  │    │@repo/services
   │             │    │             │    │
   │ Re-export   │    │ Constants   │    │ Business logic
   │ layer:      │    │ Utilities   │    │
   │ - Radix UI  │    │ Mock data   │    │ - Pricing engine
   │ - tailwind  │    │             │    │ - ROI engine
   │ - lucide    │    │             │    │ - Deal scoring
   │             │    │ (facade     │    │ - AI summaries
   └────┬────────┘    │  to root)   │    │
        │             └──────┬──────┘    └────────┬────┘
        │                    │                    │
        └────────────┬───────┴────────────────────┘
                     │ imports
                     │
                ┌────▼────────────┐
                │  @repo/types    │
                │                 │
                │ Domain types    │
                │ Entity contracts│
                │                 │
                └─────────────────┘
```

## Package Hierarchy (Dependency Flow)

**Allowed direction: downward only**

```
@repo/types
    ▲
    │ (types import from here)
    │
@repo/core
    ▲
    │ (constants/utilities import from here)
    │
@repo/services        @repo/ui
    │                   │
    └─────────┬─────────┘
              │
          (both import from)
              │
          @repo/types
              +
          root @/lib (types only)
```

## Runtime Shell (Immovable)

The root `src/` directory is not just application code—it is the **production runtime bootstrap**:

- **TanStack Start plugin** requires `src/` at repository root (pre-plugin architecture constraint)
- **Vite bundler** resolves `import.meta.env.VITE_*` at build time into both client and server bundles
- **Nitro SSR engine** must initialize during Vite build, reading environment variables
- **Supabase client** hydration happens in server context (premature extraction breaks auth)
- **TanStack Router** route tree generation runs at build time (premature extraction breaks routing)

**Lesson learned**: Attempted extraction of `src/` in Phase 3 failed because TanStack Start's plugin system resolves import paths before Vite's configuration applies. The plugin is immutable. Do not attempt relocation again.

## What Each Package Does

### @repo/types (525 LOC, 17 files)

- Domain entity definitions (Project, Deal, Estimate, Analysis, etc.)
- Type contracts for business objects
- Zero runtime code
- Zero external dependencies
- **Responsibility**: Define the shape of data across the platform

### @repo/core (238 LOC, 13 files)

- Constants: UK regions, property types, pricing tiers, capabilities
- Formatting helpers: currency, date, status formatters
- Mock data: demo datasets for testing/design
- Pure utility functions
- Zero external dependencies
- **Responsibility**: Reusable primitives that appear in multiple contexts

### @repo/services (541 LOC, 10 files)

- **Pricing engine**: deterministic refurbishment cost calculations (pure function)
- **ROI engine**: deterministic investment metrics (pure function)
- **Deal scoring**: acquisition opportunity intelligence (pure function)
- **AI summaries**: natural language wording helpers (pure function)
- Zero external dependencies (copies pricingData locally)
- **Responsibility**: Pure business logic that can be tested, reasoned about, and potentially reused across future products

### @repo/ui (migrating component library)

- 17 of 46 UI components have been moved into `packages/ui/src/components/` (source of truth for migrated components)
- Remaining 29 components still live in `src/components/ui/` as shims that re-export from `@repo/ui`
- Provides a stable import path `import { Button } from "@repo/ui"` regardless of migration state
- Target: complete migration of all 46 components. High-value next targets: sidebar, sheet, dropdown-menu, command
- **Responsibility**: Shared design-system components with Radix UI primitives, cva variants, and Tailwind v4 styling

### @repo/integrations (placeholder)

- Reserved namespace for future Supabase and external API client extractions
- Currently empty (integrations remain tightly coupled to root runtime)

## Build Process

**Build orchestration**: pnpm + Turbo

```bash
pnpm build:vercel
# Executes: vite build --config vite.vercel.config.ts
# - Runs TypeScript plugin (@lovable.dev/vite-tanstack-config)
# - Generates TanStack route tree (requires src/ at root)
# - Bundles client + server
# - Outputs to .vercel/output/ (Nitro format)
```

**Build artifacts**:

- Client bundle: `.vercel/output/static/`
- Server bundle: `.vercel/output/functions/__server.func/`
- Single deployment unit (all packages built together)

Packages do not have separate build outputs. This is intentional and appropriate for an SSR monorepo (not a library monorepo).

## Validation Pipeline

| Check       | Command                | Status                            |
| ----------- | ---------------------- | --------------------------------- |
| Type safety | `pnpm typecheck`    | ✅ Pass                           |
| Linting     | `pnpm lint`         | ✅ Pass (6 pre-existing warnings) |
| Build       | `pnpm build:vercel` | ✅ Pass                           |

All checks pass without errors. The monorepo is production-ready.

## Why This Architecture?

1. **Monorepo, not multi-repo**: Single codebase, single deployment unit. Easier to coordinate changes, atomic transactions, simpler rollbacks.

2. **Package extraction, not full isolation**: Services are extracted to improve code organization, not to enable independent distribution. This is appropriate for an SSR app.

3. **Strict dependency hierarchy**: Prevents circular dependencies and maintains clear module boundaries. Types layer exists so that services, core, and UI can depend on shared contracts without circular imports.

4. **Runtime shell at root**: TanStack Start's architecture makes relocation infeasible. Decision is final.

5. **Backward compatibility shims**: Old import paths still work (`@/core/pricing/pricingEngine`). New paths encouraged (`@repo/services`). Gradual migration path.

## Key Metrics

- **Total LOC**: ~18,650 (root: 92.9%, packages: 7.1%)
- **Packages**: 7 real workspace packages
- **Dependencies between packages**: 28 imports, all follow defined hierarchy
- **Circular dependencies**: 0
- **Build failures**: 0
- **Type errors**: 0
