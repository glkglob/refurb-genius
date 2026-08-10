/**
 * PH-TRUTH CIR-TRUTH-02 — Project Overview monetary presentation.
 *
 * Distinguishes unset / unknown from authoritative zero without using
 * JavaScript truthiness alone for positive values.
 */

/** Canonical customer-facing empty state for monetary fields. */
export const MONEY_NOT_SET_LABEL = "Not set";

/**
 * Format a money value that may be unset, zero, or positive.
 *
 * - null / undefined / NaN → "Not set"
 * - 0 → "£0" (authoritative zero)
 * - positive / negative finite → en-GB currency-style pounds
 */
export function formatMoneyPresence(value: number | null | undefined): string {
  if (value === null || value === undefined) return MONEY_NOT_SET_LABEL;
  if (typeof value !== "number" || Number.isNaN(value)) return MONEY_NOT_SET_LABEL;
  if (value === 0) return "£0";
  return `£${value.toLocaleString("en-GB")}`;
}

/**
 * Name-only project creation persists `0` for empty purchase price / GDV
 * (same optional-field convention as size_sqm / bedrooms on Overview).
 * That stored zero means "not provided", not an underwritten £0 purchase.
 *
 * Maps not-provided → null for {@link formatMoneyPresence}.
 * Positive values pass through as authoritative amounts.
 *
 * Callers that already have true null/undefined presence should use
 * {@link formatMoneyPresence} directly (0 remains £0).
 */
export function projectOptionalMoneyForDisplay(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined) return null;
  if (typeof stored !== "number" || Number.isNaN(stored)) return null;
  if (stored === 0) return null;
  return stored;
}
