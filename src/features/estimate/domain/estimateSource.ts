/**
 * Canonical estimate source classifications.
 *
 * Use this typed contract across L1, L2, L3, Deal Copilot and reports.
 * Do not introduce component-specific source string unions.
 */
export const ESTIMATE_SOURCES = [
  "engine",
  "ai-assisted",
  "fallback",
  "mock",
] as const;

export type EstimateSource = (typeof ESTIMATE_SOURCES)[number];
