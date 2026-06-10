/**
 * Estimate slice — public API.
 *
 * Other slices and routes import from here only; never from this slice's
 * internal folders. Infrastructure is intentionally not re-exported — wiring
 * code imports it explicitly from `@/features/estimate/infrastructure`.
 *
 * See docs/architecture/FEATURE_SLICE.md.
 */
export * from "./domain";
export * from "./application";
export * from "./presentation";
