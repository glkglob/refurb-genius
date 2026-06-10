/**
 * Export slice — public API.
 *
 * Other slices and routes import from here only; never from this slice's
 * internal folders. Infrastructure is intentionally not re-exported from
 * presentation consumers.
 */
export * from "./domain";
export * from "./application";
export * from "./presentation";
