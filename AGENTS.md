# AGENTS.md — Refurb Genius Standards

> Canonical contributor and agent standards.
> Read fully before changing code.
> For contributor behaviour and implementation rules, this file wins over older guidance.
> ADRs remain authoritative for architecture decisions, and the migration register plus
> repository evidence remain authoritative for programme status.

---

## 0. Mission

Refurb Genius is the UK-first platform for:

**Postcode / photo → trustworthy local refurb cost → deal decision.**

It is the public spine of a larger intelligent platform.  
Deal Copilot is the first agent surface (inside this app).  
Refurb IQ is the future commercial layer — built on the same engines, not a parallel stack.

**North star:** Trusted UK numbers in under 10 minutes (L1 aim under 2 minutes). Not feature count.

**Maturity:** Late Alpha / Early Beta. Core loops work. Primary gaps: progressive L1 UX, source-badge consistency, remaining multi-root debt (especially Deal Copilot), browser end-to-end coverage and consistent `test:ui` CI enforcement.

**AI runtime:** Pure TypeScript `createServerFn` + OpenAI only. Railway/Python is gone. Do not reintroduce it.

---

## 1. Non-negotiable rules

| # | Rule |
|---|------|
| 1 | Money comes only from `@repo/services` — pricing → ROI → deal score. Never invent unit costs, totals, or profit in UI, prompts, or agents. |
| 2 | AI is advisory. Scope, condition, recommendations — yes. Authoritative £ — no. AI output must pass the normalizer → engines before display or persistence as authoritative. |
| 3 | Secrets stay server-only. No `VITE_` for OpenAI, service role, or payment secrets. |
| 4 | New product work lives in `src/features/<slice>/` with a public `index.ts` API. |
| 5 | Do not move the root TanStack `src/` shell or extract auth/bootstrap into packages unless an explicit ADR says so. |
| 6 | Applications never import each other. Packages own reusable capabilities. Features stay app-local until a second real consumer exists. |
| 7 | Empty layers and “just in case” packages are forbidden. |
| 8 | Do not rewrite to Next.js. This is TanStack Start. |
| 9 | Do not create no-op commits to “trigger” CI/Supabase unless a human explicitly authorises a controlled ops procedure. |
| 10 | Prefer small, reversible PRs. One concern per PR. |

---

## 2. Financial authority

| Concern | Owner |
|---------|-------|
| Authoritative refurb `mid_total` | `@repo/services` pricing (`runPricingEngine`) |
| Authoritative ROI | `@repo/services` ROI (`runRoiEngine`) using pricing `mid_total` as budget |
| Deal score | `@repo/services` deal-analysis (after pricing + ROI) |
| Enhanced / new-build estimates | `@repo/services` estimating modules — advisory unless product policy promotes them |
| AI money-like output | Must pass normalizer → engines before display or persistence as authoritative |

**Required pipeline:**

```
Photos / form → AI (scope, items, qty, condition) [advisory]
            → normalizeAIEstimate [map + clamp]
            → runPricingEngine / line authority [authority £]
            → runRoiEngine / scoreDealOpportunity [investment]
            → UI with source badge + assumptions
```

**Canonical source classifications:**

- `engine` — deterministic pricing-service output
- `ai-assisted` — AI-derived scope or quantities combined with engine-backed calculation
- `fallback` — deterministic degraded-mode output
- `mock` — development/test-only output; never silently presented as live AI

Use a shared typed contract. Do not introduce component-specific source strings.

**Transitional normalizer behaviour:** The current AI estimate normalizer blends
engine-backed category rates with AI-suggested rates for mapped items. This is
existing transitional behaviour, not the target financial-authority contract.

Until migrated to the canonical `@repo/services` pricing path:

- blended totals must be labelled `AI-assisted`;
- they must remain visibly distinct from engine-authoritative totals;
- they must be listed in assumptions;
- they must not silently become the authoritative `mid_total`;
- they must not feed ROI or deal scoring as authoritative inputs.

Target state: mapped items use engine-owned rates; AI supplies scope, quantities,
condition and descriptive context. Any retained pricing blend requires an explicit
product-policy decision and invariant coverage.

**Forbidden:**

