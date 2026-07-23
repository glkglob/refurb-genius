# Priority 1.14 — Platform domain glossary

Core concepts and naming so new applications extend the platform without overlapping models.

| Term | Meaning | Owner |
|------|---------|--------|
| **Intelligent Platform** | Multi-app monorepo: apps compose packages | Architecture |
| **Application** | Deployable product (e.g. Refurb Genius) | `apps/<name>` (today: repo root) |
| **Application feature** | Vertical product workflow slice | `src/features/<feature>` |
| **Domain service** | Deterministic business engine | `packages/services` |
| **Platform capability** | Technical shared infrastructure | `packages/auth`, `storage`, … |
| **Design system (`ui`)** | Pure primitives (Button, Input, …) | `packages/ui` |
| **Platform UI** | Product-neutral chrome (AppShell, …) | `packages/platform-ui` (future) |
| **App platform seam** | App-local wiring of packages | `src/platform/*` |
| **Public API (feature)** | Only allowed import surface of a feature | `features/<f>/index.ts` (+ infra barrel) |
| **Promotion** | Moving app code into a package after proven reuse | [package-promotion.md](./package-promotion.md) |
| **mid_total** | Authoritative refurb budget from pricing engine | `@repo/services` pricing |
| **ROI engine** | Profit/yield/risk from purchase + budget + GDV | `@repo/services` roi |
| **Advisory estimate** | Enhanced/new-build engines — not default ROI budget | estimating modules |
| **Workspace** | Top-level user/tenant context (future multi-product) | platform / organisations |
| **Refurbishment project** | Refurb Genius project record | Application data |
| **Shared project** | Only if multi-app collaboration needs one object | packages/projects (lazy) |
| **Platform data** | users, orgs, subscriptions, audit, files | Platform |
| **Application data** | estimates, studies, analysis, product reports | Application |
| **ConditionLevel** | Property condition union for pricing/AI | `@repo/types` |
| **RoomAnalysis** | Per-room vision analysis shape | `@repo/types` |

## Naming conventions

| Pattern | Use |
|---------|-----|
| `run*Engine` | Deterministic domain service entrypoints |
| `*.server.ts` | Server-only modules (secrets, Node SDKs) |
| `create*ServerFn` | App RPC surfaces (presentation) |
| `@repo/*` | Workspace packages |
| `features/<name>` | App-local only — never imported by packages |

## Anti-patterns (glossary)

| Avoid saying | Prefer |
|--------------|--------|
| “Shared feature” | Shared **package** or app-local feature |
| “Project” for all products | Workspace + product-specific records |
| “Just put it in ui” | Primitive → `ui`; chrome → `platform-ui`; product → feature |
