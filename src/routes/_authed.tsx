/**
 * Server-side protected layout route for TanStack Router + TanStack Start.
 *
 * @file src/routes/_authed.tsx
 *
 * This is a *pathless layout route* (the leading underscore makes the "/_authed"
 * segment invisible in the final URL). All routes whose files live "under"
 * _authed/ (via physical directory nesting or the `_authed.` naming convention
 * in flat files) become descendants of this route and inherit:
 *
 *   • the `beforeLoad` guard (runs on the server for every request)
 *   • the authenticated `user` object in route context
 *
 * WHY `beforeLoad` (NOT client-side guards or loaders)
 * ----------------------------------------------------
 * TanStack Router's `beforeLoad` is the official, SSR-first place to perform
 * authentication / authorization decisions. It executes:
 *
 *   1. During initial SSR on the Nitro server (cookies are present on the
 *      incoming request).
 *   2. On every client-side navigation (the call is sent to the server via
 *      the same `createServerFn` mechanism).
 *   3. During preload / data loading phases.
 *
 * If the guard throws a `redirect(...)`, the framework aborts the entire
 * render + data loading pipeline for the target route and performs the
 * redirect (server-side 302 during SSR, or client-side navigation after).
 *
 * This is fundamentally different from (and safer than):
 *   • `<RequireAuth>` (client-only, causes flash or hydration mismatch on
 *     hard refresh / deep link)
 *   • `useEffect` + `navigate` inside components
 *   • `loader` functions (which run *after* beforeLoad and are for data,
 *     not gating)
 *
 * The result: protected pages never render a single byte of their real
 * content (or execute their loaders) for unauthenticated users, even on
 * hard refresh or pasted deep links. No client bundle for the protected
 * tree is even needed in the failure case for the initial response.
 *
 * CONTEXT PROPAGATION
 * -------------------
 * Anything you `return` from `beforeLoad` is merged into the route's
 * `context` and is available (type-safely after route tree regeneration) to:
 *
 *   • The layout's own component via `Route.useRouteContext()`
 *   • Every descendant route's `beforeLoad`, `loader`, and component via
 *     `Route.useRouteContext()` (or the `useRouteContext` hook)
 *   • No extra `useAuth()` / serverFn round-trip is required inside the
 *     protected tree for the current user.
 *
 * Children can still call `useAuth()` for reactive updates, signOut, etc.
 * The route context user is the "zero-cost" view for the current match.
 *
 * USAGE AFTER MIGRATION
 * ---------------------
 * Inside any component rendered by a descendant route:
 *
 *   import { Route } from './$authedOrRelative';
 *   const { user } = Route.useRouteContext();
 *
 * Or, from a nested route file:
 *
 *   const { user } = Route.useRouteContext<{ user: AuthUser }>();
 *
 * TYPING
 * ------
 * We explicitly type the return of beforeLoad. After the router plugin
 * regenerates `routeTree.gen.ts`, the `FileRoutesByPath` / `AllContext`
 * declarations will automatically include `{ user: AuthUser }` for every
 * route whose parent chain goes through `/_authed`.
 */

import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { getCurrentUserServerFn } from "@/serverFns/auth";
import type { AuthUser } from "@/lib/auth";

/**
 * The shape we inject into the route context for all protected descendants.
 * Import this type from child routes when you need it for `useRouteContext`.
 */
export interface AuthedRouteContext {
  user: AuthUser;
}

