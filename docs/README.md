# Refurb Genius — Docs

## Architecture

| Document | Description |
|---|---|
| [Architecture Overview](./architecture/overview.md) | High-level monorepo and package structure |
| [Dependency Rules](./architecture/dependency-rules.md) | One-way import hierarchy between packages |
| [Package Boundaries](./architecture/package-boundaries.md) | What each package owns and its constraints |
| [Runtime Boundaries](./architecture/runtime-boundaries.md) | What cannot be moved or extracted |
| [Routes](./architecture/routes.md) | Route map — public, auth, authenticated |
| [AI Platform](./architecture/ai-platform.md) | Pure TS + OpenAI serverFns pipeline (post-Railway) |
| [Analysis Paths](./architecture/analysis-paths.md) | How photo analysis and AI estimates flow |
| [Migration History](./architecture/migration-history.md) | Monorepo extraction phases 1–4 |
| [Future Roadmap](./architecture/future-roadmap.md) | Upcoming phases and decision tree |
| [Platform Debt](./architecture/platform-debt.md) | Known trade-offs and resolution paths |
| [Phase 4.5 Stabilization Audit](./architecture/phase-4.5-stabilization-audit.md) | Post-extraction stability verification |
| [Phase 5C Runtime Validation](./architecture/phase-5c-runtime-validation.md) | Stress-test results and operational risks |

## Operations

| Document | Description |
|---|---|
| [Beta Operations Playbook](./operations/beta-operations-playbook.md) | Monitoring, incident response, deployment |
| [AI Operational Governance](./operations/ai-operational-governance.md) | AI pipeline safety, rate limits, fallbacks |

## Product & QA

| Document | Description |
|---|---|
| [Repo Convergence Plan](./repo-convergence-plan.md) | Product strategy — Deal Copilot, Refurb IQ integration |
| [Deal Copilot Beta Governance](./deal-copilot-beta-governance.md) | Deal Copilot operational runbook |
| [QA Checklist](./qa-checklist.md) | Pre-deploy manual QA checklist |
| [Trades Marketplace QA](./trades-marketplace-qa.md) | Trades Marketplace QA checklist |
| [Invariant Protection Report](./invariant-protection-report.md) | Deterministic financial invariant tests |

## Audits

| Document | Description |
|---|---|
| [Estimate Logic Audit](./audits/estimate-logic-audit.md) | Pricing engine and estimate flow audit |

## Mobile

| Document | Description |
|---|---|
| [Mobile Readiness](./mobile-readiness.md) | Mobile / PWA readiness status |
| [Capacitor iOS](./capacitor-ios.md) | iOS Capacitor build guide |

## Archive

Historical artefacts preserved for reference, no longer active:

- `docs/archive/2026-05-legacy-ai-guidance-railway/` — Railway + Python backend docs from before decommissioning
