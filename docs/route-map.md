# Refurb Genius Route Map

## Route Convention

Refurb Genius uses TanStack Router file-based routing.

Use underscore filenames for flat URL routes that should not create nested layout behaviour.

## Public Routes

| URL              | Purpose                            | Route file                           |
| ---------------- | ---------------------------------- | ------------------------------------ |
| `/`              | Public landing/home                | `index.tsx` or equivalent root route |
| `/auth`          | Auth entry                         | `auth.tsx`                           |
| `/trades`        | Public trades marketplace browsing | `trades.tsx`                         |
| `/trades/$jobId` | Public trade job detail            | `trades_.$jobId.tsx`                 |

## Auth Routes

| URL                    | Purpose                        | Route file                |
| ---------------------- | ------------------------------ | ------------------------- |
| `/auth/callback`       | OAuth callback/session handoff | `auth_.callback.tsx`      |
| `/auth/reset-password` | Password reset destination     | Existing auth reset route |

## Authenticated Routes

| URL                                 | Purpose                          | Route file                               |
| ----------------------------------- | -------------------------------- | ---------------------------------------- |
| `/dashboard`                        | User dashboard                   | `_authed/dashboard.tsx` (under _authed layout) |
| `/deal-copilot`                     | Deal Copilot list/home           | `_authed/deal-copilot/index.tsx`         |
| `/deal-copilot/new`                 | New opportunity                  | `_authed/deal-copilot/new.tsx`           |
| `/deal-copilot/$opportunityId`      | Opportunity detail               | `_authed/deal-copilot/$opportunityId.tsx`|
| `/deal-copilot/$opportunityId/edit` | Edit opportunity                 | `_authed/deal-copilot/$opportunityId.edit.tsx` |
| `/trades/new`                       | Post trade job                   | `trades_.new.tsx`                        |
| `/trades/profile`                   | Trade profile onboarding/editing | `trades_.profile.tsx`                    |
| `/trades/$jobId/edit`               | Edit trade job                   | `trades_.$jobId_.edit.tsx`               |
| `/admin`                            | Admin workspace                  | `admin.tsx`                              |

## Confirmed Route Fixes

These route filenames are intentional and should not be renamed back:

| Old filename             | Correct filename           |
| ------------------------ | -------------------------- |
| `trades.new.tsx`         | `trades_.new.tsx`          |
| `trades.profile.tsx`     | `trades_.profile.tsx`      |
| `trades.$jobId.tsx`      | `trades_.$jobId.tsx`       |
| `trades.$jobId.edit.tsx` | `trades_.$jobId_.edit.tsx` |
| `auth.callback.tsx`      | `auth_.callback.tsx`       |

## Namespace Rules

### Deal Copilot

Keep all Deal Copilot routes under:

`/deal-copilot/*`

Do not introduce:

`/deals`
`/deals/*`

yet.

### Trades Marketplace

Keep public browsing available without auth:

`/trades`
`/trades/$jobId`

Require auth for:

`/trades/new`
`/trades/profile`
`/trades/$jobId/edit`

### Dashboard

Dashboard should remain the authenticated landing area for cross-product activity.

Future dashboard data should support:

- Deal Copilot opportunities
- Trades jobs
- Trade interests
- Projects
- Reports

## Auth Guard Rules

Do not redirect authenticated pages until Supabase session hydration has completed.

Expected auth states:

`loading`
`authenticated`
`unauthenticated`

Authenticated routes should only redirect after the state is known to be unauthenticated.

## Production Verification Checklist

After route changes, verify:

- `/`
- `/auth`
- `/auth/callback`
- `/dashboard`
- `/deal-copilot`
- `/deal-copilot/new`
- `/trades`
- `/trades/new`
- `/trades/profile`
- `/trades/$jobId`
- `/trades/$jobId/edit`

Also verify browser refresh directly on nested URLs.