export const Route = createFileRoute("/_authed")({
  /**
   * The server-side auth gate.
   *
   * Called for *this* route and every descendant. Runs in the exact same
   * request context that `createServerFn` handlers see (cookies available
   * via `@tanstack/react-start/server` + `@repo/supabase/server`).
   */
  beforeLoad: async ({ location }): Promise<AuthedRouteContext> => {
    // IMPORTANT: getCurrentUserServerFn is a `createServerFn`. Even when
    // invoked from here during client navigation, its `.handler()` body
    // executes on the server and can read the *current* request's cookies.
    // On true SSR (hard refresh, direct link, bot crawl, etc.) this runs
    // entirely on the server before any React component mounts.
    let user: AuthUser | null = null;
    try {
      const res = await getCurrentUserServerFn();
      user = res.user;
    } catch {
      // Treat any error reading the session (infra, bad/expired cookie that
      // causes getUser to error rather than null, etc.) as unauthenticated.
      // We redirect instead of letting the error escape to the route error
      // boundary (which produces the "Something went wrong" screen).
      user = null;
    }

    if (!user) {
      // Preserve the originally requested URL (pathname + search) so the
      // /auth page can redirect the user back after successful login.
      // This mirrors the behaviour of the legacy client-side <RequireAuth>.
      const currentFullPath = location.pathname + (location.searchStr || "");

      const search =
        currentFullPath && !currentFullPath.startsWith("/auth")
          ? { redirect: currentFullPath }
          : undefined;

      // `redirect` from @tanstack/react-router is the correct primitive.
      // It works identically during SSR (produces a server redirect) and on
      // the client (performs a history update). Never use `window.location`
      // or `navigate` inside beforeLoad.
      throw redirect({
        to: "/auth",
        search,
      });
    }

    // The returned object becomes part of the context for this match and all
    // nested matches. It is serialisable and safe to send to the client.
    return { user };
  },

  /**
   * Minimal shell. Because most authenticated pages wrap themselves with
   * <AppLayout> (which currently still contains the client <RequireAuth>
   * for the transition period), we only need to render <Outlet /> here.
   *
   * You can later hoist common authenticated chrome (e.g. a stricter
   * version of the sidebar) into this component if desired.
   */
  component: AuthedLayout,
});

function AuthedLayout() {
  // The user is guaranteed to exist here (beforeLoad already redirected
  // otherwise). Descendant components can read it via Route.useRouteContext()
  // without any further data fetching.
  return <Outlet />;
}

/* ========================================================================== */
/*                           MIGRATION GUIDE                                  */
/* ========================================================================== */

