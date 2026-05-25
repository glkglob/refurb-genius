# CLAUDE.md — Refurb Genius Development Guide

> This file is the single source of truth for AI agents and contributors
> working in this repository. Read it fully before making changes.

---

## Project Overview

Refurb Genius is a property refurbishment estimation platform. Users photograph
rooms, AI analyses the photos (materials, condition, dimensions), and the system
generates scope-of-work documents and cost estimates. The app also includes a
Deal Copilot for evaluating property investment opportunities.

**Maturity:** Late Alpha / Early Beta. Core features work end-to-end; test
coverage and UI package migration are the main gaps.

---

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Framework        | TanStack Start (React 19 meta-framework)           |
| Build            | Vite                                               |
| Language         | TypeScript (strict mode, ES2022 target)            |
| Styling          | Tailwind CSS v4 + Radix UI primitives              |
| UI Components    | shadcn/ui pattern, migrating to `@repo/ui` package |
| State            | TanStack Router (URL state) + React hooks           |
| Backend          | Supabase (Postgres, Auth, Storage, Edge Functions) |
| AI               | OpenAI Vision (gpt-4o) via server functions        |
| Deployment       | Vercel (with `vite.vercel.config.ts`)              |
| Error Tracking   | Sentry (source maps uploaded via @sentry/vite-plugin) |
| Monorepo         | pnpm workspaces                                    |
| CI               | GitHub Actions (typecheck + lint + build + invariant tests) |

---

## Repository Structure

```
refurb-genius/
├── src/                          # Main application source
│   ├── routes/                   # TanStack file-based routes (26 files)
│   ├── components/               # App-level components (32 files)
│   │   └── ui/                   # UI shim layer (46 files) — re-exports from @repo/ui
│   ├── core/                     # Domain logic
│   │   ├── ai/                   # Photo analysis pipeline (OpenAI Vision)
│   │   │   ├── server/           # Server-only AI code (openAiVision.server.ts)
│   │   │   ├── serverFns.ts      # createServerFn wrappers
│   │   │   ├── mockAnalysis.ts   # Mock/template data
│   │   │   └── photoAnalysis.ts  # Client-facing analysis API
│   │   ├── dealCopilot/          # Deal evaluation engine
│   │   ├── estimates/            # Cost estimation logic
│   │   └── pricing/              # Pricing authority and trade rates
│   ├── hooks/                    # React hooks (data fetching, auth)
│   ├── integrations/supabase/    # Generated Supabase types (DO NOT import directly)
│   ├── lib/                      # Shared utilities (logger, analysis helpers, cn)
│   ├── services/                 # Service boundary layer
│   └── styles.css                # Global styles + Tailwind v4 config
├── packages/                     # Monorepo workspace packages
│   ├── core/                     # Shared domain logic
│   ├── eslint-config/            # Shared ESLint configuration
│   ├── integrations/             # External service integrations
│   ├── services/                 # Shared service layer
│   ├── supabase/                 # Supabase client factories (browser + server)
│   ├── types/                    # Shared TypeScript types
│   ├── typescript-config/        # Shared tsconfig bases
│   └── ui/                       # Shared UI component library (17 migrated)
├── supabase/                     # Supabase project config
│   ├── functions/                # Edge Functions (Deno)
│   └── migrations/               # SQL migration files
├── tests/invariants/             # Invariant test suite (6 tests)
├── docs/                         # Architecture and operations docs
└── scripts/                      # Admin/bootstrap scripts
```

---

## Key Conventions

### Imports & Path Aliases

The `tsconfig.json` defines these path aliases:

```
@/*             → ./src/*
@repo/types     → packages/types/src
@repo/core      → packages/core/src
@repo/ui        → packages/ui/src          (barrel export)
@repo/ui/*      → packages/ui/src/components/*  (direct component import)
@repo/services  → packages/services/src
@repo/supabase  → packages/supabase/src
@repo/supabase/* → packages/supabase/src/*
```

### Server Functions

Use `createServerFn` from `@tanstack/react-start` for all server-side logic:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const myServerFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    // Server-only code here
  });
