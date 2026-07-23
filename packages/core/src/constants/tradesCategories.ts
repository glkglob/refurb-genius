import type { TradesJobCategory } from "@repo/types";

/** Shared labels for trades job categories — pure data, no UI. */
export const TRADES_JOB_CATEGORIES: {
  value: TradesJobCategory;
  label: string;
}[] = [
  { value: "general_building", label: "General Building" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "heating", label: "Heating & Gas" },
  { value: "kitchen", label: "Kitchen Fitting" },
  { value: "bathroom", label: "Bathroom Fitting" },
  { value: "roofing", label: "Roofing" },
  { value: "decorating", label: "Decorating" },
  { value: "flooring", label: "Flooring" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
];