/**
 * MIGRATION GUIDE — Moving Routes Under the _authed Layout
 * =========================================================
 *
 * Goal: Make the server-side `beforeLoad` guard apply automatically to all
 * authenticated areas by placing their route definitions in the subtree of
 * the `/_authed` pathless layout.
 *
 * AFTER THE FILE IS CREATED (this one), perform the following steps.
 * The changes are mechanical and low-risk because:
 *   • All imports inside the moved files use the `@/` alias (no relative
 *     path breakage when the file moves one level deeper).
 *   • Only the `createFileRoute(...)` string argument changes (it must
 *     include the internal "/_authed" prefix so the generator wires the
 *     correct parent/child relationships).
 *   • Public URLs stay exactly the same (the underscore prefix is stripped
 *     by the router generator for pathless layouts).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 1. PROTECTED ROUTES THAT MUST MOVE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A. Flat files → move to `_authed/` dir and rename for generator
 *
 *    Current location                  → New location on disk
 *    --------------------------------------------------------------------
 *    src/routes/dashboard.tsx          → src/routes/_authed/dashboard.tsx
 *    src/routes/settings.tsx           → src/routes/_authed/settings.tsx
 *    src/routes/projects.new.tsx       → src/routes/_authed/projects.new.tsx
 *    src/routes/admin.tsx              → src/routes/_authed/admin.tsx
 *    (any future top-level authenticated pages)
 *
 *    Inside each moved file, change:
 *
 *        export const Route = createFileRoute("/dashboard")({
 *
 *    to:
 *
 *        export const Route = createFileRoute("/_authed/dashboard")({
 *
 *    (Same pattern for the others: "/_authed/settings", "/_authed/projects/new", "/_authed/admin")
 *
 * B. Deal Copilot subtree (already a directory — easiest)
 *
 *    Current: src/routes/deal-copilot/  (contains index.tsx, new.tsx, $opportunityId.tsx, $opportunityId.edit.tsx)
 *
 *    Action:
 *      mkdir -p src/routes/_authed/deal-copilot
 *      mv src/routes/deal-copilot/* src/routes/_authed/deal-copilot/
 *      rmdir src/routes/deal-copilot   (if empty)
 *
 *    Then, for *every* file inside the new location, prefix the createFileRoute string:
 *
 *      "/deal-copilot/"           → "/_authed/deal-copilot/"
 *      "/deal-copilot/new"        → "/_authed/deal-copilot/new"
 *      "/deal-copilot/$opportunityId" → "/_authed/deal-copilot/$opportunityId"
 *      "/deal-copilot/$opportunityId/edit" → "/_authed/deal-copilot/$opportunityId/edit"
 *
 *    The generator will strip "_authed" from the final URL path.
 *
 * C. Trades authenticated actions (the ones using the _ convention already)
 *
 *    Current files (all flat):
 *      src/routes/trades_.new.tsx
 *      src/routes/trades_.profile.tsx
 *      src/routes/trades_.$jobId.tsx
 *      src/routes/trades_.$jobId_.edit.tsx
 *
 *    These currently resolve to flat URLs /trades/new, /trades/profile etc.
 *    (The trailing _ on "trades_" tells the generator "do not create a layout
 *    nesting under /trades".)
 *
 *    Recommended new names (place them under the authed tree):
 *
 *      src/routes/_authed/trades_.new.tsx
 *      src/routes/_authed/trades_.profile.tsx
 *      src/routes/_authed/trades_.$jobId.tsx
 *      src/routes/_authed/trades_.$jobId_.edit.tsx
 *
 *    Update the createFileRoute strings inside them:
 *
 *      "/trades_/new"          → "/_authed/trades_/new"
 *      "/trades_/profile"      → "/_authed/trades_/profile"
 *      "/trades_/$jobId"       → "/_authed/trades_/$jobId"
 *      "/trades_/$jobId_/edit" → "/_authed/trades_/$jobId_/edit"
 *
 *    Public marketplace remains at the old location:
 *      src/routes/trades.tsx          (stays at root — public)
 *      src/routes/trades_.$jobId.tsx  (the public job view — decide per route)
 *
 *    NOTE: trades_.$jobId.tsx (the detail page) is currently used both for
 *    public browsing and for the authenticated "My jobs" links. You may
 *    choose to keep a public version at the root level and only protect the
 *    edit variant, or duplicate a thin public wrapper. The task reconnaissance
 *    flagged "trades_.* (some of them)".
 *
 * D. Projects detail pages (the $id family)
 *
 *    Current flat files:
 *      src/routes/projects.$id.index.tsx
 *      src/routes/projects.$id.upload.tsx
 *      src/routes/projects.$id.analysis.tsx
 *      src/routes/projects.$id.scope.tsx
 *      src/routes/projects.$id.estimate.tsx
 *      src/routes/projects.$id.report.tsx
 *
 *    These use the dot naming convention so the generator already treats
 *    them as children of a virtual "/projects/$id" parent.
 *
 *    Migration options (pick one):
 *
 *    Option 1 — "Authed projects" subtree (recommended for consistency)
 *      mkdir -p src/routes/_authed/projects
 *      mv src/routes/projects.$id.*.tsx src/routes/_authed/projects/
 *      (also move projects.new.tsx as shown in A)
 *
 *      Update every createFileRoute:
 *        "/projects/new"          → "/_authed/projects/new"
 *        "/projects/$id/"         → "/_authed/projects/$id/"
 *        "/projects/$id/upload"   → "/_authed/projects/$id/upload"
 *        ... (same for analysis, scope, estimate, report)
 *
 *    Option 2 — keep the projects.$id.* files at root level for now and
 *    manually add the guard inside each (less ideal, more duplication).
 *
 *    After moving, you can also consider consolidating the projects family
 *    into a real directory `projects/` under _authed if you want future
 *    shared layout logic for the project detail chrome.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 2. ROUTES THAT MUST STAY AT THE ROOT (PUBLIC OR SPECIAL)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   • src/routes/index.tsx
 *   • src/routes/auth.tsx
 *   • src/routes/auth_.callback.tsx
 *   • src/routes/trades.tsx                 (public marketplace)
 *   • src/routes/privacy.tsx
 *   • src/routes/terms.tsx
 *   • src/routes/support.tsx
 *   • (any future marketing / legal / unauthenticated landing pages)
 *
 * These must never be placed under _authed/ or they will become inaccessible
 * to logged-out visitors.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 3. POST-MOVE STEPS (MANDATORY)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   1. Delete or leave the old files in their original locations (the
 *      generator will ignore duplicates; clean them up).
 *
 *   2. Run the dev server or build:
 *        pnpm dev
 *      The `@tanstack/router-plugin` (via the TanStack Start Vite plugin)
 *      will automatically regenerate `src/routeTree.gen.ts`.
 *
 *   3. Verify the generated tree contains the new nesting:
 *        grep -n "_authed" src/routeTree.gen.ts
 *      You should see entries such as:
 *        '/_authed/dashboard'  with  getParentRoute: () => _authedRouteImport
 *        '/_authed/deal-copilot/...' etc.
 *
 *   4. Typecheck + lint:
 *        pnpm typecheck
 *        pnpm lint
 *
 *   5. Manual smoke test (the whole point of this layer):
 *      a. While logged out, hard-refresh (Cmd/Ctrl+Shift+R) any previously
 *         protected URL, e.g. /dashboard, /projects/new, /deal-copilot/new,
 *         /settings, a deep /projects/$id/..., /trades/new, etc.
 *         → You must be immediately redirected to /auth (or /auth?redirect=...)
 *         → No flash of protected content, no console errors about
 *           "You must be signed in" from inside the page.
 *      b. Log in from the redirect → you land back on the original deep URL.
 *      c. While logged in, hard-refresh a protected page → it renders
 *         immediately with the user from route context (no loading spinner
 *         from useAuth for the identity itself).
 *
 *   6. (Optional but recommended) Inside a newly protected leaf component
 *      you can now read the user without an extra hook call:
 *
 *        const { user } = Route.useRouteContext();
 *        // user is guaranteed non-null here
 *
 *      The old `useAuth()` calls can stay for `signOut`, `isLoading` of
 *      mutations, etc.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 4. CLEANUP OPPORTUNITIES (FUTURE, NOT PART OF THIS TASK)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   • Once every protected route is under _authed, the client-side
 *     `<RequireAuth>` inside `<AppLayout>` becomes a belt-and-suspenders
 *     safety net. You can later remove it (or make it a no-op when the
 *     route context already guarantees auth).
 *
 *   • The various manual `if (!user) navigate('/auth')` checks scattered
 *     in loaders/effects inside protected pages can be deleted.
 *
 *   • `RequireAdmin` can stay (it performs a second, role-based check on
 *     top of the basic authenticated user provided by this layout).
 *
 *   • Consider moving the `<AppLayout>` chrome itself into the _authed
 *     layout component so every protected page automatically gets the
 *     sidebar without repeating `<AppLayout>` in each leaf.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 5. ROLLBACK
 * ────────────────────────────────────────────────────────────────────────────
 *
 * If anything goes wrong, simply:
 *   • Move the files back to their original locations.
 *   • Revert the createFileRoute strings (remove the "/_authed" prefix).
 *   • Delete src/routes/_authed.tsx (and the now-empty _authed/ dir).
 *   • The old client-only RequireAuth behaviour is restored instantly.
 *
 * This change is fully additive and isolated.
 *
 * ==========================================================================
 */
