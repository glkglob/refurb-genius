# Refurb Genius Platform

**AI-first refurbishment analysis platform for UK property investors**, built on TanStack Start with a monorepo architecture.

## Quick Links

- **[Architecture Documentation](docs/architecture/)** — Comprehensive design overview
  - [Overview & Rationale](docs/architecture/overview.md)
  - [Package Boundaries](docs/architecture/package-boundaries.md)
  - [Dependency Rules](docs/architecture/dependency-rules.md)
  - [Runtime Boundaries](docs/architecture/runtime-boundaries.md)
  - [Migration History](docs/architecture/migration-history.md)
  - [Future Roadmap](docs/architecture/future-roadmap.md)

## Platform Architecture

```
┌─────────────────────────────────────────────────────┐
│  TanStack Start SSR Application (root src/)        │
│  - React 19 + Vite 7 + Nitro SSR                   │
│  - Supabase auth + TanStack Router                  │
│  - 17.3K LOC (92.9% of platform)                   │
└─────────────────────────────────────────────────────┘
                      ▲
                      │ imports
                      │
  ┌───────────────────┼───────────────────┐
  │                   │                   │
┌─▼────────────────┐ ┌▼────────────────┐ ┌▼──────────────┐
│  @repo/ui        │ │  @repo/core     │ │@repo/services │
│  (51 LOC)        │ │  (238 LOC)      │ │ (541 LOC)     │
│                  │ │                 │ │               │
│ Component facade │ │ Constants +     │ │ Pricing engine│
│ re-export layer  │ │ Utilities +     │ │ ROI engine    │
│                  │ │ Mock data       │ │ Deal scoring  │
└────────────────┬─┘ └────────────────┬─┘ │ AI summaries  │
                 │                    │   └────────────────┘
                 └────────────┬───────┘
                              │
                         ┌────▼────────┐
                         │@repo/types   │
                         │  (525 LOC)   │
                         │              │
                         │Domain types  │
                         │Contracts     │
                         │Entities      │
                         └──────────────┘
```

**Total extracted:** 1.3K LOC (7.1%) → workspace packages
**Remaining in runtime:** 17.3K LOC (92.9%) → root `src/`

## Technology Stack

| Layer                   | Technology            | Version  |
| ----------------------- | --------------------- | -------- |
| **Framework**           | TanStack Start        | 1.167.50 |
| **Bundler**             | Vite                  | 7.3.1    |
| **Runtime**             | Node.js (Nitro SSR)   | 24.x     |
| **React**               | React 19              | 19.2.0   |
| **Deployment**          | Vercel (Nitro preset) | —        |
| **Database/Auth**       | Supabase              | —        |
| **Styling**             | TailwindCSS           | 4.2.1    |
| **Package Manager**     | pnpm                  | —        |
| **Build Orchestration** | Turbo                 | —        |
| **Type Checker**        | TypeScript            | 5.8      |

**Note:** This is **not** Next.js. TanStack Start is a full-stack metaframework built on Vite + Nitro.

## Workspace Architecture

### Real pnpm Monorepo

```
pnpm-workspace.yaml     ← Defines workspace
turbo.json              ← Orchestrates builds

packages/
├── types/              → Domain types, contracts (zero deps)
├── core/               → Constants, utilities (zero external deps)
├── services/           → Pure business logic (zero external deps)
├── ui/                 → Component facade (35+ Radix UI deps)
├── integrations/       → Reserved for future (currently empty)
├── eslint-config/      → Shared eslint config
└── typescript-config/  → Shared tsconfig

src/                    ← TanStack Start application (immovable)
├── app/                → Route definitions
├── routes/             → Route tree
├── components/         → React components
├── integrations/       → Supabase, OpenAI clients
├── lib/                → Business logic, utilities
└── server.ts           → SSR error wrapper
```

### Why src/ Cannot Move

TanStack Start's plugin architecture requires `src/` at the repository root:

- Plugin resolution happens **before** Vite configuration applies
- Route discovery requires `src/app/` and `src/routes/` to be discoverable
- Attempted relocation in Phase 3 failed (documented in migration history)
- **Decision: Final.** Do not attempt to move `src/` again.

## Dependency Hierarchy

**One-way import flow** (downward only):

```
root src/  (everything, orchestration)
    ▲
    │
@repo/services  ←┐ (pure business logic)
                 │
@repo/core   ←┐  │ (constants, utilities)
              │  │
@repo/types   │  │ (domain contracts)
↓ (both import from here)
(nothing — bottom layer)
```

**Forbidden imports:**

- ❌ `@repo/types` → any other package
- ❌ `@repo/core` → `@repo/services`
- ❌ `@repo/services` → `@repo/ui`
- ❌ Any package → root app runtime code

**Allowed imports:**

- ✅ Root app → all packages
- ✅ `@repo/services` → `@repo/core`
- ✅ `@repo/core` → `@repo/types`
- ✅ Type-only imports from root `@/lib`

See [Dependency Rules](docs/architecture/dependency-rules.md) for complete rules.

## Local Development

### Setup

```bash
# Install dependencies
pnpm install

# Start dev server (TanStack Start dev mode)
pnpm dev

# Open http://localhost:3000
```

### Commands

```bash
# Type checking (workspace-wide)
pnpm typecheck

# Linting (all packages)
pnpm lint

# Format code
pnpm format

# Build for production (Vercel)
pnpm build:vercel

# Build for development
pnpm build:dev

# Preview production build locally
pnpm preview
```

### Monorepo Commands

```bash
# Run command in all packages
pnpm -r run <script>

# Run in specific package
pnpm -F @repo/services <script>

# Run with dependencies
pnpm -r --filter <package> run <script>
```

