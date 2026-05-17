Build out the admin panel with user management and platform stats.

## Context

The admin route is `src/routes/admin.tsx`. Currently it contains only:

```tsx
<h1>Admin</h1>
<p>Platform administration panel.</p>
```

The `RequireAuth` and `RequireAdmin` guards are already correct — only admins reach this page.

Admin role is managed via `src/lib/role.ts` and `src/hooks/useRole.ts`.

Supabase tables in scope (from `src/integrations/supabase/types.ts`):

- `profiles` — user profiles (check if it exists in the types file)
- `projects` — refurbishment projects
- `trades_jobs` — posted trade jobs
- `trades_job_interests` — interest registrations
- `deal_opportunities` — Deal Copilot opportunities

The `supabase` client is imported from `src/integrations/supabase/client.ts`. For admin queries that need to read across all users (not just the current user), the admin page must use service-role-level access OR query aggregate data that the anon/auth role can read.

Since client code only has the anon key, scope the stats to queries that work with RLS. If a query returns empty due to RLS, note it with a comment and implement what is possible.

## What to build

### Section 1 — Platform Stats

A row of `MetricCard` components (already exists at `src/components/MetricCard.tsx`) showing:

- Total projects (count of `projects` table rows the current admin user can read)
- Total trades jobs (count of `trades_jobs`)
- Total interests (count of `trades_job_interests`)
- Total deals (count of `deal_opportunities`)

Fetch these with `supabase.from("table").select("id", { count: "exact", head: true })`.

### Section 2 — Recent Projects

A simple table listing the 10 most recent projects: name, address, status, created_at.

Use the existing `EstimateTable` component if it fits, or a plain HTML table with Tailwind styling matching the existing app style (navy/slate/white, rounded card).

### Section 3 — User List (Best Effort)

If a `profiles` table exists in `src/integrations/supabase/types.ts`, show a table of recent user signups: email/name, created_at, role.

If the `profiles` table does not exist or is not readable, render a card that says "User management requires a `profiles` table with RLS policy allowing admin reads. See docs/architecture.md for setup." Do NOT crash or show an error toast.

### Section 4 — Layout

Wrap all sections in `AppLayout` (already used by other authenticated pages). Use `title="Admin"` and `subtitle="Platform overview and user management."`.

Structure:

```
<AppLayout title="Admin" subtitle="...">
  <div className="space-y-8">
    {/* Stats row */}
    {/* Recent Projects */}
    {/* User List */}
  </div>
</AppLayout>
```

Remove the `RequireAuth` / `RequireAdmin` wrappers from inside the component — instead wrap the entire `AdminPage` return in them (keeping the existing guard logic, just tidying the structure).

## Rules

- Only change `src/routes/admin.tsx`
- Do NOT add new libraries
- Do NOT change the guard components
- Use existing `MetricCard`, `LoadingState`, `EmptyState` components from `src/components/`
- Use existing Tailwind classes and card styles consistent with the dashboard page (`src/routes/dashboard.tsx`) — read that file for reference before writing admin.tsx
- Run `npx tsc --noEmit` — must pass with zero errors
- Run `npm run format` before committing
- Commit: `feat: expand admin panel with platform stats and recent activity`
