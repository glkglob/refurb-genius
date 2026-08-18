# AGENTS.md — Refurb Genius Development Guide

> Primary governance authority for AI coding agents and contributors. Read
> fully before making changes.
>
> Explicitly declared locked architecture specifications and operational
> runbooks remain authoritative within their own scope (for example IA-0,
> `docs/architecture/FEATURE_SLICE.md`, `docs/architecture/ai-platform.md`,
> and `docs/operations/database-delivery-model-b.md`). On conflict, the
> stricter current architecture, security, or governance rule wins.

---

## Governed AI Agent Execution

These rules apply to Grok Build, Jules, and any other coding agent.

### Authority

- Read and record the governing `AGENTS.md` from the verified task-start SHA
  before mutation.
- That pinned task-start `AGENTS.md` remains authority for the entire active
  task.
- Edits to `AGENTS.md` during the active task do not change authority for that
  task, grant new permission, or authorise additional mutation, publication, or
  later phases.
- A current explicitly authorised phase/task may narrow scope further.
- On conflict, the stricter current architecture/security/governance rule wins.
- Never infer authority to begin a later phase.

### Repository identity

For governed work:

- verify branch and expected BASE/HEAD before mutation;
- STOP on relevant baseline, branch, candidate, PR-head, or unexpected
  working-tree drift;
- evidence for one SHA does not certify another SHA;
- never rebase, amend, force-push, or squash unless explicitly authorised by
  the current phase;
- never bypass repository-required GitHub checks; no phase may waive them.

### Mutation

- Use one mutating agent per isolated candidate.
- Parallel agents should normally be read-only investigators/reviewers.
- Do not modify paths outside the explicit task allowlist.
- Do not expand frozen `src/lib`, `src/hooks`, `src/services`, governance,
  migration, schema, or dependency scope without explicit authority.

### Publication

Unless the current phase explicitly authorises it:

- do not commit;
- do not push;
- do not create or update a PR;
- do not resolve review threads;
- do not merge.

Before publication or merge of a candidate:

- every repository-required GitHub check must PASS on the exact final candidate
  HEAD SHA;
- checks from an earlier SHA do not certify a later SHA;
- after the candidate mutates, previous check evidence is invalid for
  publication.

Immediately before merge, all currently active repository and ruleset
requirements must be satisfied, including where configured:

- exact-head required checks;
- required review-thread resolution;
- required approvals;
- conflict / mergeability requirements;
- up-to-date branch requirements.

Merge authorisation becomes stale and is invalid if, before merge:

- the PR head changes;
- the relevant base changes;
- required checks regress;
- review state materially changes;
- repository or ruleset requirements materially change.

No phase may bypass these requirements.

A CI failure in a governed phase means:
classify → report → STOP.

Do not automatically repair and republish a failed governed candidate unless a
separate repair phase explicitly authorises mutation.

### Secrets and external systems

Never expose or use any secret, token, private key, credential, private API
key, signing credential, or privileged database credential without explicit
current-phase authority when such use is legitimately required. Examples
include (non-exhaustive):

- Supabase service-role/private credentials;
- Production database credentials;
- Apple signing certificates or App Store Connect private keys;
- unrestricted deployment credentials;
- administrator/end-user production credentials;
- private API keys and similar service tokens.

Never include secret VALUES in logs, console output, reports/completion
evidence, artifacts, generated diagnostics, or committed files unless the
repository explicitly defines a safe fixture.

Public client credentials (for example legitimate Supabase public/anon/
publishable keys) are not service-role/private secrets, but still require
responsible handling under task-specific security rules.

Development agents must not treat Production, signing, or release authority as
implicit.

### Platform validation

Cloud/Linux agent validation can certify TypeScript, tests, invariants, lint,
Vercel builds, and compatible Capacitor web builds.

It cannot by itself certify:

- Xcode/macOS build behaviour;
- iOS Simulator runtime behaviour;
- Keychain runtime behaviour;
- ASWebAuthenticationSession behaviour;
- code signing;
- TestFlight;
- real-device iOS behaviour.

Those require the separately authorised macOS/iOS validation phase.

