/**
 * Exact freeze allowlists — source of truth for Phase 3+.
 * Consumed by tests/invariants/legacy-layer-freeze.invariant.test.ts.
 * Path sets must remain exactly equivalent to historical freezes.
 */
export const LIB_ALLOWLIST = [
  "src/lib/ai-quality-audit.ts",
  "src/lib/ai-quality-feedback.ts",
  "src/lib/analytics.ts",
  "src/lib/auth.ts",
  "src/lib/concurrency.ts",
  "src/lib/deal-copilot/dealAnalysis.ts",
  "src/lib/deal-copilot/dealFormatting.ts",
  "src/lib/deal-copilot/dealValidation.ts",
  "src/lib/deal-copilot/diagnostics.ts",
  "src/lib/deal-copilot/safety.ts",
  "src/lib/email.ts",
  "src/lib/env-validation.ts",
  "src/lib/error-capture.ts",
  "src/lib/error-page.ts",
  "src/lib/estimate.ts",
  "src/lib/exportPdf.ts",
  "src/lib/file-utils.ts",
  "src/lib/floorplan.ts",
  "src/lib/gallery.ts",
  "src/lib/logger.ts",
  "src/lib/mappers.ts",
  "src/lib/mockData.ts",
  "src/lib/observability.ts",
  "src/lib/photos.ts",
  "src/lib/pitchDeck.test.ts",
  "src/lib/pitchDeck.ts",
  "src/lib/projects.ts",
  "src/lib/provider-diagnostics.ts",
  "src/lib/provider-health-analysis.ts",
  "src/lib/provider-validation-fixtures.ts",
  "src/lib/queries/floorplans.test.ts",
  "src/lib/queries/floorplans.ts",
  "src/lib/queries/gallery.test.ts",
  "src/lib/queries/gallery.ts",
  "src/lib/queries/marketplace.test.ts",
  "src/lib/queries/marketplace.ts",
  "src/lib/queries/photo-analysis.test.ts",
  "src/lib/queries/photo-analysis.ts",
  "src/lib/queries/pitch-decks.test.ts",
  "src/lib/queries/pitch-decks.ts",
  "src/lib/queries/projects.ts",
  "src/lib/rate-limit.ts",
  "src/lib/redesign.ts",
  "src/lib/role.ts",
  "src/lib/sentry.ts",
  "src/lib/telemetry.ts",
  "src/lib/timeout.ts",
  "src/lib/utils.ts",
] as const;

export const LIB_ALLOWLIST_SET = new Set<string>(LIB_ALLOWLIST);

export const HOOKS_ALLOWLIST = [
  "src/hooks/use-mobile.tsx",
  "src/hooks/useAuth.ts",
  "src/hooks/useGallery.ts",
  "src/hooks/useOpportunities.ts",
  "src/hooks/useProjects.ts",
  "src/hooks/useRole.ts",
  "src/hooks/useTheme.ts",
] as const;

export const HOOKS_ALLOWLIST_SET = new Set<string>(HOOKS_ALLOWLIST);

export const SERVICES_ALLOWLIST = [
  "src/services/projects/index.ts",
  "src/services/storage/index.ts",
  "src/services/trades/tradeProfileStore.ts",
  "src/services/trades/tradesJobInterestStore.ts",
  "src/services/trades/tradesJobStore.ts",
] as const;

export const SERVICES_ALLOWLIST_SET = new Set<string>(SERVICES_ALLOWLIST);
