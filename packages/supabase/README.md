# @repo/supabase

Shared Supabase client factories for all projects in the monorepo.

This package provides framework-agnostic browser and server Supabase clients that can be used across:

- Refurb Genius
- Property Intelligence Platform
- Deal Copilot
- Refurb IQ

## Installation

```bash
pnpm add @repo/supabase
```

## Usage

### Browser Client

```ts
import { createBrowserSupabase } from "@repo/supabase/browser";
import type { Database } from "./generated/supabase-types"; // Your app's generated types

export const supabase = createBrowserSupabase<Database>({
  cookieName: "rg-auth", // Optional: defaults to 'sb-auth'
  cookieDomain: ".refurbgenius.info", // Optional
});
```

### Server Client (TanStack Start / SSR)

```ts
import { getCookies } from "@tanstack/react-start/server";
import { createServerSupabase } from "@repo/supabase/server";
import type { Database } from "./generated/supabase-types";

export async function getSupabase() {
  return createServerSupabase<Database>(getCookies());
}
```

### Token-based Client (for Edge Functions / API routes)

```ts
import { createTokenSupabase } from "@repo/supabase/server";
import type { Database } from "./generated/supabase-types";

const supabase = createTokenSupabase<Database>(accessToken);
```

### Environment Variables

The package supports multiple prefixes:

- `VITE_*` (Vite / TanStack Start)
- `NEXT_PUBLIC_*` (Next.js)
- Plain `SUPABASE_URL` / `SUPABASE_ANON_KEY`

You only need to set one pair.

## Package Structure

```
packages/supabase/
├── src/
│   ├── browser.ts     # createBrowserSupabase<DB>()
│   ├── server.ts      # createServerSupabase<DB>(), createTokenSupabase<DB>(), verifyToken<DB>()
│   ├── env.ts         # Environment variable resolution
│   └── index.ts
```

## Design Principles

- **Framework agnostic** — Works with TanStack Start, Next.js, Vite, etc.
- **Type-safe** — Accepts your generated `Database` type as a generic parameter.
- **Minimal** — Only provides client creation. Auth logic, middleware, and observability stay in the app.
- **Backward compatible** — Existing import paths in Refurb Genius continue to work.

## For New Projects

1. Add `@repo/supabase` as a dependency.
2. Generate your Supabase types (`supabase gen types typescript`).
3. Use `createBrowserSupabase<YourDatabase>()` and `createServerSupabase<YourDatabase>()`.
4. Configure cookie name/domain per project if needed.
