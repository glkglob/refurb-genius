// Refurb IQ — reserved namespace.
//
// This module is intentionally empty. It exists so future professional
// workflows (BOQ, specifications, cost plans, contractor tools, client
// exports) have a clear home alongside the other shared engines under
// `@/core/*` without polluting Refurb Genius today.
//
// See ./README.md for the planned surface and integration rules.
//
// TODO(refurb-iq): add submodules as they are built. Suggested layout:
//   - boq/             — Bill of Quantities expanded from PricingEstimateItem
//   - specification/   — written work-section specs via @/core/ai language
//   - costPlans/       — stage-based cost plans wrapping runPricingEngine
//   - contractors/     — tender packs, bid comparison, valuations, snagging
//   - clientExports/   — branded PDF/DOCX built on buildReport sections
//
// HARD RULES (enforced by review, not code):
//   1. Reuse `@/core/projects` for the project schema. No parallel entity.
//   2. Reuse `@/core/pricing` for every rate / quantity total. No new math.
//   3. Extend `@/core/ai` for spec / scope prose only. AI never produces
//      quantities, rates, or totals.
//   4. Extend `@/core/reports` via `ReportSection`s instead of a new builder.

export {};
