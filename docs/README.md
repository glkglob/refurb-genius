# Refurb Genius — Docs

> **Start here:** [`CLAUDE.md`](../CLAUDE.md) (repo root) for agent/contributor rules.
> Architecture index: [`architecture/overview.md`](./architecture/overview.md).

## Architecture

| Document                                                                     | Description                                                |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Architecture Overview](./architecture/overview.md)                          | Monorepo structure, financial invariant, build pipeline    |
| [Feature-Slice Architecture](./architecture/FEATURE_SLICE.md)                | Vertical slices, layering rules, migration state           |
| [Platform Boundary](./architecture/platform-boundary.md)                     | Vendor SDK seams (OpenAI, Supabase, PostHog)               |
| [Dependency Rules](./architecture/dependency-rules.md)                       | One-way import hierarchy between packages                  |
| [Package Boundaries](./architecture/package-boundaries.md)                   | What each package owns                                     |
| [Runtime Boundaries](./architecture/runtime-boundaries.md)                   | What cannot be moved or extracted                          |
| [Routes](./architecture/routes.md)                                           | Route map — public, auth, authenticated                    |
| [AI Platform](./architecture/ai-platform.md)                                 | Pure TS + OpenAI serverFns pipeline                        |
| [Analysis Paths](./architecture/analysis-paths.md)                           | Photo analysis and AI estimate flows                       |
| [Migration History](./architecture/migration-history.md)                     | Monorepo extraction phases 1–4                             |
| [Future Roadmap](./architecture/future-roadmap.md)                           | Upcoming phases (includes Phase 4.5 stabilization summary) |
| [Platform Debt](./architecture/platform-debt.md)                             | Known trade-offs and resolution paths                      |
| [Refurb Estimator Import](./architecture/refurb-estimator-import.md)         | Pure engines ported from glkglob/refurb-estimator          |
| [Phase 5C Runtime Validation](./architecture/phase-5c-runtime-validation.md) | Stress-test results and operational risks                  |

## Operations

| Document                                                               | Description                                |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| [Beta Operations Playbook](./operations/beta-operations-playbook.md)   | Monitoring, incident response, deployment  |
| [AI Operational Governance](./operations/ai-operational-governance.md) | AI pipeline safety, rate limits, fallbacks |

## Product & QA

| Document                                                          | Description                                  |
| ----------------------------------------------------------------- | -------------------------------------------- |
| [Repo Convergence Plan](./repo-convergence-plan.md)               | Deal Copilot, Refurb IQ integration strategy |
| [Deal Copilot Beta Governance](./deal-copilot-beta-governance.md) | Deal Copilot operational runbook             |
| [QA Checklist](./qa-checklist.md)                                 | Pre-deploy manual QA checklist               |
| [Trades Marketplace QA](./trades-marketplace-qa.md)               | Trades Marketplace QA checklist              |
| [Invariant Protection Report](./invariant-protection-report.md)   | Deterministic financial invariant tests      |

## Audits

| Document                                                 | Description                            |
| -------------------------------------------------------- | -------------------------------------- |
| [Estimate Logic Audit](./audits/estimate-logic-audit.md) | Pricing engine and estimate flow audit |

## Mobile

| Document                                  | Description                   |
| ----------------------------------------- | ----------------------------- |
| [Mobile Readiness](./mobile-readiness.md) | Mobile / PWA readiness status |
| [Capacitor iOS](./capacitor-ios.md)       | iOS Capacitor build guide     |

## UI (in `src/docs/`)

| Document                                                  | Description                        |
| --------------------------------------------------------- | ---------------------------------- |
| [Component Standards](../src/docs/COMPONENT_STANDARDS.md) | Button, card, token usage rules    |
| [Design System](../src/docs/design-system.md)             | Colors, typography, spacing tokens |

## Archive

Historical artefacts — **not active guidance**.

| Folder                                                                                         | Contents                                      |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [`archive/2026-05-legacy-ai-guidance-railway/`](./archive/2026-05-legacy-ai-guidance-railway/) | Railway experiment + curation log (June 2026) |
