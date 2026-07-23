# Feature slices

Vertical business capabilities live here. **New product behaviour starts in a
slice**, not in `src/lib/`, `src/hooks/`, or `src/services/`.

## Intended request flow

```
Route (src/routes/*)
  → feature presentation  (UI, hooks, createServerFn)
  → feature application   (use cases / ports)
  → domain logic          (pure rules in slice domain/ or @repo/services)
  → infrastructure adapter (repos, AI, storage)
  → platform / @repo/*    (vendor seams + shared kernel)
```

## Slice layout

```
features/<capability>/
  domain/           # Pure types + rules — no IO, no React
  application/      # Use cases + ports (interfaces)
  infrastructure/   # Port implementations (DB, AI adapters)
  presentation/     # Components, hooks, serverFns
  index.ts          # Public API (what routes/other slices import)
```

Import **only** from:

- `@/features/<slice>` — public API  
- `@/features/<slice>/infrastructure` — wiring/composition only  

Never deep-import `domain/`, `application/`, `presentation/`, or adapter paths
across slice boundaries.

## Where code should NOT go

| Folder | Role | New domain logic? |
|--------|------|-------------------|
| `src/lib/` | Cross-cutting utilities (logger, sentry, timeout) | **No** — freeze; migrate out over time |
| `src/hooks/` | App-shell hooks (auth, theme) | **No** — feature hooks live in `presentation/hooks` |
| `src/services/` | Legacy integration seams | **No** — prefer slice infrastructure + platform |
| `src/serverFns/` | Legacy / thin RPC re-exports | Prefer `features/*/presentation/serverFns.ts` |
| `src/core/` | Legacy domain | **No** — migrate into slices or `@repo/*` |

See [FEATURE_SLICE.md](../../docs/architecture/FEATURE_SLICE.md).