### Completion

Every governed task must finish with:

- verdict;
- repository identity;
- branch;
- BASE SHA;
- final HEAD SHA;
- changed paths;
- validation/check results, each bound to the exact SHA they cover;
- blockers/follow-up;
- recommended next phase;
- explicit STOP.

Do not automatically execute the next phase.

---

## Project Overview

Refurb Genius is a property refurbishment estimation platform for UK property investors. Users photograph rooms, AI analyses the photos (materials, condition, dimensions), and the system generates scope-of-work documents and cost estimates. The app also includes a Deal Copilot for evaluating property investment opportunities and a Trades marketplace connecting investors with tradespeople.

**Maturity:** Late Alpha / Early Beta. Core features work end-to-end; test coverage and UI package migration are the main gaps.

**Current AI:** Pure TS serverFns + OpenAI (gpt-4o) only. Railway/Python backend fully decommissioned (see docs/architecture/ai-platform.md). The native mobile API foundation does not move AI workloads off this serverFn authority; privileged native AI endpoints require the separately authorised 2C-2 phase.

---

## IA workflow programme

For IA-1 through IA-10, read and follow:

`docs/architecture/workflow/ia-0-workflow-authority-spec.md`

IA-0 is the **LOCKED** canonical workflow contract (Version **1.0.1**).

Controlling journey: **Photos → Analysis → Redesign → Estimate → Export**.

Implementations **MUST NOT** introduce conflicting workflow, Scope, provenance, resolver, entitlement or navigation semantics.

If implementation requires changing a locked IA-0 rule, **stop** and request architecture review rather than modifying it implicitly.

IA-1 (Shared Project Workflow Shell) is **Completed** on main.

IA-2 (Canonical Next-Action Resolver) is **Completed** on main (`resolveProjectNextAction` in Projects domain).

IA-3 (Photos → Analysis Continuity) is **Completed** on main (durable photo catalogue + Analysis currentness + resolver adapters).

IA-4 (First-Class Redesign) is **Completed** on main (`/projects/$id/redesign`, atomic selection, write-path seal, schema reconcile).