- Presenting raw or blended AI £ as engine-authoritative
- Feeding raw or blended AI £ into authoritative ROI or deal scoring
- Showing advisory AI £ without an explicit source badge and assumptions
- Recomputing `mid_total` / ROI / score in components, routes, or prompts
- Forking pricing tables (single source of truth remains in `@repo/core`)

---

## 3. Progressive estimates (L1–L3)

Same engines at every level. Only inputs and confidence change.

| Level | User effort | Inputs | Output | Confidence |
|-------|-------------|--------|--------|------------|
| L1 — Instant | 30–60 s | Postcode, condition chips, intent chips | Mid + wide range + drivers + assumptions | Low |
| L2 — Solid | 2–5 min | + size / beds, finish, category toggles | Narrower range + category breakdown | Medium |
| L3 — Detailed | Photos + light confirm | AI scope + qty → normalizer | Room line items + risk notes + ROI-ready mid | High |

L1 must use a versioned default-input policy for any required engine input not
provided by the user, including property size, finish level and selected
categories. Defaults must live outside presentation code and must be shown in
the estimate assumptions. Hidden UI constants are forbidden.

**CostSummary target:** Introduce one reusable estimate-summary presentation
component containing mid, range, confidence, source, assumptions, key drivers
and—where supported by the engine—labour/materials split.

Its initial owner should be `src/features/estimate/presentation`, exported through
the estimate feature public API. Promote it to `@repo/ui` only after a second real
consumer exists.

Every estimate the user sees must show:

- Mid £
- Low–high band
- Confidence
- Source badge (using the canonical classifications above)
- Explicit assumptions / warnings

---

## 4. Platform shape (ownership)

```
Refurb Genius (this app — public spine)
  ├── features/*          product workflows (estimate, deal-copilot, …)
  ├── platform/*          vendor seams (browser vs server)
  └── routes/*            thin routes only

packages/@repo/*
  ├── types               contracts, DTOs (zero runtime deps)
  ├── core                constants, utils, mock data, pricingData
  ├── services            deterministic engines (pricing, ROI, deals, …)
  ├── ui                  design-system primitives
  └── supabase            client factories (browser / server)
```

**Request flow (required for new work):**

```
Route → feature presentation → application → domain
     → infrastructure adapter → platform / @repo/*
```

Docs of record: `docs/architecture/FEATURE_SLICE.md`, `docs/architecture/platform-architecture-plan.md`.

---

## 5. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19) |
| Build | Vite 7 + Nitro (vercel preset) |
| Language | TypeScript 5.8 strict, ES2022 |
| Style | Tailwind CSS v4 + Radix / shadcn pattern |
| UI package | `@repo/ui` (migration in progress) |
| State | TanStack Router (URL) + hooks |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| AI | OpenAI Vision (gpt-4o) via `createServerFn` |
| Deploy | Vercel (`pnpm build:vercel`) |
| Monorepo | pnpm workspaces + Turborepo |
| Validation | Zod on all external inputs |
| Errors | Sentry + structured logger |

Package manager: `pnpm@9.15.9` (packageManager field). Install with `--frozen-lockfile` in CI/Vercel.

---

## 6. Repository map

```
refurb-genius/
├── src/
│   ├── features/           ★ canonical home for product work
│   │   └── <slice>/
│   │       domain/ | application/ | infrastructure/ | presentation/
│   │       index.ts          # public API only
│   ├── platform/           vendor seams (OpenAI, etc.) — not domain logic
│   ├── routes/             thin file routes → features
│   ├── components/         app shell + shims → @repo/ui
│   ├── core/ lib/ hooks/ services/ serverFns/   # transitional / frozen
│   ├── integrations/supabase/   # generated types ONLY — do not hand-edit
│   ├── server.ts · router.tsx · styles.css
│   └── routeTree.gen.ts    # generated — never edit
├── packages/               @repo/* kernel
├── supabase/               migrations + Edge Functions
├── tests/invariants/       architecture + financial gates
└── docs/architecture/      deeper ADRs and flow docs
```

**Frozen / transitional:** Do not put new domain logic in `src/lib/`, `src/hooks/`, or `src/services/` unless it is cross-cutting and on the freeze allowlist. Prefer extracting or extending a feature slice.

---

## 7. Feature slices

Layout (create only folders that contain real code):

