# Priority 1.13 — Package promotion process

When code may move from an **application** into a **shared package**.

## Hard rule

> Do not create speculative shared packages.  
> Promote only after reuse is proven.

## Preconditions (all required)

Code may leave an app into `packages/*` only when:

1. **Two or more real consumers** require it (two apps, or one app + package that is not a facade of the same feature).
2. **API is application-independent** — no Refurb-only product language in public contracts unless the platform product is that domain.
3. **Ownership is clear** — named package owner (domain service vs platform capability vs UI).
4. **Contracts are stable** — types versioned in `@repo/types` or package public API; no weekly breaking churn.
5. **No application routing** — no imports of routes, loaders, or URL trees.
6. **No application-specific UI** — screens stay in app features; only primitives/chrome promote.
7. **Contract tests exist** — unit/invariant tests pin the public API.

If any item fails → keep the code in the application (or app feature).

## Promotion workflow

```
1. Identify candidate (document current path + consumers)
2. Classify: domain service | platform capability | ui | platform-ui
3. Design public API (inputs/outputs, pure vs IO)
4. Move implementation into packages/<name>
5. Re-export temporary shim from old path (optional, short-lived)
6. Point all consumers at package
7. Add/adjust invariants + package-registry.md entry
8. Delete shim when unused
```

## What must never promote as-is

| Asset | Why |
|-------|-----|
| `features/estimate` wizard | Product workflow |
| Route modules | App-specific |
| Marketing/signup pages | App UX |
| One-off report layouts with product branding | App feature (export infrastructure may promote) |

## Examples

| Candidate | Decision |
|-----------|----------|
| `runPricingEngine` | Already domain service — correct home |
| `useIsMobile` | Design-system hook → `@repo/ui` |
| `photoStore` | Promote to `packages/storage` only when second app needs same API |
| Estimate page components | Stay in `features/estimate/presentation` |

## Checklist PR template

```markdown
## Package promotion
- [ ] ≥2 real consumers listed
- [ ] Kind: domain service | platform capability | ui | platform-ui
- [ ] No apps/* or features/* imports in package
- [ ] Public API documented in package-registry.md
- [ ] Contract tests added
- [ ] App shims temporary only
```
