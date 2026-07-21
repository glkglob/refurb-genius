/** Map Trades Marketplace job categories → trade rate ids. */
export const JOB_CATEGORY_TO_TRADE_ID: Record<string, string> = {
  general_building: "general_builder",
  electrical: "electrician",
  plumbing: "plumber",
  heating: "plumber",
  kitchen: "kitchen_fitter",
  bathroom: "bathroom_fitter",
  roofing: "roofer",
  decorating: "decorator",
  flooring: "carpenter",
  landscaping: "landscaper",
  other: "general_builder",
};

export function tradeIdForJobCategory(jobCategory?: string): string {
  if (!jobCategory) return "general_builder";
  return JOB_CATEGORY_TO_TRADE_ID[jobCategory] ?? "general_builder";
}
