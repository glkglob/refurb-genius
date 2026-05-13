import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared GBP currency formatter using Intl.NumberFormat.
 * Formats numbers as GBP with no decimal places.
 */
const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * Format a number as GBP currency.
 * Returns "—" for null/undefined values.
 * @param value - The number to format, or null/undefined
 * @returns Formatted GBP string or "—" for null/undefined
 */
export function formatGBP(value: number | null | undefined): string {
  return value == null ? "—" : gbpFormatter.format(value);
}