## Import Paths

### Workspace Packages

```typescript
// ✅ Preferred: workspace package imports
import { runPricingEngine } from "@repo/services";
import { UK_REGIONS } from "@repo/core";
import type { Project } from "@repo/types";
import { Button } from "@repo/ui";
```

### Root Application

```typescript
// ✅ Acceptable: root application imports
import { projectStore } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { handleAuth } from "@/lib/auth";
```

### Backward Compatibility (Legacy)

```typescript
// ✅ Still works: shim files at old locations
import { runPricingEngine } from "@/core/pricing/pricingEngine";
// ↓ resolves to ↓
import { runPricingEngine } from "@repo/services";
```

**Guidance**: Use `@repo/*` for new code. Migrate old imports gradually.

## Monorepo Rules

### DO:

- ✅ Import from packages via `@repo/*` aliases
- ✅ Keep pure logic in `@repo/services`
- ✅ Keep constants in `@repo/core`
- ✅ Keep types in `@repo/types`
- ✅ Write tests for services
- ✅ Use TypeScript strict mode
- ✅ Follow existing patterns

### DO NOT:

- ❌ Create circular imports between packages
- ❌ Import services code into UI components
- ❌ Move `src/` directory
- ❌ Import root app runtime logic into packages
- ❌ Add new packages without architecture review
- ❌ Ignore TypeScript errors

## Known Constraints & Trade-Offs

### Current State

| Constraint                | Impact                              | Status                |
| ------------------------- | ----------------------------------- | --------------------- |
| `src/` immovable          | Cannot split into `apps/` yet       | Permanent             |
| Auth at root              | Must stay coupled to bootstrap      | By design             |
| pricingData duplication   | Two copies exist (core + services)  | Consolidate Phase 5   |
| Packages share root build | Cannot build packages independently | Acceptable for SSR    |
| @repo/types imports @/lib | Blocks npm publish of types         | Acceptable pragmatism |

See [Platform Debt](docs/architecture/platform-debt.md) for detailed analysis.

## Validation

### Pre-commit Checks

```bash
# All of these must pass before committing
npm run typecheck    # ✅ No type errors
npm run lint         # ✅ Code style valid
npm run build:vercel # ✅ Production build works
```

### Continuous Integration

- **Turbo orchestration**: Tasks run with dependency tracking
- **TypeScript**: Strict mode enabled, full codebase checked
- **ESLint**: Enforces code style and safety rules
- **Build artifacts**: Client + server bundles produced

## Code Review Checklist

When reviewing PRs, verify:

- [ ] Import paths follow hierarchy (see [Dependency Rules](docs/architecture/dependency-rules.md))
- [ ] No new circular dependencies
- [ ] TypeScript type errors resolved
- [ ] No new `@/` imports in packages (types-only are OK)
- [ ] Backward compatibility shims work if extracting
- [ ] Tests pass (if test suite exists)
- [ ] Build command succeeds

## Future Directions

### Phase 5: Consolidation (Next)

- Consolidate pricingData.ts duplication
- Harden @repo/types independence (optional)

### Phase 6: Multi-App Architecture (Post-Deal Copilot)

- Deal Copilot app (separate TanStack Start bootstrap)
- Refurb IQ app (separate TanStack Start bootstrap)
- Shared `@repo/*` packages across apps

See [Future Roadmap](docs/architecture/future-roadmap.md) for full planning.

## Troubleshooting

### Build Fails with "Cannot find module @repo/services"

**Cause**: Vite path alias not resolved. Usually a TypeScript issue.

**Fix:**

```bash
npm run typecheck   # Check for errors first
npm run build:vercel  # Retry build
```

### Type Error: "Property does not exist on type 'X'"

**Cause**: Type import from wrong location.

**Fix**: Use correct import path:

```typescript
// ❌ Wrong
import type { Project } from "@/core/types";

// ✅ Right
import type { Project } from "@repo/types";
```

### ESLint Error: "no-restricted-imports"

**Cause**: Importing from forbidden path.

**Fix**: See [Dependency Rules](docs/architecture/dependency-rules.md) for allowed imports.

### SSR fails at startup

**Cause**: Runtime code moved or env vars not set.

**Fix**:

- Do not move `src/`, `vite.config.ts`, or `package.json`
- Verify Supabase env vars are set in Vercel
- Check auth initialization in `src/lib/auth.ts`

## Contributing

1. **Understand the architecture** — Read [Architecture Overview](docs/architecture/overview.md)
2. **Follow import rules** — Check [Dependency Rules](docs/architecture/dependency-rules.md)
3. **Respect package boundaries** — See [Package Boundaries](docs/architecture/package-boundaries.md)
4. **Don't extract code casually** — Review [Runtime Boundaries](docs/architecture/runtime-boundaries.md) first
5. **Ask questions** — If unsure where code belongs, open an issue

## Resources

- **[TanStack Start Documentation](https://tanstack.com/start/latest/docs/framework/react/overview)**
- **[Vite Documentation](https://vitejs.dev/)**
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Supabase Documentation](https://supabase.com/docs)**
- **[Turbo Documentation](https://turbo.build/repo/docs)**
- **[Architecture Documentation](docs/architecture/)** ← Start here for this project

## Team Communication

- **Slack channel**: TBD
- **Architecture discussions**: Use issue tracker
- **Code review process**: See Code Review Checklist above
- **Documentation**: Always update docs when architecture changes

---

**Last updated**: May 2026
**Branch**: chore/monorepo-restructure
**Status**: Production-ready, Phase 4 complete, Phase 4.5 stabilization in progress