```

### Logging

Use the structured logger from `@/lib/logger`, never raw `console.log`:

```ts
import { logger } from "@/lib/logger";
logger.info("Processing analysis", { projectId, roomId });
logger.error("Analysis failed", { error: err.message });
```

Sentry captures errors separately. The logger provides non-error diagnostics.

### Error Handling

- Wrap server functions in try/catch with Sentry breadcrumbs
- AI pipeline uses graceful fallbacks: if OpenAI fails, return a fallback
  analysis with `source: "fallback"` (never crash the request)
- Use Zod for runtime validation of all external data

---

## UI System Rules

### Migration State

The UI is migrating from local `src/components/ui/` to `packages/ui/src/components/`.
Currently 17 of 46 components are migrated to `@repo/ui`.

### Import Rules

1. **App components** should import from `@repo/ui` (or `@repo/ui/<component>` for
   tooltip/dialog to avoid circular deps):
   ```ts
   import { Button, Card, Input } from "@repo/ui";
   import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@repo/ui/tooltip";
   import { Dialog, DialogContent, DialogTrigger } from "@repo/ui/dialog";
   ```

2. **Shim files** in `src/components/ui/` are re-export bridges for backward
   compatibility. They look like:
   ```ts
   export { Button } from "@repo/ui";
   ```

3. **When migrating a component**: move it to `packages/ui/src/components/`,
   add it to `packages/ui/src/index.ts`, then replace the shim with a re-export.

4. **Tailwind v4 source directive**: `src/styles.css` includes
   `@source "../../packages/ui/src/**/*"` so Tailwind scans the shared package.

### Component Pattern

All UI components follow the shadcn/ui + Radix pattern:

- Radix primitives for accessibility and behavior
- `class-variance-authority` (cva) for variant styling
- `cn()` utility (from `@repo/ui`) for class merging (clsx + tailwind-merge)

---

## Supabase & Data Rules

### Client Usage

| Context      | Import                                           |
| ------------ | ------------------------------------------------ |
| Browser/hook | `createBrowserSupabase` from `@repo/supabase`    |
| Server fn    | `createServerSupabase` from `@repo/supabase`     |
| Token-based  | `createTokenSupabase` from `@repo/supabase`      |

### Critical Rules

1. **NEVER** import from `@/integrations/supabase/*` in app code. That directory
   contains generated types only. Use the service layer or `@repo/supabase`.

2. **Server auth** pattern — always use `createServerSupabase` + `getCookies()`
   in server functions, **never** `createBrowserSupabase`:
   ```ts
   import { createServerSupabase } from "@repo/supabase";
   import { getCookies } from "@tanstack/react-start/server";

   const supabase = createServerSupabase(getCookies());
   ```

3. **RLS is enforced** on all 11 tables. Every query runs through row-level
   security policies. Do not bypass RLS or use the service role key in client code.

4. **Edge Functions** live in `supabase/functions/` and run on Deno. They are
   separate from TanStack server functions.

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Type-check (runs tsc --noEmit)
pnpm typecheck

# Lint (ESLint)
pnpm lint

# Format (Prettier)
pnpm format

# Build for Vercel
pnpm build:vercel

# Run invariant tests
pnpm test:invariants

# Bootstrap admin user
pnpm admin:bootstrap
```

### Pre-commit Checklist

Before committing, always run:

```bash
pnpm typecheck && pnpm lint && pnpm test:invariants
```

CI runs these same checks. A PR will not merge if any fail.

---

## Testing & Verification

### Invariant Tests

Six invariant tests in `tests/invariants/` validate architectural rules:

| Test                             | What it checks                                |
| -------------------------------- | --------------------------------------------- |
| `auth-env.invariant.test.ts`     | Auth environment configuration                |
| `dealScore.test.ts`              | Deal scoring algorithm correctness             |
| `pricing-authority.test.ts`      | Pricing authority data integrity               |
| `pricing.invariant.test.ts`      | Pricing calculation invariants                 |
| `routes.invariant.test.ts`       | Route file structure and naming conventions    |
| `scoring.invariant.test.ts`      | Scoring algorithm invariants                   |

Run with: `pnpm test:invariants`

These use Node's built-in test runner via `tsx`. No Jest or Vitest.

### CI Pipeline

GitHub Actions runs two jobs on every push and PR:

1. **ci** — `pnpm install` → `typecheck` → `lint` → `build:vercel`
2. **invariant-tests** — `pnpm install` → `pnpm test:invariants`

---

## Git & PR Workflow

- **Branch naming**: `<type>/<short-description>` (e.g., `feat/deal-copilot`, `fix/auth-redirect`, `chore/ui-migration`)
- **Commit messages**: Short imperative summary (1-2 sentences) explaining the "why"
- **PR body**: Use `## Summary` + `## Test plan` format
- **Split unrelated changes** into separate commits (don't bundle features with refactors)
- **Never force-push to main**
- **Always run `pnpm typecheck && pnpm lint`** before pushing

---

## Agent Safety Rules

1. **Never modify generated files** — `src/integrations/supabase/types.ts` is
   auto-generated. Edit migrations instead and regenerate.

2. **Never use `any`** — Use `unknown` with type guards or proper generics.
   The codebase has strict mode enabled.

3. **Never use `console.log`** — Use `logger` from `@/lib/logger`.

4. **Never import Supabase client directly** in components. Go through hooks
   or service layers.

5. **Never commit `.env` files** or hardcode secrets.

6. **Preserve the shim layer** — Don't delete `src/components/ui/` files during
   migration. Replace their contents with re-exports from `@repo/ui`.

7. **Test before committing** — Run `pnpm typecheck && pnpm lint && pnpm test:invariants`.

8. **Don't create new packages** without discussing architecture first.

---

## Common Mistakes to Avoid

| Mistake                                       | Correct Approach                                        |
| --------------------------------------------- | ------------------------------------------------------- |
| `import { supabase } from "@/integrations/..."` | Use `@repo/supabase` or service layer                 |
| `createBrowserClient` in a server function    | Use `createServerSupabase(getCookies())`                |
| `console.log("debug")`                        | `logger.debug("message", { context })`                  |
| `from "@repo/ui"` for Tooltip or Dialog       | `from "@repo/ui/tooltip"` / `from "@repo/ui/dialog"`   |
| Importing directly from Radix in app code     | Import from `@repo/ui` which wraps Radix                |
| Deleting a UI shim file                       | Replace contents with `export { X } from "@repo/ui"`    |
| Using `key={index}` in dynamic lists          | Use a stable unique identifier                           |
| Skipping Zod validation on server function input | Always use `.validator(schema)` on `createServerFn`  |
| Adding `"use server"` directive               | TanStack Start uses `createServerFn`, not directives     |
| Running `pnpm build` for deployment           | Use `pnpm build:vercel` (uses `vite.vercel.config.ts`)  |
