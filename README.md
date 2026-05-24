# Refurb Genius

Refurb Genius is a property refurbishment analysis platform built with **TanStack Start**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Supabase**.

This repository is a **pnpm workspace monorepo**. The active application runtime lives in the root `src/` directory, with shared logic extracted into workspace packages under `packages/`.

## Stack
- TanStack Start + Vite
- React 19 + TypeScript
- Tailwind CSS
- Supabase
- pnpm workspaces

> **Note:** This is a TanStack Start application. It is **not** a Next.js project.

## Repository Layout
src/                  → Main TanStack Start application
packages/
core/               → Shared constants and utilities
services/           → Shared deterministic business logic
types/              → Shared types and contracts
ui/                 → Shared UI components
supabase/           → Shared Supabase clients and helpers
integrations/       → Shared integration boundaries
eslint-config/      → Shared ESLint config
typescript-config/  → Shared TypeScript config
supabase/             → Database migrations, policies, and Edge Functions
docs/                 → Architecture and product documentation
tests/invariants/     → Invariant and contract tests
ios/                  → Capacitor iOS project

## Workspace Packages
- `@repo/types` — Shared domain types and contracts
- `@repo/core` — Shared constants and framework-light utilities
- `@repo/services` — Shared deterministic business logic (pricing, ROI, etc.)
- `@repo/ui` — Shared UI components
- `@repo/supabase` — Shared Supabase environment and client helpers
- `@repo/integrations` — Shared integration adapters
- `@repo/eslint-config` — Shared linting configuration
- `@repo/typescript-config` — Shared TypeScript configuration

## Key Architecture Principles
- Financial and investment calculations must remain **deterministic** (code-driven).
- AI is used to assist with analysis and drafting, but should **not** be treated as the source of truth for pricing, ROI, or profit calculations.
- OpenAI keys and Supabase service role keys must remain **server-only**. Never expose them with `VITE_` prefixes.
- Prefer importing from `@repo/*` packages for shared logic.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build for production
pnpm build
```

## Environment Variables

Copy `.env.example` and configure the required values.

**Browser-safe variables** (can use `VITE_` prefix):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Server-only variables** (must not use `VITE_`):

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

## Documentation

Start with:

- `docs/README.md`
- `docs/architecture/overview.md`
- `docs/architecture/dependency-rules.md`
- `docs/architecture/package-boundaries.md`

## Contributing

- Keep changes small and reversible.
- Follow existing patterns and respect package boundaries.
- Run `pnpm typecheck` and `pnpm lint` before committing significant changes.
- Update documentation when architecture or behavior changes.