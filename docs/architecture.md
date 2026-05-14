# Refurb Genius Architecture

## Current Stack

Refurb Genius is a Vite + TanStack Router TypeScript application using:

- TanStack Router
- Vite
- TypeScript
- Supabase
- Vercel
- Tailwind UI
- AppLayout
- Sidebar
- MobileTopBar

## Platform Direction

Refurb Genius is becoming the main platform that contains multiple product surfaces:

- Refurb Genius
- Deal Copilot
- Refurb IQ
- Trades Marketplace

The current integration rule is to keep existing live product namespaces stable while shared platform foundations are introduced.

## Product IDs

Canonical product IDs are:

- `refurb-genius`
- `deal-copilot`
- `refurb-iq`
- `trades-marketplace`

These IDs should be used for shared dashboard data, report metadata, product-source tagging, and future cross-product reporting.

## Route Architecture

This app uses TanStack Router file-based routing.

Important rule:

Use the non-nested underscore route convention when a route must appear as a flat URL rather than nested UI.

Examples:

- `trades_.new.tsx` maps to `/trades/new`
- `trades_.profile.tsx` maps to `/trades/profile`
- `trades_.$jobId.tsx` maps to `/trades/$jobId`
- `trades_.$jobId_.edit.tsx` maps to `/trades/$jobId/edit`
- `auth_.callback.tsx` maps to `/auth/callback`

Do not revert these files to nested route filenames.

## Live Modules

### Trades Marketplace

Current capabilities:

- Public job browsing
- Category filtering
- Job detail page
- Post job
- Edit job
- Owner guards
- Register interest
- Duplicate interest prevention
- Accept/reject interest
- Dashboard integration
- Trade profile onboarding

Database tables:

- `trades_jobs`
- `trades_job_interests`
- `trade_profiles`

RLS is enabled for all three tables.

### Deal Copilot

Deal Copilot remains under:

`/deal-copilot/*`

Do not introduce `/deals` yet.

Future Deal Copilot work should move shared logic into:

`src/core/dealCopilot`

### Dashboard

The dashboard should become the unified cross-product workspace for:

- Deals
- Projects
- Reports
- Trades Marketplace activity

### Reports

Reports currently have a foundation layer.

The target architecture is a canonical report engine with product-source metadata so reports can be generated from different modules.

## Auth Architecture

The auth system supports:

- Signup
- Signin
- Forgot password
- Reset password
- OAuth callback
- Session persistence

The auth hydration race has been fixed. `useAuth` waits for Supabase session resolution before treating the user as unauthenticated.

Do not add route-level logic that assumes auth is resolved synchronously on initial render.

## Supabase / RLS Rules

RLS is enabled for:

- `trades_jobs`
- `trades_job_interests`
- `trade_profiles`

Important current rule:

Owners can accept or reject trade job interests.

Do not add client-side-only authorization as the only protection. UI guards are useful, but Supabase RLS must remain the source of truth.

## Core Code Rules

Keep `src/core` pure TypeScript.

Allowed in `src/core`:

- Types
- Pure functions
- Mappers
- Report logic
- Product metadata
- Conversion logic

Avoid in `src/core`:

- React components
- TanStack Router imports
- Supabase client instances
- Browser-only APIs
- Tailwind classes
- UI state

## Shared Platform Layers

Target folders:

`src/core/platform`
`src/core/types`
`src/core/dealCopilot`
`src/core/reports`

Initial foundation files:

`src/core/platform/products.ts`
`src/core/types/deal.ts`
`src/core/types/risk.ts`
`src/core/types/scenario.ts`

## Integration Phases

### Phase 0: Stabilise production

Verify:

- Deploys
- Auth persistence
- Deal save/load
- Trades routes

### Phase 1: Foundation layer

Add:

- `docs/architecture.md`
- `docs/route-map.md`
- `src/core/platform/products.ts`
- Shared core types
- Canonical report engine

### Phase 2: Deal Copilot integration

Keep namespace:

`/deal-copilot/*`

Move logic into:

`src/core/dealCopilot`

Add:

- Deal to Project conversion
- Shared report metadata

### Phase 3: Shared dashboard/report layer

Unify:

- Deals
- Projects
- Reports
- Product-source metadata

### Phase 4: Refurb IQ integration

Add editable execution outputs:

- BOQ
- Cost plans
- Specs

### Phase 5: Repo retirement

Freeze donor repos.

Refurb Genius becomes the main platform.

## Current Safety Rules

- Do not introduce `/deals` yet.
- Do not break `/deal-copilot/*`.
- Do not revert TanStack underscore route filenames.
- Do not place UI-specific code in `src/core`.
- Do not remove RLS-backed authorization.
- Do not rely on client guards alone.
