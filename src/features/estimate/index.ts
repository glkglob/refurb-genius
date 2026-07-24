/**
 * Estimate slice — public API.
 *
 * Routes, components, and other slices import from here only.
 * Browser-safe persistence helpers are re-exported from infrastructure
 * (Phase 9 C2). Server-only AI adapters remain dynamic-import only and are
 * not part of this barrel.
 *
 * See docs/architecture/FEATURE_SLICE.md.
 */
export * from "./domain";
export * from "./application";
export * from "./presentation";
/** Browser-safe repositories / persistence helpers (public for app consumers). */
export * from "./infrastructure";
