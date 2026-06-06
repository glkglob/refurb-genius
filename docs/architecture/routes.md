# Route Inventory

> ⚠️ **DO NOT CHANGE ROUTE PATHS.** All URLs below are production-indexed and linked from Sentry,
> Vercel Analytics, and user-facing emails. A path rename is a breaking change requiring a redirect.

## Public Routes

No authentication required. These must **never** be wrapped in `RequireAuth` or `AppLayout`.

| Path             | File                            | Notes                                                       |
| ---------------- | ------------------------------- | ----------------------------------------------------------- |
| `/`              | `src/routes/index.tsx`          | Landing page. Uses `Navbar`.                                |
| `/auth`          | `src/routes/auth.tsx`           | Sign in / sign up / forgot password / reset. Uses `Navbar`. |
| `/auth/callback` | `src/routes/auth_.callback.tsx` | OAuth + PKCE callback. No layout wrapper.                   |
| `/privacy`       | `src/routes/privacy.tsx`        | Privacy policy. Uses `Navbar`.                              |
| `/terms`         | `src/routes/terms.tsx`          | Terms of service. Uses `Navbar`.                            |
| `/support`       | `src/routes/support.tsx`        | Support & contact. Uses `Navbar`.                           |
| `/trades`        | `src/routes/trades.tsx`         | Public trades marketplace listing. Uses `Navbar`.           |
| `/gallery`       | `src/routes/gallery.tsx`        | Public project gallery showcase. Uses `Navbar`.             |
| `/gallery/:slug` | `src/routes/gallery.$slug.tsx`  | Individual gallery project detail + investor lead capture.  |

## Authenticated Routes

All of these use `AppLayout` (which internally wraps `RequireAuth`).
Unauthenticated visitors are redirected to `/auth?redirect=<path>` and returned here after sign-in.

### Dashboard

| Path         | File                                                              |
| ------------ | ----------------------------------------------------------------- |
| `/dashboard` | `src/routes/_authed/dashboard.tsx` (protected by \_authed layout) |

### Projects

| Path                     | File                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `/projects/new`          | `src/routes/_authed/projects.new.tsx` (protected by \_authed layout) |
| `/projects/:id`          | `src/routes/_authed/projects.$id.index.tsx`                          |
| `/projects/:id/upload`   | `src/routes/_authed/projects.$id.upload.tsx`                         |
| `/projects/:id/estimate` | `src/routes/_authed/projects.$id.estimate.tsx`                       |
| `/projects/:id/analysis` | `src/routes/_authed/projects.$id.analysis.tsx`                       |
| `/projects/:id/report`   | `src/routes/_authed/projects.$id.report.tsx`                         |

### Deal Copilot

| Path                                | File                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `/deal-copilot`                     | `src/routes/_authed/deal-copilot/index.tsx`               |
| `/deal-copilot/new`                 | `src/routes/_authed/deal-copilot/new.tsx`                 |
| `/deal-copilot/:opportunityId`      | `src/routes/_authed/deal-copilot/$opportunityId.tsx`      |
| `/deal-copilot/:opportunityId/edit` | `src/routes/_authed/deal-copilot/$opportunityId.edit.tsx` |

### Trades (Authenticated sub-routes)

> The top-level `/trades` is **public** (browsing). Sub-routes (post, profile, job detail, edit)
> require authentication. TanStack Router's `trades_.*` naming creates flat routes that don't
> inherit from the public `trades` parent.

| Path                  | File                                  |
| --------------------- | ------------------------------------- |
| `/trades/new`         | `src/routes/trades_.new.tsx`          |
| `/trades/profile`     | `src/routes/trades_.profile.tsx`      |
| `/trades/:jobId`      | `src/routes/trades_.$jobId.tsx`       |
| `/trades/:jobId/edit` | `src/routes/trades_.$jobId_.edit.tsx` |

### Marketplace

| Path           | File                                 | Notes                                                                                         |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `/marketplace` | `src/routes/_authed/marketplace.tsx` | Trades marketplace for investors. Browse tradespeople, request quotes, favorite, and message. |

### Settings & Admin

| Path        | File                      | Notes                                                |
| ----------- | ------------------------- | ---------------------------------------------------- |
| `/settings` | `src/routes/settings.tsx` | User settings.                                       |
| `/admin`    | `src/routes/admin.tsx`    | Admin panel. Wrapped in `RequireAdmin` (role-gated). |

## Layout Components

| Component      | Purpose                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `AppLayout`    | Authenticated wrapper: `RequireAuth` + `Sidebar` + `MobileTopBar` + content area.                        |
| `RequireAuth`  | Shows loading spinner while session resolves. Redirects to `/auth?redirect=<path>` when unauthenticated. |
| `RequireAdmin` | Role check on top of `AppLayout`; used only for `/admin`.                                                |
| `Navbar`       | Public top-bar for unauthenticated pages. No auth dependency.                                            |

## Navigation Links

### Sidebar (authenticated, `src/components/Sidebar.tsx`)

| Label        | Path            |
| ------------ | --------------- |
| Dashboard    | `/dashboard`    |
| New Project  | `/projects/new` |
| Deal Copilot | `/deal-copilot` |
| Trades       | `/trades`       |
| Marketplace  | `/marketplace`  |
| Settings     | `/settings`     |

### Navbar (public, `src/components/Navbar.tsx`)

| Label        | Path                |
| ------------ | ------------------- |
| Dashboard    | `/dashboard`        |
| Deal Copilot | `/deal-copilot`     |
| Trades       | `/trades`           |
| Post Job     | `/trades/new`       |
| Sign in      | `/auth?mode=signin` |

## Route Protection Invariants

1. **`AppLayout` always enforces `RequireAuth`** — adding a new authenticated route means wrapping in `AppLayout`.
2. **Public routes must use `Navbar` or no layout** — never `AppLayout`.
3. **`/admin` requires both `AppLayout` and `RequireAdmin`** — do not remove either guard.
4. **Redirect preservation** — `RequireAuth` passes `?redirect=<path>` to `/auth` so users land back on their intended page after sign-in.
5. **Service role key** — `SUPABASE_SERVICE_ROLE_KEY` is server-only (`client.server.ts`). It must never be imported into client code. Verified: no `client.server` import exists in `src/` outside its own file.