IA-5 (Full Five-Stage Continuity) is **Completed** on main (PR #117; verified implementation head `81299098f730340062c3e662a07b06b95a22c533`; merge `21ce580a225a44614c63414c3382f561d640ec95`; migrations `20260808120000` / `20260808130000` / `20260808140000`; production Estimate authority + Export snapshot + `view_completed_project` re-verified under IA-5-MR1).

IA-6 (Dashboard + Overview Continuation) is **Completed** on main (PR #119; verified head `02e802ccc837ad26b63d65e82582ea84c9fa05c6`; merge `2d83375209e266e5953e0edd71de3e8b16a92574`; no migrations). Dashboard and Overview consume canonical five-stage workflow + resolver; legacy progress flags are non-authoritative on those surfaces; transient running state is project-scoped and non-authoritative.

IA-7 (Global Navigation Convergence) is **Completed** on main.

IA-8 is **Completed** on main.

**Programme status (current):**

```text
IA-0 through IA-8 = COMPLETE

IA-9 = PLANNED / NOT AUTHORISED

IA-10 = PLANNED / NOT AUTHORISED

Current programme mode =
CONTROLLED PUBLIC BETA + OBSERVATION
```

Do **not** begin IA-9 or IA-10 without fresh explicit owner authority.

---

## iOS 2C programme

```text
IOS-READINESS-2C-1 = COMPLETED
Native authenticated HTTP transport foundation
(PR #149; candidate 4fa52d9696068dea2ad93aa1faecb572f29088b2;
 merge 9c6fd68166481ecbacef5f2850c399ca5efba577)

NOT implicitly authorised:
  2C-HARDENING
  2C-3 native data-path consumer wiring
  2C-2 privileged AI mobile APIs
  2C-4 Simulator / runtime verification
```

Do **not** begin 2C-HARDENING, 2C-2, 2C-3, or 2C-4 without fresh explicit
owner authority. Completing 2C-1 does not encode an execution order for those
phases.

---

## Production Database Delivery — Model B

Canonical runbook: `docs/operations/database-delivery-model-b.md` (**IN FORCE**).

```text
Supabase GitHub Integration:
  Deploy to production = OFF   (must remain OFF under Model B)
  Automatic branching  = ON    (PR Preview rehearsal)

MERGE TO MAIN
≠
PRODUCTION DATABASE APPLY
```

- A repository merge does **not** authorise or apply Production database migrations.
- **DB-MIGRATION PRs** (changes under `supabase/migrations/**`) require the Model B pre-merge gate in the runbook.
- Production DB apply is a **distinct** owner-authorised phase (`db-release` or equivalent) after merge and merged-main verification.
- Production project hard gate: `sxhzjmzfkgbogmlsbeju`. Preview refs never support Production claims.
- Applied migration history is immutable; rollback is normally a **forward repair** migration.

---

## Tech Stack

| Layer          | Technology                                               |
| -------------- | -------------------------------------------------------- |
| Framework      | TanStack Start (React 19 meta-framework)                 |
| Build          | Vite 7 + Nitro (SSR/server preset)                       |
| Language       | TypeScript 5.8 (strict mode, ES2022 target)              |
| Styling        | Tailwind CSS v4 + Radix UI primitives                    |
| UI Components  | shadcn/ui pattern, migrating to `@repo/ui` package       |
| State          | TanStack Router (URL state) + React hooks                |
| Backend        | Supabase (Postgres, Auth, Storage, Edge Functions)       |
| AI             | OpenAI Vision (gpt-4o) via `createServerFn`              |
| Deployment     | Vercel (`vite.vercel.config.ts` + Nitro `vercel` preset) |
| Error Tracking | Sentry (`@sentry/react` + `@sentry/vite-plugin`)         |
| Monorepo       | pnpm workspaces + Turborepo                              |
| CI             | GitHub Actions (typecheck + lint + build + invariants)   |
| Validation     | Zod (runtime schema validation on all external data)     |

---

## Repository Structure

```
refurb-genius/
├── src/
│   ├── features/                 # ★ Vertical slices (canonical home for new product work)
│   │   ├── estimate|ai-upload|ai-design|roi|feasibility|…
│   │   └── each: domain/ application/ infrastructure/ presentation/ index.ts
│   ├── platform/                 # Vendor SDK seams (browser vs server entrypoints)
│   ├── routes/                   # Thin TanStack file routes (delegate to slices)
│   ├── components/               # App shell + UI composition (shims → @repo/ui)
│   ├── core/ · lib/ · hooks/ · services/ · serverFns/  # Transitional (frozen)
│   ├── integrations/supabase/    # Generated types — DO NOT hand-edit
│   ├── server.ts · router.tsx · styles.css
│   └── routeTree.gen.ts          # Auto-generated — DO NOT edit
├── packages/                     # @repo/* shared kernel (types, core, services, ui, supabase)
├── supabase/                     # Migrations + Edge Functions
├── tests/invariants/             # Architecture gates (feature-slice, freeze, security, …)
├── docs/architecture/            # FEATURE_SLICE.md is source of truth for request flow
└── …
```

**Request flow (required for new work):**

```
Route → feature presentation → application → domain
    → infrastructure adapter → platform / @repo/*
```

**Platform principle:** Applications own product workflows (`src/features/*`). Shared packages own reusable capabilities (`packages/*` / `@repo/*`). Do **not** extract app features into packages “just in case.” Future apps compose packages; they never import this app’s features.

Docs: `platform-architecture-plan.md` · `package-registry.md` · `package-promotion.md` · `capability-boundaries.md` · `platform-glossary.md` (under `docs/architecture/`).

Do **not** put new domain logic in `src/lib/`, `src/hooks/`, or `src/services/` unless it is genuinely cross-cutting (and on the freeze allowlist). Details: `docs/architecture/FEATURE_SLICE.md`, `src/features/README.md`.

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

| Package                   | What it owns                                 |
| ------------------------- | -------------------------------------------- |
| `@repo/types`             | Domain types, DTOs, contracts. Zero deps.    |
| `@repo/core`              | Constants, formatting, mock data, utilities  |
| `@repo/services`          | Pure business logic (pricing, ROI, deals)    |
| `@repo/ui`                | Shared UI components (17 migrated of 46)     |
| `@repo/supabase`          | Supabase client factories (browser + server) |
| `@repo/integrations`      | Reserved — not yet used                      |
| `@repo/eslint-config`     | Shared ESLint configuration                  |
| `@repo/typescript-config` | Shared tsconfig base files                   |

**Dependency rule:** Lower packages cannot import from higher ones. `@repo/types` imports nothing. `@repo/core` imports only `@repo/types`. `@repo/services` imports `@repo/core` + `@repo/types`. The root app imports all. See `docs/architecture/dependency-rules.md` for the full matrix.

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

### Server Functions (web default)

Web server operations normally use `createServerFn` from `@tanstack/react-start`. Always validate input with `.inputValidator()` and Zod. Authenticate with `requireUser()` from `src/serverFns/auth.server.ts` via a dynamic import inside the handler. Existing serverFn CSRF in `src/start.ts` (`handlerType === "serverFn"`) remains in force.

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ id: z.string().min(1) });

