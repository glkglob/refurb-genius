# CLAUDE.md — Refurb Genius Development Guide

> Single source of truth for AI agents and contributors. Read fully before
> making changes.

---

## Project Overview

Refurb Genius is a property refurbishment estimation platform for UK property
investors. Users photograph rooms, AI analyses the photos (materials, condition,
dimensions), and the system generates scope-of-work documents and cost estimates.
The app also includes a Deal Copilot for evaluating property investment
opportunities and a Trades marketplace connecting investors with tradespeople.

**Maturity:** Late Alpha / Early Beta. Core features work end-to-end; test
coverage and UI package migration are the main gaps.

---

## Tech Stack

| Layer          | Technology                                              |
| -------------- | ------------------------------------------------------- |
| Framework      | TanStack Start (React 19 meta-framework)                |
| Build          | Vite 7 + Nitro (SSR/server preset)                     |
| Language       | TypeScript 5.8 (strict mode, ES2022 target)             |
| Styling        | Tailwind CSS v4 + Radix UI primitives                   |
| UI Components  | shadcn/ui pattern, migrating to `@repo/ui` package      |
| State          | TanStack Router (URL state) + React hooks               |
| Backend        | Supabase (Postgres, Auth, Storage, Edge Functions)      |
| AI             | OpenAI Vision (gpt-4o) via `createServerFn`             |
| Deployment     | Vercel (`vite.vercel.config.ts` + Nitro `vercel` preset)|
| Error Tracking | Sentry (`@sentry/react` + `@sentry/vite-plugin`)       |
| Monorepo       | pnpm workspaces + Turborepo                             |
| CI             | GitHub Actions (typecheck + lint + build + invariants)  |
| Validation     | Zod (runtime schema validation on all external data)    |

---

## Repository Structure

```
refurb-genius/
├── src/                          # Main application source
│   ├── routes/                   # TanStack file-based routes (26 files)
│   │   └── deal-copilot/         # Deal Copilot sub-routes (4 files)
│   ├── components/               # App-level components (23 files)
│   │   └── ui/                   # UI shim layer (46 files) — re-exports from @repo/ui
│   ├── core/                     # Domain logic
│   │   ├── ai/                   # Photo analysis pipeline (OpenAI Vision)
│   │   │   ├── server/           # Server-only AI code (*.server.ts)
│   │   │   └── serverFns.ts      # createServerFn wrappers
│   │   ├── dealCopilot/          # Deal evaluation engine
│   │   ├── pricing/              # Pricing authority and trade rates
│   │   ├── projects/             # Project domain logic
│   │   ├── trades/               # Trades marketplace logic
│   │   └── ...                   # roi, reports, property, config, constants
│   ├── hooks/                    # React hooks (data fetching, auth, state)
│   ├── integrations/supabase/    # Auto-generated types — DO NOT edit or import
│   ├── lib/                      # Shared utilities (logger, sentry, analysis)
│   ├── services/                 # Service boundary layer
│   ├── router.tsx                # TanStack Router setup
│   ├── server.ts                 # Nitro server entry
│   ├── routeTree.gen.ts          # Auto-generated — DO NOT edit
│   └── styles.css                # Global styles + Tailwind v4 config
├── packages/                     # Monorepo workspace packages (see below)
├── supabase/
│   ├── functions/                # Deno Edge Functions
│   └── migrations/               # SQL migration files (11 migrations)
├── tests/invariants/             # Invariant test suite (6 tests)
├── docs/                         # Architecture docs, audits, operations
├── scripts/                      # Admin/bootstrap scripts
├── vite.vercel.config.ts         # Vercel-specific Vite config
├── vercel.json                   # Vercel deployment settings
└── turbo.json                    # Turborepo task config
```

---

## Workspace Packages

Eight packages under `packages/`, following a strict one-way dependency flow:

```
Application Shell (root src/)
    ▲
    │
@repo/services      Business logic engines
    ▲
    │
@repo/core           Constants, utilities, mock data
    ▲
    │
@repo/types          Domain types, DTOs (no runtime deps)
```

| Package                  | What it owns                                   |
| ------------------------ | ---------------------------------------------- |
| `@repo/types`            | Domain types, DTOs, contracts. Zero deps.      |
| `@repo/core`             | Constants, formatting, mock data, utilities    |
| `@repo/services`         | Pure business logic (pricing, ROI, deals)      |
| `@repo/ui`               | Shared UI components (17 migrated of 46)       |
| `@repo/supabase`         | Supabase client factories (browser + server)   |
| `@repo/integrations`     | Reserved — not yet used                        |
| `@repo/eslint-config`    | Shared ESLint configuration                    |
| `@repo/typescript-config` | Shared tsconfig base files                    |

**Dependency rule:** Lower packages cannot import from higher ones.
`@repo/types` imports nothing. `@repo/core` imports only `@repo/types`.
`@repo/services` imports `@repo/core` + `@repo/types`. The root app imports all.
See `docs/architecture/dependency-rules.md` for the full matrix.

---

## Key Conventions

### Imports & Path Aliases

The `tsconfig.json` defines these path aliases:

```
@/*              → ./src/*
@repo/types      → packages/types/src
@repo/core       → packages/core/src
@repo/ui         → packages/ui/src               (barrel export)
@repo/ui/*       → packages/ui/src/components/*   (direct component import)
@repo/services   → packages/services/src
@repo/supabase   → packages/supabase/src
@repo/supabase/* → packages/supabase/src/*
```

### Server Functions

Use `createServerFn` from `@tanstack/react-start` for all server-side logic.
Always validate input with `.inputValidator()` and Zod:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ id: z.string().min(1) });

export const myServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();  // Always verify auth first
    // Server-only code here
  });
```

**Do NOT use `"use server"` directives.** TanStack Start uses `createServerFn` instead.

### Server Auth Pattern

```ts
async function requireServerAuth(): Promise<void> {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@repo/supabase/server");
  const supabase = createServerSupabase(getCookies());
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
}
```

### Logging

Use the structured logger from `@/lib/logger`, never raw `console.log`:

```ts
import { logger } from "@/lib/logger";
logger.info("Processing analysis", { projectId, roomId });
logger.error("Analysis failed", { error: err.message });
```

Sentry captures errors separately (`@/lib/sentry`). The logger provides
non-error diagnostics.

### Error Handling

- Wrap server functions in try/catch with Sentry breadcrumbs
- AI pipeline uses graceful fallbacks: if OpenAI fails, return a fallback
  analysis with `source: "fallback"` (never crash the request)
- Use Zod for runtime validation of all external data

---

## UI System Rules

### Migration State

The UI is migrating from local `src/components/ui/` to `packages/ui/src/components/`.
Currently **17 of 46** components are migrated to `@repo/ui`.

### Import Rules

1. **App components** import from `@repo/ui` (or `@repo/ui/<component>` for
   components involved in circular deps through the barrel — currently
   tooltip, dialog, and any component imported by sidebar):
   ```ts
   import { Button, Card } from "@repo/ui";
   import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@repo/ui/tooltip";
   import { Dialog, DialogContent, DialogTrigger } from "@repo/ui/dialog";
   import { Input } from "@repo/ui/input";           // used by sidebar
   import { Separator } from "@repo/ui/separator";   // used by sidebar
   import { Skeleton } from "@repo/ui/skeleton";      // used by sidebar
   ```

2. **Shim files** in `src/components/ui/` re-export from `@repo/ui` for backward
   compatibility:
   ```ts
   export { Button } from "@repo/ui";
   ```

3. **When migrating a component**: move it to `packages/ui/src/components/`,
   export it from `packages/ui/src/index.ts`, then replace the shim with a
   re-export. Never delete shim files — replace their contents.

4. **Tailwind v4 source directive**: `src/styles.css` includes
   `@source "../packages/ui/src/**/*"` so Tailwind scans the shared package.

### Component Pattern

All UI components follow the shadcn/ui + Radix pattern:

- Radix primitives for accessibility and behavior
- `class-variance-authority` (cva) for variant styling
- `cn()` utility (from `@repo/ui/lib/utils`) for class merging (clsx + tailwind-merge)

---

## Supabase & Data Rules

### Client Factories

`@repo/supabase` provides subpath exports for different contexts:

| Context      | Import                                              |
| ------------ | --------------------------------------------------- |
| Browser/hook | `createBrowserSupabase` from `@repo/supabase/browser` |
| Server fn    | `createServerSupabase` from `@repo/supabase/server`   |
| Token-based  | `createTokenSupabase` from `@repo/supabase/server`    |
| Env helpers  | `resolveSupabaseEnv` from `@repo/supabase/env`        |

Or import everything from the root: `from "@repo/supabase"`.

### Critical Rules

1. **NEVER** import from `@/integrations/supabase/*` in app code. That directory
   contains auto-generated types only. Use `@repo/supabase` or hooks.

2. **Server auth** — always use `createServerSupabase` + `getCookies()` in
   server functions, **never** `createBrowserSupabase`:
   ```ts
   const { getCookies } = await import("@tanstack/react-start/server");
   const { createServerSupabase } = await import("@repo/supabase/server");
   const supabase = createServerSupabase(getCookies());
   ```

3. **RLS is enforced** on all tables. Every query runs through row-level
   security policies. Never bypass RLS or use the service role key in client code.

4. **Edge Functions** live in `supabase/functions/` and run on Deno. They are
   separate from TanStack `createServerFn` server functions.

---

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server
pnpm typecheck            # Type-check (tsc --noEmit)
pnpm lint                 # Lint (ESLint + Prettier)
pnpm format               # Auto-format (Prettier)
pnpm build:vercel         # Production build for Vercel
pnpm test:invariants      # Run invariant tests
pnpm admin:bootstrap      # Bootstrap admin user
```

### Pre-commit Checklist

Before every commit, run:

```bash
pnpm typecheck && pnpm lint && pnpm test:invariants
```

CI runs these same checks. A PR will not merge if any fail.

**Important:** Use `pnpm build:vercel` (not `pnpm build`) for deployment builds.
The Vercel config uses `vite.vercel.config.ts` which adds Nitro with the
`vercel` preset.

---

## Testing & Verification

### Invariant Tests

Six invariant tests in `tests/invariants/` validate architectural rules:

| Test                             | What it checks                              |
| -------------------------------- | ------------------------------------------- |
| `auth-env.invariant.test.ts`     | Auth environment configuration              |
| `dealScore.test.ts`              | Deal scoring algorithm correctness          |
| `pricing-authority.test.ts`      | Pricing authority data integrity            |
| `pricing.invariant.test.ts`      | Pricing calculation invariants              |
| `routes.invariant.test.ts`       | Route files exist and match docs            |
| `scoring.invariant.test.ts`      | Scoring algorithm invariants                |

Run with: `pnpm test:invariants`

These use Node's built-in test runner via `tsx`. No Jest or Vitest.

### CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs two jobs on every push and PR:

1. **ci** — `pnpm install` → `typecheck` → `lint` → `build:vercel`
2. **invariant-tests** — `pnpm install` → `pnpm test:invariants`

Node 22, pnpm 9.

---

## Git & PR Workflow

- **Branch naming:** `<type>/<short-description>` (e.g., `feat/deal-copilot`,
  `fix/auth-redirect`, `chore/ui-migration`)
- **Commit messages:** Short imperative summary explaining the "why"
- **PR body:** Use `## Summary` + `## Test plan` format
- **Keep commits focused:** Do not bundle features with refactors, or mix
  archive/docs cleanup with UI migration or feature work
- **Never force-push to main**
- **Always run `pnpm typecheck && pnpm lint`** before pushing
- **Prefer small, safe changes** — easier to review and revert

---

## Agent Safety Rules

1. **Never modify generated files** — `src/integrations/supabase/types.ts` and
   `src/routeTree.gen.ts` are auto-generated. Edit migrations (for Supabase) or
   routes (for the route tree) and regenerate.

2. **Never use `any`** — Use `unknown` with type guards or proper generics.
   The codebase has strict mode enabled.

3. **Never use `console.log`** — Use `logger` from `@/lib/logger`.

4. **Never import Supabase client directly** in components. Use hooks or the
   service layer. Never expose the service role key in frontend code.

5. **Never commit `.env` files** or hardcode secrets.

6. **Preserve the shim layer** — Don't delete `src/components/ui/` files during
   migration. Replace their contents with re-exports from `@repo/ui`.

7. **Test before committing** — Run `pnpm typecheck && pnpm lint && pnpm test:invariants`.

8. **Don't create new packages** without discussing architecture first.

9. **Don't change route paths** — All URLs are production-indexed and linked from
   Sentry, Vercel Analytics, and user emails. A path rename requires a redirect.
   See `docs/architecture/routes.md`.

10. **Don't add `define` blocks for `VITE_*` vars** in Vite configs — Vite
    auto-injects them. A manual `define` block overrides injection and can
    inline `"undefined"` at build time.

---

## Common Mistakes to Avoid

| Mistake                                         | Correct Approach                                         |
| ----------------------------------------------- | -------------------------------------------------------- |
| `import { supabase } from "@/integrations/..."` | Use `@repo/supabase` or hooks                            |
| `createBrowserSupabase` in a server function    | `createServerSupabase(getCookies())`                     |
| `console.log("debug")`                          | `logger.debug("message", { context })`                   |
| `from "@repo/ui"` for Tooltip or Dialog         | `from "@repo/ui/tooltip"` / `from "@repo/ui/dialog"`    |
| Importing directly from Radix in app code       | Import from `@repo/ui` which wraps Radix                 |
| Deleting a UI shim file                         | Replace contents with `export { X } from "@repo/ui"`     |
| Using `key={index}` in dynamic lists            | Use a stable unique identifier                            |
| Skipping Zod on server function input           | Always use `.inputValidator()` with Zod `.parse()`       |
| Adding `"use server"` directive                 | TanStack Start uses `createServerFn`, not directives      |
| Running `pnpm build` for deployment             | Use `pnpm build:vercel` (uses `vite.vercel.config.ts`)   |
| Mixing feature + cleanup in one commit          | Split into separate focused commits                       |
| Editing `src/routeTree.gen.ts`                  | Auto-generated by TanStack Router — never edit            |

---

## Next Recommended Improvements

These are the most impactful items to work on next, in priority order:

1. **Complete UI migration** — 29 of 46 components still need migrating from
   `src/components/ui/` to `@repo/ui`. High-value targets: `sidebar.tsx`,
   `sheet.tsx`, `dropdown-menu.tsx`, `command.tsx`.

2. **Add component tests** — No component-level tests exist yet. Add Vitest +
   React Testing Library for critical flows (auth, photo upload, estimate
   generation).

3. **Consolidate remaining `@/integrations/supabase` imports** — `src/lib/auth.ts`
   and `src/services/supabase/index.ts` still import from the deprecated path.
   Route through `@repo/supabase` instead.

4. **Add error boundary** — The root layout (`__root.tsx`) has no React error
   boundary. Add one wrapping the `<Outlet />` to prevent white-screen crashes.

5. **Expand invariant tests** — Cover the UI migration state (e.g., assert that
   all migrated shims are pure re-exports) and package boundary rules.
