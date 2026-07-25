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

## Runtime ownership (C4c-5)

- **Canonical type authority:** `@repo/types` (via domain)
- **Canonical pure domain:** `src/core/projects/domain`
- **Live UI / client cache:** React Query + `useProjects` / `useProject` / mutations (`src/hooks/useProjects.ts`, `src/lib/queries/projects.ts`)
- **Create mutation:** `createProjectServerFn`
- **`projectStore`:** **retired** (C4c-5) — no singleton store, no store auth listener
- **Compatibility shim:** `src/lib/projects.ts` re-exports pure domain symbols only

## Compatibility

- `@/lib/projects` re-exports pure domain symbols only (no store APIs).
- `@/core/projects` re-exports domain + mocks.
- Photos re-exports (`photoStore`, `formatFileSize`, `ProjectPhoto`) are **legacy coupling (C5)** — do not expand.

## Migration status

| Phase | Scope | Status |
|-------|--------|--------|
| **C4a** | Pure domain types/helpers | Complete |
| **C4b** | `projectStore` ownership moved to core | Complete (superseded by retirement) |
| **C4c-1…4** | RQ keys, detail, mutations, auth isolation | Complete |
| **C4c-5** | `projectStore` retirement | Complete (this surface) |
| **C4c** | Catalog list-key convergence + close-out | In Progress |
| **C5** | Photos / storage (`photoStore` re-export) | Pending |