export const myServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/serverFns/auth.server");
    await requireUser();
    // Server-only web code here
  });
```

**Do NOT use `"use server"` directives.** TanStack Start uses `createServerFn` instead.

This is **not** a licence for arbitrary REST or ad-hoc HTTP endpoints.

### Native privileged mobile API (governed exception)

The merged iOS architecture has one explicit exception to the serverFn default:

- lives only under `/api/mobile/v1/*`;
- is intercepted in `src/server.ts` and handled by `handleMobileApiRequest`;
- is **not** a TanStack serverFn and must not use `/_serverFn`;
- must not weaken or bypass web serverFn CSRF;
- authenticates with `requireMobileBearer` → `verifyToken`;
- identity comes only from the verified token (`resolveAuthoritativeUserId` ignores body/query `userId`);
- new `/api/mobile/v1/*` endpoints require explicit governed phase authority.

### Web and native auth authorities

These authorities must never be bridged.

**Web**

- `createServerSupabase(getCookies(), { cookieName: "pip-auth" })`
- `requireUser()` — no Bearer fallback
- browser Supabase singleton for web clients
- TanStack serverFns + existing serverFn CSRF

**Native**

- data plane: `getNativeSupabase()` / `getPlatformSupabase()` → native user JWT + RLS
- control plane: `nativeAuthenticatedFetch` / `nativeAuthenticatedJson` → HTTPS `resolveProductionApiOrigin()` from `VITE_PUBLIC_URL` → `Authorization: Bearer`
- server: `requireMobileBearer` + `verifyToken`; `createTokenSupabase` only after verified Bearer

**Prohibit**

- native session → pip-auth / `document.cookie` synthesis
- body or query `userId` as identity
- service-role credential on device
- Bearer fallback inside `requireUser()`
- mixing native and web session authority
- Capacitor `server.url`

### iOS / Capacitor architecture

- iOS is a Capacitor static SPA shell. App origin is `capacitor://localhost`.
- `capacitor.config.ts` has no `server.url`; the app uses the local `webDir` bundle only.
- Authorised native packaging is `pnpm prepare:ios` (IOS-BUILD-PROVENANCE-1). `pnpm build:ios` alone is not a certifiable artefact.
- Prepare records source SHA + effective `VITE_PUBLIC_URL` origin + build identity, then `cap copy ios`, then verifies the copied webDir file map. `cap sync ios` is plugin-update only.
- `VITE_PUBLIC_URL` must be supplied explicitly in the process environment (Production HTTPS or an explicit HTTPS Preview origin). Missing/blank/non-HTTPS values fail before Vite. There is no Production-only hostname allowlist.
- Provenance is `ios-build-provenance.json` (SHA-256 file map; no secrets; timestamps are not authority). `pnpm ios:verify-copied` checks `ios/App/App/public`. `pnpm ios:verify-app-bundle -- --app <App.app>` checks a local packaged `App.app` only — it does not certify a physical device install.
- Generated and packaged Capacitor config must not contain `server.url`.
- Native auth is Keychain-backed Supabase (`getNativeSupabase`).
- Native data plane uses PostgREST / Storage under the native user JWT and RLS.
- Native privileged control plane uses HTTPS Production + Bearer user token.
- Canonical Production API origin is `VITE_PUBLIC_URL` via `resolveProductionApiOrigin` (HTTPS-only).
- Mobile API namespace is `/api/mobile/v1/*` (canary `POST /api/mobile/v1/session/ping` via `pingNativeMobileSession`).
- Web pip-auth / serverFn authority remains separate.
- The mobile API does not authorise duplicating arbitrary serverFns as REST.
- Foundation helpers `listProjectsNative` / `createProjectNative` exist and are **not** consumer-wired (`useProjects` / `createProjectServerFn` remain web).
- New mobile endpoints require explicit governed phase authority.

### Logging

Use the structured logger from `@/lib/logger`, never raw `console.log`:

```ts
import { logger } from "@/lib/logger";
logger.info("Processing analysis", { projectId, roomId });
logger.error("Analysis failed", { error: err.message });
```

Sentry captures errors separately (`@/lib/sentry`). The logger provides non-error diagnostics.

### Error Handling

- Wrap server functions in try/catch with Sentry breadcrumbs
- AI pipeline uses graceful fallbacks: if OpenAI fails, return a fallback analysis with `source: "fallback"` (never crash the request)
- Use Zod for runtime validation of all external data

---

## UI System Rules

### Migration State

The UI is migrating from local `src/components/ui/` to `packages/ui/src/components/`. Currently **17 of 46** components are migrated to `@repo/ui`.

### Import Rules

1. **App components** import from `@repo/ui` (or `@repo/ui/<component>` for components involved in circular deps through the barrel — currently tooltip, dialog, and any component imported by sidebar):

   ```ts
   import { Button, Card } from "@repo/ui";
   import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@repo/ui/tooltip";
   import { Dialog, DialogContent, DialogTrigger } from "@repo/ui/dialog";
   import { Input } from "@repo/ui/input"; // used by sidebar
   import { Separator } from "@repo/ui/separator"; // used by sidebar
   import { Skeleton } from "@repo/ui/skeleton"; // used by sidebar
   ```

2. **Shim files** in `src/components/ui/` re-export from `@repo/ui` for backward compatibility:

   ```ts
   export { Button } from "@repo/ui";
   ```

3. **When migrating a component**: move it to `packages/ui/src/components/`, export it from `packages/ui/src/index.ts`, then replace the shim with a re-export. Never delete shim files — replace their contents.

4. **Tailwind v4 source directive**: `src/styles.css` includes `@source "../packages/ui/src/**/*"` so Tailwind scans the shared package.

