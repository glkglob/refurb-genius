/**
 * AI-upload slice — public API.
 *
 * Routes, components, and other slices import from here only.
 * Browser-safe infrastructure (analysisStore, room-analysis / photo-catalog
 * repositories) is re-exported for app consumers (Phase 10B C7).
 * Server-only Vision adapters remain dynamic-import only and are not part of
 * the infrastructure barrel or this public surface.
 *
 * See docs/architecture/FEATURE_SLICE.md.
 */
export * from "./domain";
export * from "./application";
export * from "./presentation";
/** Browser-safe repositories / analysis cache (public for app consumers). */
export * from "./infrastructure";
