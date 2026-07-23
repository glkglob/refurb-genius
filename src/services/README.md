# Services (transitional)

> **Status:** Legacy integration seams. **Do not add new domain logic here.**  
> New work belongs in `src/features/<slice>/infrastructure` + `src/platform/*`.  
> File set is frozen by `tests/invariants/legacy-layer-freeze.invariant.test.ts`.

Historical role: components and pages imported from `@/services/*` instead of
reaching into storage/SDK details directly.

| Module | Role today |
|--------|------------|
| `@/services/projects` | Project helpers (often re-exports core) |
| `@/services/storage` | Photo bucket wrappers |
| `@/services/trades/*` | Trades job/profile stores |

Prefer:

- Slice **infrastructure** adapters for product IO  
- `src/platform/supabase/*` for client factories  
- Pure engines in `@repo/services`  

Server-only secrets stay in `*.server.ts` / dynamic imports inside serverFns —
never imported from this folder into client code.