### Component Pattern

All UI components follow the shadcn/ui + Radix pattern:

- Radix primitives for accessibility and behavior
- `class-variance-authority` (cva) for variant styling
- `cn()` utility (from `@repo/ui/lib/utils`) for class merging (clsx + tailwind-merge)

---

## Supabase & Data Rules

### Client Factories

`@repo/supabase` provides subpath exports for different contexts:

| Context      | Import                                                |
| ------------ | ----------------------------------------------------- |
| Browser/hook | `createBrowserSupabase` from `@repo/supabase/browser` |
| Server fn    | `createServerSupabase` from `@repo/supabase/server`   |
| Token-based  | `createTokenSupabase` / `verifyToken` from `@repo/supabase/server` |
| Env helpers  | `resolveSupabaseEnv` from `@repo/supabase/env`        |

Or import everything from the root: `from "@repo/supabase"`.

Native app selection: `getPlatformSupabase()` / `getNativeSupabase()` in `src/platform/supabase/`. Token-based server clients (`createTokenSupabase`, `verifyToken`) are valid only after verified Bearer authentication under the governed `/api/mobile/v1/*` architecture.

### Critical Rules

1. **NEVER** import from `@/integrations/supabase/*` in app code. That directory contains auto-generated types only. Use `@repo/supabase` or hooks.

