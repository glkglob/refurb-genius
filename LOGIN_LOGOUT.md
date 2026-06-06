# Login / Logout Patterns (Dual-Layer Auth)

## Overview

During the migration to TanStack Query-backed auth:

- **Legacy layer**: `src/lib/auth.ts` → the `auth` singleton. Performs the actual Supabase calls (its `signIn` method wraps `signInWithPassword`; also `signOut`, `signUp`, OAuth, password flows), maintains in-memory state + `onChange` listeners. **This is still the correct place to trigger all auth mutations.**

- **New layer**: `src/hooks/useAuth.ts` → `useAuth()` hook + exported `AUTH_USER_QUERY_KEY` + `<AuthProvider>`. Powered by TanStack Query (`useQuery` + `getCurrentUserServerFn` for cookie-based, SSR-safe reads) plus an automatic sync bridge that listens to the legacy singleton.

`<AuthProvider>` is mounted once at the very root of the React tree (inside `QueryClientProvider`, around `ThemeProvider` + `<Outlet />` in `src/routes/__root.tsx`). This means `useAuth()` is safe to call from **any** route — public (`/`, `/auth`, `/trades`, legal pages, etc.) or protected — and will always gracefully return:

```ts
{
  user: AuthUser | null,
  isLoading: boolean,
  isAuthenticated: boolean,
  hydrated: boolean,   // legacy alias for !isLoading
  signOut: () => Promise<void>,
  refetch: () => Promise<AuthUser | null>,
  ...
}
```

On first mount (including hard refresh or deep link) it performs a real server round-trip via the cookie-aware server function.

## Performing `signInWithPassword` / sign-in and `signOut`

**Always perform the actual authentication action through the legacy singleton.**

```ts
import { auth } from "@/lib/auth"; // ← the mutation layer
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";

// Example inside a form handler (recommended pattern for /auth.tsx)
const qc = useQueryClient();

const user = await auth.signIn(email, password); // does Supabase signInWithPassword internally + fires listeners
// Immediately reflect the result in the Query cache (instant UI update everywhere)
qc.setQueryData(AUTH_USER_QUERY_KEY, user);

// For sign-out the hook provides a convenience wrapper:
const { signOut } = useAuth();
await signOut(); // internally: auth.signOut() + sets cache to null
// (You can also call auth.signOut() directly and let the bridge handle it.)
```

**Do not** call `supabase.auth.signInWithPassword(...)` directly from components or forms. It bypasses the listener notifications that keep the two layers in sync.

`auth.signOut()` (and the hook's wrapper) also handle the Supabase call + listener notification + cache clearing.

## How and when to invalidate `AUTH_USER_QUERY_KEY`

```ts
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_USER_QUERY_KEY } from "@/hooks/useAuth";

const qc = useQueryClient();

// After any operation that may have changed the session:
await qc.invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY });

// Or for zero-round-trip optimistic update when you have the user object:
qc.setQueryData(AUTH_USER_QUERY_KEY, newUserOrNull);
```

**When to do it:**

- Immediately after a successful `auth.signIn` / `auth.signUp` in your login UI (see above) — gives the best post-login experience.
- In OAuth callback handlers or after password reset / email verification flows (where the listener may not have fired in the current tab).
- After any custom server action that touches auth state.
- The automatic bridge (`useEffect` + `auth.onChange` inside every `useAuth()` call) usually keeps things in sync for normal `auth.*` calls, but explicit `setQueryData` / `invalidateQueries` is the robust, documented escape hatch.

The query config (`staleTime: 5min`, `refetchOnWindowFocus`, etc.) means you rarely need background refetches, but you almost always want a manual update right after a login/logout you just performed.

## Recommended patterns for login pages (`/auth.tsx`)

The current implementation in `src/routes/auth.tsx` (using `auth.signIn`, `auth.signUp`, etc. directly) is **correct and should be kept** during the transition.

Enhancements for the best experience:

1. Import and use `useQueryClient` + `AUTH_USER_QUERY_KEY` (or just call `useAuth()` for its side-effects) in the page.
2. After a successful mutation, `setQueryData` before (or instead of) navigating.
3. Optionally render `<AuthPage>` with a `useAuth()` call (you can ignore the value) so the listener bridge is guaranteed to be subscribed on the login page itself. Then the notification from `auth.signIn` will populate the cache before you navigate away.

Example sketch (add to the existing component):

```ts
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_USER_QUERY_KEY, useAuth } from "@/hooks/useAuth";

// at top of AuthPage
const qc = useQueryClient();
useAuth(); // ensures bridge is active here (safe on public route)

// in success path after await auth.signIn(...)
qc.setQueryData(AUTH_USER_QUERY_KEY, user);
navigate({ to: destination });
```

After the redirect, destination pages that call `useAuth()` will see the freshly written value instantly (or fall back to a fast server-validated fetch).

For the callback route (`auth_.callback.tsx`) prefer `invalidateQueries` because the session may have been established by a redirect flow.

## Gotchas with the dual-layer auth during the transition

- **"No listeners at the moment of sign-in"**: If you sign in from a page that currently mounts zero `useAuth()` consumers, the `auth.onChange` notifications have nowhere to go. The subsequent navigation will cause the new page to run the query (which succeeds via cookies). Explicit `qc.setQueryData` after the call (or mounting the hook on the login page) eliminates any flash of `isLoading`.
- **Legacy `hydrated` vs new `isLoading`**: They are aliases (`hydrated = !isLoading`). Existing `<RequireAuth>` and other guards continue to work unchanged.
- **Multiple subscriptions**: Every component calling `useAuth()` installs its own listener. Harmless (idempotent `setQueryData`), but the root `<AuthProvider>` guarantees the bridge is always present for the app lifetime.
- **Synchronous vs async reads**: `auth.getUser()` (legacy) is synchronous but may be stale relative to the Query cache right after a cross-tab sign-in. Prefer `useAuth()` in React components.
- **ServerFns and beforeLoad still authoritative**: `_authed.tsx` and all protected `createServerFn`s use `getCurrentUserServerFn` / `requireUser` directly. `useAuth()` is the convenient client mirror.
- **OAuth / magic links / password recovery**: These flows often involve full-page redirects. Always `invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY })` on the callback/landing page.
- **Future cleanup**: Once all call sites are comfortable, we can evaluate whether the legacy singleton's in-memory `currentUser` can be slimmed down or whether `lib/auth.ts` should delegate more to the Query layer.

## Summary cheat sheet

| Goal                              | Recommended code                                                              |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Sign the user in                  | `const u = await auth.signIn(e, p); qc.setQueryData(AUTH_USER_QUERY_KEY, u);` |
| Sign the user out                 | `const { signOut } = useAuth(); await signOut();` (or direct + set null)      |
| Read user anywhere (incl. public) | `const { user, isLoading, isAuthenticated } = useAuth();`                     |
| Force a fresh server check        | `await qc.invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY });`              |
| Inside a serverFn                 | `const { user } = await getCurrentUserServerFn();` or `requireUser()`         |

See also (primary sources):

- `src/hooks/useAuth.ts` — the hook, `AuthProvider`, `AUTH_USER_QUERY_KEY`, and extensive JSDoc
- `src/lib/auth.ts` — all mutation implementations and the listener system
- `src/serverFns/auth.ts` — `getCurrentUserServerFn`, `requireUser`, server client creation
- `src/routes/_authed.tsx` — server-side protection via `beforeLoad`
- `src/routes/auth.tsx` — current login UI (the canonical example)

This dual-layer design gives us instant client feedback, full backward compatibility, and true hard-refresh / SSR safety with minimal disruption during the transition.
