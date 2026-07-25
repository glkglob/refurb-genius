# Projects core surface

## Pure domain (C4a) — canonical

```text
src/core/projects/domain/
```

Preferred imports:

```ts
import type { Project, UKRegion, ProjectStage } from "@/core/projects/domain";
import { UK_REGIONS, PROPERTY_TYPES, estimatedRefurbCost } from "@/core/projects/domain";
```

### Allowed in domain

- Types and constants re-exported from `@repo/types` (single authoritative source)
- Pure helpers (`estimatedRefurbCost`, `estimatedProfit`)

### Forbidden in domain

- React / React Query / Router
- Supabase / platform clients
- Mutable project stores, hooks, routes, presentation
- serverFns, photos, storage

## Runtime ownership (C4 / C4c completed)

- **Canonical type authority:** `@repo/types` (via domain)
- **Canonical pure domain:** `src/core/projects/domain`
- **Live UI / client cache:** React Query is the sole Projects client cache
  - **List authority:** `projectsListQueryOptions()` / `projectKeys.all` / `fetchProjectsList` (`src/lib/queries/projects.ts`); consumed by `useProjects`
  - **Detail authority:** `projectQueryOptions` / `projectKeys.byId`; consumed by `useProject`
  - **Catalog adapter:** `useProjectCatalog` maps the shared list cache via `select` — not a separate query key or fetch
- **Create mutation:** `createProjectServerFn` (server-authenticated); seeds detail + exact-invalidates list
- **Stage mutation:** `useSetProjectStage` updates canonical list + detail React Query caches (optimistic dual-cache sync)
- **Auth-boundary isolation:** root AuthProvider bridge → `applyAuthQueryCacheTransition` (non-auth queries cancelled/removed on identity boundary)
- **`projectStore` / `projectHelpers`:** **retired** (C4c-5) — files and mutable store APIs do not exist
- **Compatibility shim:** `src/lib/projects.ts` re-exports pure domain symbols only (no store APIs)

## Compatibility

- `@/lib/projects` re-exports pure domain symbols only (no store APIs).
- `@/core/projects` re-exports domain + mocks.
- Photos re-exports (`photoStore`, `formatFileSize`, `ProjectPhoto`) are **legacy coupling (C5)** — do not expand. C4/C4c completion does not migrate photos/storage.

## Migration status

| Phase | Scope | Status |
|-------|--------|--------|
| **C4a** | Pure domain types/helpers | **Completed** |
| **C4b** | `projectStore` ownership moved to core (historical) | **Completed** (later superseded by C4c-5 retirement) |
| **C4c-1…6** | RQ keys, detail, mutations, auth isolation, store retirement, list/catalog convergence | **Completed** |
| **C4** umbrella | Domain + runtime Projects ownership | **Completed** |
| **C4c** | Live hooks & runtime ownership | **Completed** |
| **C5** | Photos / storage (`photoStore` re-export) | **Planned** (separate) |

### Explicitly outside C4/C4c

- Full browser/server auth unification
- Mutation-cache identity-boundary handling
- Optional stage server-function / post-success reconciliation
- Browser E2E (create → Analyze)
- Photos/Storage ownership (C5)
