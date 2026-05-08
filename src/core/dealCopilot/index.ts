// Deal Copilot — reserved namespace.
//
// This module is intentionally empty. It exists so future acquisition
// workflows have a clear home alongside the other shared engines under
// `@/core/*` without polluting Refurb Genius today.
//
// See ./README.md for the planned surface and integration rules.
//
// TODO(deal-copilot): add submodules as they are built. Suggested layout:
//   - acquisitionPipeline/  — pipeline stages + transitions over projectStore
//   - opportunities/        — inbound candidate deals before they become Projects
//   - savedSearches/        — persisted filter sets reused by alerts + monitoring
//   - alerts/               — notification fan-out for matches + thresholds
//   - monitoring/           — recurring re-scoring via runRoiEngine
//   - automation/           — rules engine that composes the above
//
// HARD RULES (enforced by review, not code):
//   1. Reuse `@/core/projects` for the project schema. No parallel entity.
//   2. Reuse `@/core/pricing` and `@/core/roi` for every number. No new math.
//   3. Extend `@/core/ai` for language/vision only. AI never produces money.
//   4. Extend `@/core/reports` via `ReportSection`s instead of a new builder.

export {};
