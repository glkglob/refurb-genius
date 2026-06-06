# APPLY_THIS.md — Critical Auth & Session Fix (TanStack Start + Supabase)

**Date:** 2026-05-25  
**Priority:** Critical — Blocks onboarding, project creation, Deal Copilot  
**Status:** All 5 agents have delivered complete, production-grade artifacts.

---

## Final Synthesised Implementation Plan

### Phase 1: Apply These Files First (No Breaking Changes — Safe to Land Immediately)

These files introduce the new server auth primitive and Query-backed client hook without touching any existing routes or flows.

1. **Create** `src/serverFns/auth.ts`  
   (Full content delivered by Agent 1 — the single source of truth for `getCurrentUserServerFn`, `requireUser()`, and `createSupabaseServerClient()`.)

2. **Replace** `src/hooks/useAuth.ts`  
   (Full content delivered by Agent 2 — now powered by TanStack Query + `useServerFn(getCurrentUserServerFn)` + legacy bridge.)

3. **Update** `src/routes/__root.tsx`  
   (Wrap the app with `<AuthProvider>` inside `QueryClientProvider`, outside `ThemeProvider` + `<Outlet />`. Full diff delivered by Agent 5.)

4. **Create** `LOGIN_LOGOUT.md` at repo root  
   (Full guide delivered by Agent 5 — documents the dual-layer pattern, when to invalidate `AUTH_USER_QUERY_KEY`, login page patterns, and gotchas.)

**Verification after Phase 1:**

- `pnpm typecheck && pnpm lint`
- Hard refresh on any public page — no breakage.
- `useAuth()` now returns correct values (with `isLoading`) on public and protected pages.

---

### Phase 2: Route Protection Layer

1. **Create** `src/routes/_authed.tsx`  
   (Full file + embedded Migration Guide delivered by Agent 3.)

2. **Follow the Migration Guide** (inside the file) to move protected routes under the `_authed/` subtree.

**Recommended order of migration (highest impact first):**

- `projects.new.tsx` → `/projects/new` (most visible broken flow)
- `deal-copilot/` subtree (the second audited broken flow)
- `settings.tsx`
- `dashboard.tsx`
- `projects.$id.*` family
- Authenticated trades routes (`trades_.new.tsx`, `trades_.profile.tsx`, etc.)

After each batch of moves:

- Run the TanStack Router plugin (it auto-regenerates `routeTree.gen.ts` on `pnpm dev` / build).
- Test hard refresh + direct navigation to the moved URLs while logged in.

**Important:** Public routes (`/`, `/auth*`, `/trades` (public marketplace), legal pages) must **never** move under `_authed`.

---

### Phase 3: Fix the Two Critical Broken Flows

These changes convert the two audited mutations to SSR-safe `createServerFn`s that always use `requireUser()`.

1. **Create** `src/serverFns/projects.ts`  
   (Full content from Agent 4 — contains `createProjectServerFn`.)

2. **Create** `src/serverFns/dealCopilot.ts`  
   (Full content from Agent 4 — contains `saveDealOpportunityServerFn`.)

3. **Apply minimal patches** (delivered by Agent 4):
   - `src/hooks/useProjects.ts` (only the `useCreateProject` mutation)
   - `src/core/dealCopilot/opportunityStore.ts` (only the `save()` method)

These patches keep the exact same React Query / store contracts so the UI (`projects.new.tsx`, `DealIntakeForm`, etc.) requires zero behavioural changes.

---

### Phase 4: Testing, Hardening & Optional Cleanup

- Regenerate route tree after all route moves.
- Run full verification script (see below).
- Gradually migrate other `auth.getUser()` + client `supabase` insert sites (`projectStore.create`, `useOpportunities.ts`, estimates, photos, scopeAnalysis, etc.).
- Once `_authed` migration is complete for a route, the old `<RequireAuth>` inside `AppLayout` becomes redundant for that subtree (can be removed later).
- Consider moving common authenticated chrome (`<AppLayout>`) into the `_authed` layout component.

---

## Testing & Verification Script (Founder / QA)

Run this after deploying the full set (or after each major phase).

```bash
# 1. Fresh build + type/lint
pnpm typecheck && pnpm lint

# 2. Start dev server (or use preview build)
pnpm dev
```

### Manual Auth Survival Tests (Critical)

**While logged OUT:**

- Hard refresh (Cmd/Ctrl + Shift + R) on `/projects/new` → should redirect cleanly to `/auth?redirect=/projects/new`
- Direct navigation (new tab or pasted URL) to `/deal-copilot/new` → same clean redirect
- No flash of protected content or "You must be signed in" errors inside the page

**While logged IN (after successful login + redirect back):**

- Hard refresh on `/projects/new` → page renders immediately with correct user (no "Checking session…" spinner from the old RequireAuth, or at most a very brief one from `isLoading` on mutations)
- Direct navigation / new tab to any protected route (`/settings`, `/dashboard`, a `/projects/$id/...`, `/deal-copilot/...`) → works without "You must be signed in"
- Fill + submit the New Project form → succeeds, creates project, navigates to detail
- Deal Copilot: Analyse deal → Save opportunity → succeeds and appears in list (no auth error)

**Cross-tab / state change tests:**

- Sign in in one tab → open protected page in another tab (hard refresh) → should see user
- Sign out in one tab → other tabs using `useAuth()` should reflect signed-out state (via the listener bridge)

**Technical smoke tests:**

- `useAuth()` in a public page (e.g. homepage or `/trades`) returns `{ user: null, isLoading, isAuthenticated: false }` gracefully.
- Sidebar still shows correct "Signed in as" when logged in.
- No infinite redirect loops.
- All AI features (which already used server auth) continue to work.

---

## Rollback Plan (Extremely Safe)

All changes are additive or isolated:

- Delete `src/serverFns/auth.ts`, `projects.ts`, `dealCopilot.ts`
- Revert `src/hooks/useAuth.ts` to previous version
- Revert `__root.tsx` (remove AuthProvider import + wrapper)
- Delete `src/routes/_authed.tsx` and move any relocated route files back to their original locations (revert the `createFileRoute` strings)
- Delete `LOGIN_LOGOUT.md` (optional)

The old client-only behaviour (`lib/auth.ts` + `RequireAuth`) is fully restored. No data loss.

---

## Summary of All Deliverables

| Agent | File(s) Delivered                                                                 | Status |
| ----- | --------------------------------------------------------------------------------- | ------ |
| 1     | `src/serverFns/auth.ts` (new)                                                     | Ready  |
| 2     | `src/hooks/useAuth.ts` (replacement)                                              | Ready  |
| 3     | `src/routes/_authed.tsx` (new + migration guide)                                  | Ready  |
| 4     | `src/serverFns/projects.ts`, `src/serverFns/dealCopilot.ts`, patches to 2 callers | Ready  |
| 5     | `src/routes/__root.tsx` (updated), `LOGIN_LOGOUT.md` (new)                        | Ready  |

---

**Next immediate action for the founder:**  
Apply **Phase 1** files first (they are completely safe), run typecheck/lint, then proceed to Phase 2 + 3 for the actual fix of the reported bugs.

This plan, executed in order, will make authentication survive direct URL navigation and hard refresh, and will make the two critical flows work reliably.

— Orchestrator Agent (synthesised from all 5 parallel agents)
