/**
 * ROI slice — public API.
 *
 * Deterministic ROI metrics + scenario modeling with an application service
 * surface. Infrastructure is intentionally not re-exported — composition code
 * imports it from `@/features/roi/infrastructure`.
 */
export * from "./domain";
export * from "./application";
export * from "./presentation";
