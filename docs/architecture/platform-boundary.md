# Platform Boundary

> Status: **Adopted** — introduced 2026-06 alongside feature-slice architecture.
> Vendor SDKs are isolated in `src/platform/` so slices and legacy code depend on
> factories and typed seams, not raw `openai`, `@supabase/supabase-js`, or
> `posthog-*` imports.

---

## Why

Feature slices and legacy modules should not import vendor SDKs directly. A single
platform layer:

1. Prevents server-only SDKs (OpenAI, `posthog-node`) from leaking into client bundles.
2. Centralises instrumentation (Sentry OpenAI wrapping, PostHog OTEL).
3. Lets infrastructure adapters swap vendors without touching domain logic.
4. Gives invariant tests a clear enforcement surface.

`@repo/supabase` remains the **factory implementation** for Supabase; `src/platform/`
is the **app-side seam** that slice infrastructure imports.

---

## Layout

```
src/platform/
├── browser.ts              # typed aggregate — browser-safe vendors only
├── server.ts               # typed aggregate — server-only vendors
├── supabase/
│   ├── browser.ts          # createBrowserSupabase, resolveEnv, app singleton
│   └── server.ts           # createServerSupabase, createTokenSupabase
├── openai/
│   └── server.ts           # getOpenAIClient (server-only; no browser entry)
└── posthog/
    ├── browser.ts          # posthog-js + PostHogProvider
    ├── server.ts           # getPostHogServerClient
    └── otel.server.ts      # Nitro OTEL bootstrap (import once from server entry)
```

**No mixed browser/server barrel.** Never add `src/platform/index.ts` that re-exports
both contexts — that would pull server SDKs into client bundles.

---

## Usage patterns

### Browser aggregate

```ts
import { platform } from "@/platform/browser";

const supabase = platform.supabase.createClient();
platform.posthog.client.capture("event_name", { surface: "dashboard" });
```

Prefer subpath imports in slices when you need only one vendor:

```ts
import { supabase } from "@/platform/supabase/browser";
import { posthog } from "@/platform/posthog/browser";
```

### Server aggregate (inside `createServerFn` handlers)

Use **dynamic import** so the server bundle stays isolated:

```ts
.handler(async ({ data }) => {
  const { getCookies } = await import("@tanstack/react-start/server");
  const { platform } = await import("@/platform/server");

  const supabase = platform.supabase.createServerClient(getCookies());
  const openai = platform.ai.getOpenAIClient(process.env.OPENAI_API_KEY!);
  const posthog = platform.posthog.getServerClient();
});
```

Or import subpaths directly in `*.server.ts` modules:

```ts
import { getOpenAIClient } from "@/platform/openai/server";
import { createServerSupabase } from "@/platform/supabase/server";
```

### Slice infrastructure adapters

AI adapters in `features/*/infrastructure/adapters/*.server.ts` import OpenAI via
`@/platform/openai/server`. Repositories import Supabase via
`@/platform/supabase/browser` (browser singleton) or dynamic
`@/platform/supabase/server` in serverFns.

### Presentation / app shell

- `src/routes/__root.tsx` — `PostHogProvider` from `@/platform/posthog/browser`
- `src/lib/analytics.ts` — `posthog` from `@/platform/posthog/browser`
- `src/server.ts` — `import "@/platform/posthog/otel.server"` (once at startup)

---

## Approved import layers

| Layer                                 | May import vendor SDK? | How                                        |
| ------------------------------------- | ---------------------- | ------------------------------------------ |
| `src/platform/**`                     | ✅ Yes                 | Direct SDK imports live here only          |
| `packages/supabase/**`                | ✅ Yes                 | Monorepo Supabase factory package          |
| `src/features/*/infrastructure`       | ⚠️ Via platform        | `@/platform/<vendor>/*` subpaths           |
| `src/features/*/domain`               | ❌ No                  | Pure logic only                            |
| `src/features/*/application`          | ❌ No                  | Ports/interfaces only                      |
| `src/lib/**`, `src/core/**`           | ❌ No\*                | \*Legacy shims may re-export from platform |
| `src/routes/**`                       | ⚠️ Via platform        | Presentation wiring only                   |
| `scripts/**`, `supabase/functions/**` | ✅ Yes                 | Standalone runtimes (exempt)               |

---

## Vendor migration table

| Vendor                 | Platform entry                   | Status                          | Legacy shims (remove when grep = 0)                            |
| ---------------------- | -------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| **OpenAI**             | `@/platform/openai/server`       | ✅ Migrated                     | `src/core/ai/server/openai-client.ts`                          |
| **Supabase (browser)** | `@/platform/supabase/browser`    | ✅ Slices migrated              | `src/services/supabase`, `src/integrations/supabase/client.ts` |
| **Supabase (server)**  | `@/platform/supabase/server`     | ✅ serverFns use dynamic import | —                                                              |
| **PostHog (browser)**  | `@/platform/posthog/browser`     | ✅ Migrated                     | —                                                              |
| **PostHog (server)**   | `@/platform/posthog/server`      | ✅ Migrated                     | `src/lib/posthog-server.ts`                                    |
| **PostHog (OTEL)**     | `@/platform/posthog/otel.server` | ✅ Migrated                     | `src/lib/posthog-otel.ts`                                      |
| **Sentry**             | `src/lib/sentry.ts`              | By design at lib layer          | Not a slice concern                                            |
| **Stripe / Qdrant**    | —                                | Not yet needed                  | Add `src/platform/<vendor>/` first                             |

### Slice infrastructure status

| Slice       | OpenAI adapter                | Supabase repo                    |
| ----------- | ----------------------------- | -------------------------------- |
| `estimate`  | ✅ `@/platform/openai/server` | ✅ `@/platform/supabase/browser` |
| `ai-upload` | ✅ `@/platform/openai/server` | ✅ `@/platform/supabase/browser` |
| `ai-design` | ✅ `@/platform/openai/server` | ✅ `@/platform/supabase/browser` |

### Legacy code still outside platform (acceptable / planned)

| Module                                 | Notes                                               |
| -------------------------------------- | --------------------------------------------------- |
| `src/core/ai/platform/orchestrator.ts` | Imports slice serverFns only — no direct vendor SDK |
| `src/core/ai/normalizers.ts`           | Pure pricing normalization — no vendor IO           |
| `@repo/services` engines               | Deterministic — intentionally untouched             |

---

## Adding a new vendor

1. Create `src/platform/<vendor>/browser.ts` and/or `server.ts` (split if SDK differs by context).
2. Add factories to `browser.ts` / `server.ts` aggregates — **factories, not instances**.
3. Update slice `infrastructure/` adapters to import from the new subpath.
4. Extend `tests/invariants/platform-boundary.invariant.test.ts` with the vendor pattern.
5. Document the entry in the migration table above.

---

## Verification

```bash
# Direct vendor imports outside approved layers (should return only platform + packages)
rg 'from ["'\'']openai["'\'']' src --glob '!src/platform/**'
rg 'from ["'\'']posthog-js["'\'']|from ["'\'']posthog-node["'\'']' src --glob '!src/platform/**'
rg 'from ["'\'']@supabase/supabase-js["'\'']' src --glob '!src/platform/**'

pnpm typecheck && pnpm lint && pnpm test:invariants && pnpm build:vercel
```

---

## Related docs

- [FEATURE_SLICE.md](./FEATURE_SLICE.md) — slice layering + platform rules
- [ai-platform.md](./ai-platform.md) — AI provider architecture
- [platform-debt.md](./platform-debt.md) — monorepo trade-offs (separate from this boundary)
