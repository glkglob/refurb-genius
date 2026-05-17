# Runtime Boundaries: What Cannot Move

## The Immovable Runtime Shell

The root `src/` directory contains the **production bootstrap and orchestration layer**. These components cannot be moved, extracted, or relocated without breaking the application.

**Why immovable**: TanStack Start's plugin architecture requires certain files at the repository root and certain operations to occur during the Vite build phase. The plugin cannot be relocated.

## Components That Must Stay at Root

### 1. TanStack Start Bootstrap

**Files:**

- `vite.config.ts` (entry point for build system)
- `vite.vercel.config.ts` (Vercel-specific build config)
- `package.json` (workspace root, build scripts)
- `src/app/` (route definitions, auto-discovery pattern)
- `src/routes/` (route tree)

**Why immovable:**

- TanStack Start plugin resolves `src/app` and `src/routes` at build time
- Route tree generation (`routeTree.gen.ts`) requires files to be discoverable
- Vite bundler must run from workspace root
- If moved, the plugin cannot find routes

**Attempted extraction (Phase 3):**

- Tried to move `src/` to `apps/main/src/`
- TanStack Start plugin failed to resolve routes before Vite configuration applied
- Decision: Revert and keep `src/` at root permanently

### 2. Vite Build System

**Files:**

- `vite.config.ts`
- `vite.vercel.config.ts`
- `tsconfig.json` (path aliases, compiler options)
- `package.json` (build scripts, dependencies)

**Why immovable:**

- Vite runs from workspace root
- `import.meta.env.VITE_*` resolves at build time into both client and server bundles
- Environment variables read during Vite plugin initialization
- Cannot be isolated per workspace package

### 3. Server-Side Rendering (Nitro)

**Files:**

- `src/server.ts` (SSR error wrapper)
- `src/index.html` (entry point template)
- `vite.vercel.config.ts` (Nitro preset configuration)

**Why immovable:**

- Nitro plugin initializes during Vite build
- SSR requires server code to be bundled with client code
- Env vars for Supabase and OpenAI read during SSR init
- Route resolution for server-side must work at build time

### 4. Authentication System

**Files:**

- `src/lib/auth.ts`
- `src/lib/auth-session.ts`
- `src/integrations/supabase/client.ts` (Supabase client init)
- `src/lib/providers.tsx` (auth context provider)

**Why immovable:**

- Supabase client initialization must happen during first render
- Auth hydration reads `import.meta.env` for SUPABASE_URL and SUPABASE_KEY
- Auth context must wrap all routes (orchestration happens at root)
- Session cookie parsing happens in server context (cannot be deferred)
- Premature extraction breaks login flow and session persistence

**Cannot extract because:**

```typescript
// src/lib/auth.ts initializes early
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; // ← read at build time
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY; // ← read at build time

export const client = createClient(supabaseUrl, supabaseKey);
// If moved to @repo/integrations, TanStack Start can't access it before route resolution
```

### 5. Application Providers

**Files:**

- `src/lib/providers.tsx` (context providers)
- `src/integrations/openai/client.ts` (OpenAI initialization)
- Zustand stores (if any)
- TanStack Query client setup

**Why immovable:**

- Providers wrap the entire React tree
- They initialize at app startup, not at package load
- Context values are often app-specific
- Extracted providers would need to remain in root anyway

### 6. Route Loaders and Orchestration

**Files:**

- `src/routes/` (route definitions with loaders)
- All code that references route params, search params, context
- All async data loading logic

**Why immovable:**

- Route loaders are discovered at build time
- They are tightly coupled to route definitions
- Cannot be extracted without breaking route resolution
- Loaders often read auth context (orchestration layer)

**Cannot extract because:**

```typescript
// src/routes/__root.ts
export async function loader({ context }) {
  // context.auth comes from auth hydration in root providers
  // if auth is extracted, this loader breaks
  const user = context.auth.user;
  return { user };
}
```

### 7. Database and External Integrations

**Files:**

- `src/integrations/supabase/` (Supabase client setup, types)
- `src/integrations/openai/` (OpenAI client, models)

**Why cannot be fully extracted:**

- Client initialization happens at bootstrap
- Auth-dependent queries must wait for session hydration
- API keys read from `import.meta.env` at build time
- If extracted to @repo/integrations, we still can't move them outside root scope

**Possible extraction later:**

- Could create @repo/integrations as a facade package
- But actual client initialization would still happen at root
- Package would just be a re-export layer (like @repo/ui)

## Components That Have Been Successfully Extracted

### ✅ @repo/types

- Pure types, no side effects
- No environment variables
- No runtime initialization
- Fully independent of bootstrap

### ✅ @repo/core

- Constants and utilities
- Pure functions, no hooks
- No external API dependencies
- No auth requirements

### ✅ @repo/services

- Pure business logic
- Deterministic calculations
- No React hooks
- No external state

### ✅ @repo/ui

- Component re-export facade
- No orchestration
- No route coupling
- No auth coupling

## What Future Products Will Need

### Deal Copilot (future app)

- New route tree: `apps/deals/src/routes/`
- New UI: `apps/deals/src/components/`
- Shared: `@repo/services`, `@repo/core`, `@repo/types`, `@repo/ui`
- Runtime shell: Must stay separate (own `src/server.ts`, `vite.config.ts`, etc.)

### Refurb IQ (future app)

- New route tree: `apps/iq/src/routes/`
- New UI: `apps/iq/src/components/`
- Shared: `@repo/services`, `@repo/core`, `@repo/types`, `@repo/ui`
- Runtime shell: Must stay separate

**Key insight:** When splitting into multiple apps, each app needs its own runtime shell (its own `src/`, `vite.config.ts`, etc.). Packages are shared via monorepo mechanism. This is the future architecture.

## Verification: What Must Remain at Root

Run this to verify root-level files are not extracted:

```bash
# These must exist at repo root:
ls src/server.ts
ls vite.config.ts
ls vite.vercel.config.ts
ls tsconfig.json
ls src/app/
ls src/routes/

# These should NOT be in packages/:
find packages -name "server.ts"  # should be empty
find packages -name "*vite.config*"  # should be empty
find packages -name "providers.tsx"  # should be empty
```

## The Final Word

The root `src/` directory is not "the monorepo problem." It is the correct location for a TanStack Start application.

Future multi-app architecture (Deal Copilot, Refurb IQ) will have:

```
apps/
├── refurb-genius/
│   ├── src/                 ← immovable
│   ├── vite.config.ts       ← immovable
│   └── package.json         ← immovable
├── deal-copilot/
│   ├── src/                 ← immovable
│   ├── vite.config.ts       ← immovable
│   └── package.json         ← immovable
packages/
├── services/                ← shared
├── core/                    ← shared
├── types/                   ← shared
├── ui/                      ← shared
```

Each app is its own runtime shell. Packages are the shared layer. Do not try to change this.
