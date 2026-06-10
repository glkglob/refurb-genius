# Services

External integration boundary. Components and pages import from
`@/services/*` instead of reaching into `@/integrations/*` or
`supabase.storage` directly. Each service is the single seam where we
swap implementations or add setup-warning fallbacks.

- `@/platform/supabase/browser` — Supabase browser client singleton,
  `isSupabaseConfigured()` / `getSupabaseSetupWarning()` helpers.
- `@/services/projects` — Project CRUD + helpers (re-exports
  `@/core/projects` today; future server-fn-backed swap lands here).
- `@/services/storage` — `project-photos` bucket wrapper: `photoStore`,
  `getPublicPhotoUrl`, `canUseStorage`, bucket constant.

Side-effectful adapters live here. Pure business logic lives in
`@/core/*`. Server-only secrets stay in `*.server.ts` or `*.functions.ts`
modules and must never be imported by anything in this folder.