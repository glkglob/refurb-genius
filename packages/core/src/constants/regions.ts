// UK regions — canonical ordered list used in dropdowns and pricing.
export const UK_REGIONS = [
  "London",
  "South East England",
  "South West England",
  "East of England",
  "East Midlands",
  "West Midlands",
  "North West England",
  "North East England",
  "Yorkshire and the Humber",
  "Scotland",
  "Wales",
  "Northern Ireland",
] as const;
export type UKRegion = (typeof UK_REGIONS)[number];