2. **Web serverFn auth** — always use `createServerSupabase` + `getCookies()` (pip-auth) in server functions, **never** `createBrowserSupabase`:

   ```ts
   const { getCookies } = await import("@tanstack/react-start/server");
   const { createServerSupabase } = await import("@repo/supabase/server");
   const supabase = createServerSupabase(getCookies(), { cookieName: "pip-auth" });
   ```

3. **RLS is enforced** on all tables. Every query runs through row-level security policies. Never bypass RLS or use the service role key in client or native-device code. Native direct Supabase operations use the native user JWT and RLS. Server-side service-role access remains separately governed and cannot be inferred from mobile Bearer auth.

4. **Edge Functions** live in `supabase/functions/` and run on Deno. They are separate from TanStack `createServerFn` server functions and from `/api/mobile/v1/*`.

5. **Migrations must be idempotent.** All `CREATE POLICY` (and recent `CREATE TABLE` / `CREATE INDEX` / `ADD COLUMN`) statements use `IF NOT EXISTS` guards or the `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_policies ...) THEN CREATE POLICY ...` pattern. This prevents "already exists" errors during `supabase db push`, `supabase db reset`, re-deploys, or when replaying on existing DBs. Never add bare `create policy "..."` in new migrations.

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

Default before every commit:

```bash
pnpm typecheck && pnpm lint && pnpm test:invariants
```

An explicitly authorised narrow phase may use **candidate-scoped lint** locally when full-repository `pnpm lint` (`eslint .`) is disproportionately expensive. Candidate-scoped lint must pass on the exact candidate. This never waives `pnpm typecheck`, `pnpm test:invariants`, or repository-required exact-head CI. A phase cannot silently choose scoped lint unless its authority permits it. Full repository lint and other GitHub-required checks must still pass before merge.

**Important:** Use `pnpm build:vercel` (not `pnpm build`) for deployment builds. The Vercel config uses `vite.vercel.config.ts` which adds Nitro with the `vercel` preset. Vercel install is locked with `--frozen-lockfile` (see vercel.json) and package.json has `"packageManager": "pnpm@9.15.9"` + cleaned pnpm-workspace.yaml + .npmrc for stable lockfile (no more pnpmfileChecksum mismatches).

---

## Testing & Verification

### Invariant Tests

Invariant tests in `tests/invariants/` validate architectural rules. Run with: `pnpm test:invariants`.

These use Node's built-in test runner via `tsx`.

### CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:

1. **ci** — `pnpm install --frozen-lockfile` → `typecheck` → `lint` → `build:vercel`
2. **invariant-tests** — `pnpm install --frozen-lockfile` → `pnpm test:invariants`

- Exact pnpm 9.15.9 (via `packageManager` field + action-setup + .npmrc guidance)
- Node 22 (CI)
- Vercel uses `installCommand: "pnpm install --frozen-lockfile"` (vercel.json)

---

## Git & PR Workflow

- **Branch naming:** `<type>/<short-description>` (e.g., `feat/deal-copilot`, `fix/auth-redirect`, `chore/ui-migration`)
- **Commit messages:** Short imperative summary explaining the "why"
- **PR body:** Use `## Summary` + `## Test plan` format
- **Keep commits focused:** Do not bundle features with refactors, or mix archive/docs cleanup with UI migration or feature work
- **Never force-push to main**
- **Always run `pnpm typecheck && pnpm lint`** before pushing (see the governed candidate-scoped lint exception above)
- Immediately before merge, re-satisfy the Publication merge-revalidation rules (exact-head checks, thread resolution, approvals, mergeability, up-to-date branch). Merge authorisation is stale if those change.
- **Prefer small, safe changes** — easier to review and revert

---

## Agent Safety Rules

1. **Never modify generated files** — `src/integrations/supabase/types.ts` and `src/routeTree.gen.ts` are auto-generated. Edit migrations (for Supabase) or routes (for the route tree) and regenerate.

2. **Never use `any`** — Use `unknown` with type guards or proper generics. The codebase has strict mode enabled.

