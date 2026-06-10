# Repo Convergence Plan

Refurb Genius is the platform spine.

Deal Copilot and Refurb IQ are source-asset products that will be integrated into this app through shared core modules and route-level product surfaces.

## Current decision

- Refurb Genius remains the live app and deployment target.
- Deterministic engines live in `@repo/services` (pricing, ROI, deal scoring).
- Feature work migrates into `src/features/<slice>/` (see `docs/architecture/FEATURE_SLICE.md`).
- Legacy shared logic still under `src/core/` (shrinking via strangler shims).
- Product UI lives under `src/routes/` and `src/components/`.
- Vendor SDKs isolated in `src/platform/` (see `docs/architecture/platform-boundary.md`).
- Deal Copilot will start as a lightweight manual deal-analysis module.
- Refurb IQ will start as a downstream BOQ and cost-plan module fed by Refurb Genius estimates.

## Product roles

| Product       | Role                                                          |
| ------------- | ------------------------------------------------------------- |
| Refurb Genius | Refurbishment estimate, investor analysis, project reports    |
| Deal Copilot  | Acquisition intelligence, deal scoring, investor underwriting |
| Refurb IQ     | BOQ, cost planning, specifications, contractor-grade outputs  |
| Agent Tools   | Estate-agent advice, pre-sale improvements, rental readiness  |

## Integration order

1. Stabilise Refurb Genius as the platform host.
2. Add shared product, property, ROI, pricing, report, and project contracts.
3. Build Deal Copilot Lite as a route-level module.
4. Add Deal Copilot to Refurb Genius project handoff.
5. Upgrade reports into a shared cross-product reporting surface.
6. Add Refurb IQ BOQ and cost-plan workflows downstream of estimates.
7. Add automation, imports, and background monitoring later.

## Rules

- Do not fork pricing logic.
- Do not fork ROI logic.
- AI may write summaries, scopes, and recommendations.
- AI must not invent financial figures.
- Money comes from deterministic pricing and ROI engines.
- Reports extend the shared report engine instead of creating separate builders.
