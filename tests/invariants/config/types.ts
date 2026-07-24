/**
 * Shared types for the architecture registry (Phase 2).
 * Registration only — not consumed by enforcement tests yet.
 */

export type Maturity = "live" | "partial" | "reserved" | "stub" | "transitional";

/** Enforcement / documentation status for an area or rule. */
export type RegistryStatus =
  | "enforced"
  | "documented"
  | "transitional"
  | "reserved"
  | "planned"
  | "partial";

export type RuleHorizon = "current" | "future";

export type ExceptionStatus = "active" | "expired" | "removed" | "draft";