```
src/features/<slice>/
  domain/           pure types, rules (no IO, no React)
  application/      use-cases / orchestration
  infrastructure/   adapters (DB, AI, storage)
  presentation/     UI, feature hooks
  index.ts          public API for this app only
```

**Highest-leverage structural work still open:** Deal Copilot single-root
convergence, remaining UI-package migration, and evidence-backed freeze
ratchets.

Projects ownership (C4) and Photos / Storage ownership (C5) are completed.
Do not reopen them without new repository evidence and a separately authorised
migration candidate.

**Deal Copilot target:** single feature root `src/features/deal-copilot`. Presentation owns UI; application owns orchestration; infrastructure owns repositories and AI adapters (text only); serverFns stay thin (auth + Zod + call use-cases). No direct Supabase from presentation. Agent behaviour must call `@repo/services` for numbers.

**Refurb IQ:** Do not scaffold empty product folders. When authorised, contracts go in `@repo/types` from Genius estimate outputs; consume public estimate APIs; shared report engine for contractor-grade export.

---

## 8. Coding conventions

### Imports & path aliases

```
@/*              → ./src/*
@repo/types      → packages/types/src
@repo/core       → packages/core/src
@repo/services   → packages/services/src
@repo/ui         → packages/ui/src
@repo/ui/*       → packages/ui/src/components/*
@repo/supabase   → packages/supabase/src
@repo/supabase/* → packages/supabase/src/*
```

### Server functions

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ id: z.string().min(1) });

export const myServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    await requireServerAuth();
    // …
  });
