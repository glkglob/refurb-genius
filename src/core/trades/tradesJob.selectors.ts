import type { TradesJob, TradesJobCategory, TradesJobStatus } from "./tradesJob.types";
import { TRADES_JOB_CATEGORIES } from "./index";

export function formatCategoryLabel(category: TradesJobCategory): string {
  return TRADES_JOB_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function formatStatus(status: TradesJobStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "posted":
      return "Posted";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function formatBudgetRange(job: Pick<TradesJob, "budgetMin" | "budgetMax">): string {
  const { budgetMin, budgetMax } = job;
  if (budgetMin != null && budgetMax != null) {
    return `£${budgetMin.toLocaleString()} – £${budgetMax.toLocaleString()}`;
  }
  if (budgetMin != null) return `From £${budgetMin.toLocaleString()}`;
  if (budgetMax != null) return `Up to £${budgetMax.toLocaleString()}`;
  return "Not specified";
}

export function formatShortDate(isoString: string | null): string {
  if (!isoString) return "Not specified";
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
