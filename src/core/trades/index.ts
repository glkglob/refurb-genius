export type {
  TradesJobStatus,
  TradesJobCategory,
  TradesJob,
  CreateTradesJobInput,
  UpdateTradesJobInput,
} from "@repo/types";

export type {
  TradesJobInterestStatus,
  TradesJobInterest,
  CreateTradesJobInterestInput,
} from "@repo/types";

export type { InsuranceStatus, TradeProfile, UpsertTradeProfileInput } from "@repo/types";

export const TRADES_JOB_CATEGORIES: {
  value: import("@repo/types").TradesJobCategory;
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