```

- No `"use server"` directives.
- Always Zod-validate external input.
- Always auth-check protected handlers.

### Server auth

```ts
async function requireServerAuth(): Promise<void> {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { createServerSupabase } = await import("@repo/supabase/server");
  const supabase = createServerSupabase(getCookies());
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
}
```

Never use `createBrowserSupabase` in server functions.

### Logging & errors

- Use `logger` from `@/lib/logger` — never `console.log`.
- Sentry for errors; logger for diagnostics.
- AI paths: graceful fallback with explicit source classification — never silent mock-as-AI.
- Surface failures to the user (toast / banner).

### Types

- Strict mode. No `any`. Prefer `unknown` + guards.
- Do not hand-edit generated Supabase types or `routeTree.gen.ts`.

---

## 9. UI system

- Migrate toward `@repo/ui`. Shims in `src/components/ui/` re-export; do not delete shim files — replace contents with re-exports.
- Prefer `@repo/ui` imports. For circular barrel cases use subpaths (e.g. `@repo/ui/tooltip`, `@repo/ui/dialog`).
- Pattern: Radix + cva + `cn()`.
- Do not import Radix primitives directly in app feature code when a `@repo/ui` wrapper exists.
- Tailwind v4 must scan `packages/ui` (`@source` in `src/styles.css`).

---

## 10. Supabase & data

| Context | Import |
|---------|--------|
| Browser | `createBrowserSupabase` from `@repo/supabase/browser` |
| Server | `createServerSupabase` from `@repo/supabase/server` |
| Token | `createTokenSupabase` from `@repo/supabase/server` |

Rules:

1. Never import app clients from `@/integrations/supabase/*` (types only).
2. RLS on all tables — never bypass; never put service role in client.
3. Migrations idempotent: `IF NOT EXISTS` / guarded `CREATE POLICY`. No bare `create policy` in new migrations.
4. Edge Functions (`supabase/functions/`) are Deno and separate from `createServerFn`.
5. New feature data access: repositories in feature infrastructure, not ad-hoc SQL in UI.

---

## 11. Commands

```bash
pnpm install                 # deps
pnpm dev                     # dev server
pnpm typecheck               # tsc --noEmit
pnpm lint                    # ESLint + Prettier checks
pnpm format                  # format
pnpm build:vercel            # production build (use this, not pnpm build)
pnpm test:invariants         # architecture + financial gates
pnpm test:ui                 # UI/Vitest — present as script; not yet enforced in principal CI
```

Pre-commit / pre-push minimum:

```bash
pnpm typecheck && pnpm lint && pnpm test:invariants
```

**CI baseline:** frozen lockfile, typecheck, lint, build:vercel and invariants.  
**Target:** add `test:ui` and critical Playwright smoke paths as enforced gates when their runtime and stability are proven.

Deploy builds: `pnpm build:vercel` only.

---

## 12. Testing & gates

- Invariants (`tests/invariants/`): pricing authority, ROI/deal scoring, routes, freezes, package boundaries, auth env — must stay green.
- Expand invariants when adding money paths or architecture rules.
- Prefer Playwright smoke for: photo → estimate → ROI → PDF (and L1 path once it exists).
- New code: presentation must not import Supabase clients directly.

---

## 13. Git & PR

- Branches: `feat/…`, `fix/…`, `chore/…`, `docs/…`
- Commits: short imperative why
- PR body: `## Summary` + `## Test plan`
- No force-push to main
- Do not mix feature + large cleanup in one PR
- Route path changes require redirects — URLs are live

---

## 14. Agent safety checklist

Before every change set:

- Read this file and the relevant feature public API
- Money path still goes through `@repo/services` (or is correctly labelled transitional)
- No new domain logic in frozen lib / hooks / services
- No generated files edited
- No secrets / `.env` committed
- Server fns: Zod + auth
- UI shims preserved as re-exports
- `pnpm typecheck && pnpm lint && pnpm test:invariants` green
- No new package without explicit architecture decision
- No stack rewrite, no Railway, no empty IQ scaffolding

---

## 15. Common mistakes

| Wrong | Right |
|-------|-------|
| `import { supabase } from "@/integrations/..."` | `@repo/supabase` or feature repo |
| `createBrowserSupabase` in server fn | `createServerSupabase(getCookies())` |
| `console.log` | `logger.*` |
| Presenting raw or blended AI £ as engine-authoritative | Normalizer → engine → display + source badge; blended totals labelled `ai-assisted` |
| New logic in `src/lib` | `src/features/<slice>/…` |
| Delete UI shim | Re-export from `@repo/ui` |
| `"use server"` | `createServerFn` |
| `pnpm build` for deploy | `pnpm build:vercel` |
| Bare `create policy` | Idempotent guarded policy |
| Feature import from another future app | Packages only |
| Empty packages/foo “for later” | Forbidden |

---

## 16. Product priorities (agents: prefer this order)

1. Trust / launch: financial consolidation, normalizer coverage + badges, RLS, L1 progressive estimate, CI tests
2. Architecture debt: UI migration, Deal Copilot single root, freeze ratchets
3. Activation: <10 min to first estimate, confidence bands, scenarios, share/PDF quality
4. Agent: Deal Copilot pipeline + background score after estimate (same engines)
5. Monetization: payment + Pro gates on expensive AI
6. Marketplace / IQ: only after core loop is solid; IQ consumes contracts — no parallel product

**Decision filter when stuck:**

1. Does it improve trusted numbers in <10 min? → Do it  
2. Does it protect financial authority or security? → Do it  
3. Does it reduce multi-root debt so the next feature is faster? → Do it  
4. Does it only expand surface area (marketplace, IQ UI, new AI toys)? → Defer

---

## 17. Explicit non-goals

- Next.js rewrite
- Reintroducing Railway/Python AI
- Big-bang move of root `src/` into `apps/` without ADR + green CI
- Publishing packages “just in case”
- Empty Refurb IQ scaffolding
- Separate Deal Copilot deployable before single-root feature is done
- AI that invents money
- Marketplace growth before RFQ-from-estimate works
- Reopening completed C4 Projects or C5 Photos migrations without new evidence and authorisation

---

## 18. Related docs

| Doc | Use |
|-----|-----|
| `docs/architecture/FEATURE_SLICE.md` | Request flow & slice rules |
| `docs/architecture/platform-architecture-plan.md` | Multi-app target & package promotion |
| `docs/architecture/dependency-rules.md` | Import matrix |
| `docs/architecture/routes.md` | URL stability |
| `docs/architecture/ai-platform.md` | AI boundaries |
| `docs/qa-checklist.md` | Launch demo path |
| `docs/operations/beta-operations-playbook.md` | Incidents |

---

## 19. Replacement policy

- AGENTS.md is canonical for agent and contributor standards.
- Keep CLAUDE.md only as a short pointer to AGENTS.md.
- Update this file when architecture or non-negotiables change — not for ephemeral task lists.

---

*Last aligned with platform plan, financial authority model, UK-first market-leading execution priorities, and repository evidence (C4/C5 completed; CostSummary planned; normalizer transitional).*
