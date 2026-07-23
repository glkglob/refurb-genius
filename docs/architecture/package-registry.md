# Priority 1.10 — Shared package classification

Registry of workspace packages: owner, purpose, dependencies, consumers, API, stability.

**Related:** [platform-architecture-plan.md](./platform-architecture-plan.md), [package-boundaries.md](./package-boundaries.md).

Stability: `stable` | `evolving` | `experimental` | `reserved`

---

## Domain services

### `@repo/services` (`packages/services`)

| Field | Value |
|-------|--------|
| **Owner** | Platform / domain engines |
| **Kind** | Shared domain service |
| **Purpose** | Deterministic pricing, ROI, deal scoring, estimating engines, calculators |
| **Allowed deps** | `@repo/core`, `@repo/types` only |
| **Forbidden deps** | React, apps, features, routes, Supabase, OpenAI SDK |
| **Consumers** | App features, serverFns, deal-copilot, invariant tests |
| **Public API** | Package root `export *` — `runPricingEngine`, `runRoiEngine`, `scoreDealOpportunity`, enhanced/new-build estimators, trade-rates, cost-library, uk-region |
| **Stability** | **stable** for pricing/ROI; **evolving** for estimating modules |

Modules: `pricing`, `roi`, `deal-analysis`, `enhanced-estimate`, `new-build`, `cost-library`, `trade-rates`, `uk-region`, `development-appraisal`, `ai` (pure helpers only).

---

## Platform capabilities (present)

### `@repo/supabase` (`packages/supabase`)

| Field | Value |
|-------|--------|
| **Owner** | Platform |
| **Kind** | Platform capability |
| **Purpose** | Browser/server Supabase client factories |
| **Allowed deps** | `@supabase/ssr`, `@supabase/supabase-js` |
| **Forbidden deps** | App features, routes, business engines |
| **Consumers** | App `platform/supabase`, browser/server auth |
| **Public API** | `createBrowserClient` / server helpers (see package src) |
| **Stability** | **stable** |

### `@repo/types` (`packages/types`)

| Field | Value |
|-------|--------|
| **Owner** | Platform |
| **Kind** | Shared kernel (types) |
| **Purpose** | Cross-app domain types, DTOs, const unions |
| **Allowed deps** | None |
| **Consumers** | All packages and app |
| **Public API** | Root barrel — Project, ConditionLevel, RoomAnalysis, trades, gallery, payment types, … |
| **Stability** | **evolving** (add; avoid breaking renames without codemod) |

### `@repo/core` (`packages/core`)

| Field | Value |
|-------|--------|
| **Owner** | Platform |
| **Kind** | Shared kernel (pure utils/constants) |
| **Purpose** | Constants, formatters, mock helpers, pricing tables |
| **Allowed deps** | `@repo/types` |
| **Forbidden deps** | React, apps, features, IO SDKs |
| **Consumers** | `@repo/services`, app core shims |
| **Public API** | Root barrel — DISCLAIMER, TRADES_JOB_CATEGORIES, pricing data, formatters |
| **Stability** | **evolving** |

---

## UI packages

### `@repo/ui` (`packages/ui`)

| Field | Value |
|-------|--------|
| **Owner** | Platform design system |
| **Kind** | Design-system primitives |
| **Purpose** | Button, Input, Dialog, Tabs, Card, Table, Badge, form controls, Sidebar primitives, `useIsMobile` |
| **Allowed deps** | React, Radix, cva, lucide (presentation-only) |
| **Forbidden deps** | App routes, features, domain engines, Supabase |
| **Consumers** | App components/shims, all apps later |
| **Public API** | Root component exports + `useIsMobile` |
| **Stability** | **evolving** (migration from app `components/ui` shims ongoing) |

### `@repo/platform-ui` (not created yet)

| Field | Value |
|-------|--------|
| **Owner** | Platform |
| **Kind** | Platform experience UI |
| **Purpose** | AppShell, Navigation, WorkspaceSwitcher, AccountMenu, PermissionGuard, FileUploader, DocumentViewer, AuditTimeline, UsageMeter |
| **Allowed deps** | `@repo/ui`, React; optional capability packages |
| **Forbidden deps** | App-specific features/routes |
| **Consumers** | Multiple apps when multi-app |
| **Public API** | TBD on first extraction |
| **Stability** | **reserved** — create only when ≥2 real consumers |

---

## Tooling / reserved

| Package | Purpose | Stability |
|---------|---------|-----------|
| `@repo/eslint-config` | Shared ESLint | stable |
| `@repo/typescript-config` | Shared tsconfig | stable |
| `@repo/integrations` | Reserved / legacy | reserved — prefer capability packages |

---

## Planned platform capabilities (lazy)

Create only after promotion rules are met ([package-promotion.md](./package-promotion.md)):

| Target package | Purpose | Status |
|----------------|---------|--------|
| `auth` | Users, sessions, org membership helpers | App-local + supabase today |
| `ai` | Provider abstraction, retries, cost, prompt registry | App `platform/openai` etc. |
| `documents` | Upload metadata, signed URLs, processing | App storage helpers |
| `storage` | Object storage paths/helpers | `lib/photos`, storage services |
| `audit` | Append-only audit events | Not extracted |
| `notifications` | Email/push adapters | Resend / edge functions |
| `billing` | Plans, entitlements, quotas | Feature payment scaffold |
| `projects` | Shared project entity helpers | Types partial; stores app-local |
| `organisations` | Tenant primitives | Not extracted |
| `testing` | Shared test kits | Not extracted |

---

## Classification legend

| Kind | Rule of thumb |
|------|----------------|
| **Domain service** | Pure business question (price, ROI) — React-free |
| **Platform capability** | Technical infrastructure (auth, storage) |
| **Design system** | Visual primitives — no product domain |
| **Platform UI** | Product-neutral chrome — multi-app shells |
| **Kernel** | types/core — bottom of dependency stack |
