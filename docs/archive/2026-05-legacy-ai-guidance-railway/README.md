# Archived Legacy AI Agent Guidance & Railway Experiment

**Archived:** May 2026  
**Last curated:** June 2026

Historical artefacts from before the Railway/Python backend was decommissioned and
before feature-slice + platform-boundary architecture landed. **Do not follow any
instructions in files removed from this folder** — they reference deleted paths,
wrong env vars (`VITE_OPENAI_API_KEY`), and completed one-shot tasks.

---

## What remains in this folder

| File                                   | Why kept                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) | Records the FastAPI + CrewAI split-deployment experiment (backend removed) |

Everything else was deleted in the June 2026 curation — see **Removed artefacts** below.

---

## Current guidance (use these instead)

| Topic                                           | Active document                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Agent / contributor rules                       | [`CLAUDE.md`](../../../CLAUDE.md) (repo root)                                         |
| Feature-slice architecture                      | [`docs/architecture/FEATURE_SLICE.md`](../../architecture/FEATURE_SLICE.md)           |
| Vendor SDK boundary (OpenAI, Supabase, PostHog) | [`docs/architecture/platform-boundary.md`](../../architecture/platform-boundary.md)   |
| AI pipeline (post-Railway)                      | [`docs/architecture/ai-platform.md`](../../architecture/ai-platform.md)               |
| Analysis flows                                  | [`docs/architecture/analysis-paths.md`](../../architecture/analysis-paths.md)         |
| Package import rules                            | [`docs/architecture/dependency-rules.md`](../../architecture/dependency-rules.md)     |
| Immovable runtime boundaries                    | [`docs/architecture/runtime-boundaries.md`](../../architecture/runtime-boundaries.md) |

### Where migrated AI code lives now (2026-06)

| Capability            | Slice                                  | Platform seam                 |
| --------------------- | -------------------------------------- | ----------------------------- |
| Photo vision          | `src/features/ai-upload/`              | `@/platform/openai/server`    |
| Scope + redesign      | `src/features/ai-design/`              | `@/platform/openai/server`    |
| Estimates             | `src/features/estimate/`               | `@/platform/openai/server`    |
| OpenAI client factory | `src/platform/openai/server.ts`        | Sentry-instrumented singleton |
| Orchestration stub    | `src/core/ai/platform/orchestrator.ts` | Calls slice serverFns only    |

Legacy shims under `src/core/ai/` re-export slice modules and are marked
`TODO(feature-slice)`.

---

## Removed artefacts (June 2026 curation)

### Cursor rules (9 `.mdc` files) — deleted

Originally at `.cursor/rules/`. Superseded by `CLAUDE.md` and
`docs/architecture/*`. Principles that remain valid:

| Old rule file                 | Still true?                          | Now documented in                       |
| ----------------------------- | ------------------------------------ | --------------------------------------- |
| `00-project-overview.mdc`     | Partially (3-product vision)         | `CLAUDE.md`, `repo-convergence-plan.md` |
| `01-tech-stack.mdc`           | Partially (paths outdated)           | `CLAUDE.md`                             |
| `02-safe-agent-behaviour.mdc` | Yes                                  | `CLAUDE.md` Agent Safety Rules          |
| `03-shared-core.mdc`          | Partially (`@repo/*` not `src/core`) | `dependency-rules.md`                   |
| `04-pricing-roi.mdc`          | Yes                                  | `CLAUDE.md`, invariant tests            |
| `05-supabase-security.mdc`    | Yes                                  | `CLAUDE.md` Supabase & Data Rules       |
| `06-ui-components.mdc`        | Partially (`@repo/ui` migration)     | `CLAUDE.md` UI System Rules             |
| `07-ai-boundaries.mdc`        | Yes                                  | `ai-platform.md`, `FEATURE_SLICE.md`    |
| `08-git-workflow.mdc`         | Yes                                  | `CLAUDE.md` Git & PR Workflow           |

### Claude slash commands (6 `.md` files) — deleted

Originally at `.claude/commands/`. One-shot implementation guides; work completed
or paths obsolete:

| Command                        | Status when archived                                           |
| ------------------------------ | -------------------------------------------------------------- |
| `wire-openai-vision.md`        | Done → `ai-upload` slice + platform OpenAI                     |
| `wire-ai-redesign.md`          | Done → `ai-design` slice                                       |
| `add-pdf-export.md`            | Partial → `src/lib/exportPdf.ts` (report export slice planned) |
| `add-email-notifications.md`   | Edge function exists; command paths outdated                   |
| `expand-admin-panel.md`        | Historical task guide                                          |
| `fix-fast-refresh-warnings.md` | Completed fix                                                  |

---

## Railway experiment summary

The repo once explored a **split deployment**: TanStack Start on Vercel + FastAPI/CrewAI
on Railway. That path was fully removed:

- Deleted: `backend/`, `property-intel/`, `railwayAnalysis.ts`, `useRailwayPropertyAnalysis.ts`
- AI is now **pure TypeScript** `createServerFn` + OpenAI (`gpt-4o`) only
- `analysis_jobs` table is legacy DB history only

Full deployment notes: [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) (historical).

---

## When to touch this archive

- **Do not** add new active guidance here.
- **Do** add a new dated subfolder if archiving a future superseded doc set.
- **Do** update this README when curating or removing stale artefacts.