3. **Never use `console.log`** — Use `logger` from `@/lib/logger`.

4. **Never import Supabase client directly** in components. Use hooks or the service layer. Never expose the service role key in frontend code.

5. **Never commit `.env` files** or hardcode secrets.

6. **Preserve the shim layer** — Don't delete `src/components/ui/` files during migration. Replace their contents with re-exports from `@repo/ui`.

7. **Test before committing** — Default is `pnpm typecheck && pnpm lint && pnpm test:invariants`. Candidate-scoped lint is allowed only when the current phase explicitly authorises it; exact-head CI is never waived.

8. **Don't create new packages** without discussing architecture first.

9. **Don't change route paths** — All URLs are production-indexed and linked from Sentry, Vercel Analytics, and user emails. A path rename requires a redirect. See `docs/architecture/routes.md`.

10. **Don't add `define` blocks for `VITE_*` vars** in Vite configs — Vite auto-injects them. A manual `define` block overrides injection and can inline `"undefined"` at build time.

---

## Common Mistakes to Avoid

| Mistake                                         | Correct Approach                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `import { supabase } from "@/integrations/..."` | Use `@repo/supabase` or hooks                                                                           |
| `createBrowserSupabase` in a server function    | `createServerSupabase(getCookies())`                                                                    |
| `console.log("debug")`                          | `logger.debug("message", { context })`                                                                  |
| `from "@repo/ui"` for Tooltip or Dialog         | `from "@repo/ui/tooltip"` / `from "@repo/ui/dialog"`                                                    |
| Importing directly from Radix in app code       | Import from `@repo/ui` which wraps Radix                                                                |
| Deleting a UI shim file                         | Replace contents with `export { X } from "@repo/ui"`                                                    |
| Using `key={index}` in dynamic lists            | Use a stable unique identifier                                                                          |
| Skipping Zod on server function input           | Always use `.inputValidator()` with Zod `.parse()`                                                      |
| Adding `"use server"` directive                 | TanStack Start uses `createServerFn`, not directives                                                    |
| Running `pnpm build` for deployment             | Use `pnpm build:vercel` (uses `vite.vercel.config.ts`)                                                  |
| Mixing feature + cleanup in one commit          | Split into separate focused commits                                                                     |
| Editing `src/routeTree.gen.ts`                  | Auto-generated by TanStack Router — never edit                                                          |
| Adding bare `create policy` in migrations       | Always wrap in DO $$ IF NOT EXISTS (pg_policies) or use IF NOT EXISTS for tables/indexes/columns        |
| Relying on .pnpmfile.cjs or unpinned pnpm       | Use "pnpm.onlyBuiltDependencies" + "packageManager" in package.json; keep .npmrc + clean workspace.yaml |
| Bridging native session into pip-auth cookies   | Keep web cookies and native Keychain / Bearer authorities separate                                      |
| Treating body/query `userId` as identity        | Use `requireUser()` (web) or verified Bearer identity (mobile API)                                      |
| Adding `/api/mobile/*` without phase authority  | New mobile endpoints require an explicit governed phase                                                 |
| Capacitor `server.url` or HTTP privileged calls | Local bundle only; privileged native transport is HTTPS `VITE_PUBLIC_URL`                               |

---

## Next Recommended Improvements

These are the most impactful items to work on next, in priority order:

1. **Complete UI migration** — 29 of 46 components still need migrating from `src/components/ui/` to `@repo/ui`. High-value targets: `sidebar.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `command.tsx`.

2. **Add component tests** — No component-level tests exist yet. Add Vitest + React Testing Library for critical flows (auth, photo upload, estimate generation).

3. **Consolidate remaining `@/integrations/supabase` imports** — `src/lib/auth.ts` and `src/services/supabase/index.ts` still import from the deprecated path. Route through `@repo/supabase` instead.

4. **Add error boundary** — The root layout (`__root.tsx`) has no React error boundary. Add one wrapping the `<Outlet />` to prevent white-screen crashes.

5. **Expand invariant tests** — Cover the UI migration state (e.g., assert that all migrated shims are pure re-exports) and package boundary rules.
