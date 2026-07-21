/* 12 UK NUTS-1 regions */
export type Region =
  | "north_east"
  | "north_west"
  | "yorkshire_and_humber"
  | "east_midlands"
  | "west_midlands"
  | "east_of_england"
  | "london"
  | "south_east"
  | "south_west"
  | "scotland"
  | "wales"
  | "northern_ireland";

export type LabourRegion = Region | "midlands";

export interface TradeRate {
  id: string;
  label: string;
  hourlyRateMin: number;
  hourlyRateMax: number;
  dayRateMin: number;
  dayRateMax: number;
  typicalDaysLow: number;
  typicalDaysHigh: number;
  regionalMultiplier: Record<Region, number>;
  notes: string;
  lastUpdated: string;
  source: string;
}

export const LABOUR_REGION_OPTIONS: Array<{ value: LabourRegion; label: string }> = [
  { value: "midlands", label: "Midlands" },
  { value: "north_east", label: "North East" },
  { value: "north_west", label: "North West" },
  { value: "yorkshire_and_humber", label: "Yorkshire and Humber" },
  { value: "east_midlands", label: "East Midlands" },
  { value: "west_midlands", label: "West Midlands" },
  { value: "east_of_england", label: "East of England" },
  { value: "london", label: "London" },
  { value: "south_east", label: "South East" },
  { value: "south_west", label: "South West" },
  { value: "scotland", label: "Scotland" },
  { value: "wales", label: "Wales" },
  { value: "northern_ireland", label: "Northern Ireland" },
];

/** Authoritative 2026 UK trade rates (regional multipliers for all 12 regions) */
export const TRADE_RATES: TradeRate[] = [
  {
    id: "general_builder",
    label: "General Builder",
    hourlyRateMin: 30,
    hourlyRateMax: 50,
    dayRateMin: 200,
    dayRateMax: 350,
    typicalDaysLow: 1,
    typicalDaysHigh: 5,
    regionalMultiplier: {
      north_east: 0.9,
      north_west: 0.92,
      yorkshire_and_humber: 0.88,
      east_midlands: 0.95,
      west_midlands: 0.96,
      east_of_england: 1.0,
      london: 1.25,
      south_east: 1.12,
      south_west: 1.08,
      scotland: 0.92,
      wales: 0.86,
      northern_ireland: 0.84,
    },
    notes: "Extends to GBP 400/day for experienced specialist work. Excludes materials.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026, TraderStreet Feb 2026",
  },
  {
    id: "kitchen_fitter",
    label: "Kitchen Fitter",
    hourlyRateMin: 25,
    hourlyRateMax: 40,
    dayRateMin: 250,
    dayRateMax: 350,
    typicalDaysLow: 3,
    typicalDaysHigh: 7,
    regionalMultiplier: {
      north_east: 0.88,
      north_west: 0.9,
      yorkshire_and_humber: 0.86,
      east_midlands: 0.94,
      west_midlands: 0.95,
      east_of_england: 1.0,
      london: 1.22,
      south_east: 1.1,
      south_west: 1.07,
      scotland: 0.91,
      wales: 0.85,
      northern_ireland: 0.83,
    },
    notes: "Labour only. Excludes units, appliances, and plumbing/electrical first-fix.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  },
  {
    id: "bathroom_fitter",
    label: "Bathroom Fitter",
    hourlyRateMin: 30,
    hourlyRateMax: 50,
    dayRateMin: 200,
    dayRateMax: 350,
    typicalDaysLow: 7,
    typicalDaysHigh: 14,
    regionalMultiplier: {
      north_east: 0.88,
      north_west: 0.9,
      yorkshire_and_humber: 0.86,
      east_midlands: 0.94,
      west_midlands: 0.95,
      east_of_england: 1.0,
      london: 1.22,
      south_east: 1.1,
      south_west: 1.07,
      scotland: 0.91,
      wales: 0.85,
      northern_ireland: 0.83,
    },
    notes: "Full refit takes 7-14 days. Excludes sanitaryware and tiles.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026, drukarnia.com.ua 2026 guide",
  },
  {
    id: "electrician",
    label: "Electrician",
    hourlyRateMin: 40,
    hourlyRateMax: 70,
    dayRateMin: 300,
    dayRateMax: 500,
    typicalDaysLow: 1,
    typicalDaysHigh: 3,
    regionalMultiplier: {
      north_east: 0.92,
      north_west: 0.94,
      yorkshire_and_humber: 0.9,
      east_midlands: 1.02,
      west_midlands: 1.03,
      east_of_england: 1.05,
      london: 1.3,
      south_east: 1.18,
      south_west: 1.12,
      scotland: 0.95,
      wales: 0.88,
      northern_ireland: 0.86,
    },
    notes: "Average ~GBP 335/day nationally. NICEIC/NAPIT certified work commands a premium.",
    lastUpdated: "2026-04-02",
    source: "Logic4Training Feb 2025, Superscript Feb 2026",
  },
  {
    id: "plumber",
    label: "Plumber",
    hourlyRateMin: 40,
    hourlyRateMax: 60,
    dayRateMin: 320,
    dayRateMax: 480,
    typicalDaysLow: 1,
    typicalDaysHigh: 3,
    regionalMultiplier: {
      north_east: 0.9,
      north_west: 0.92,
      yorkshire_and_humber: 0.88,
      east_midlands: 0.96,
      west_midlands: 0.97,
      east_of_england: 1.0,
      london: 1.28,
      south_east: 1.15,
      south_west: 1.1,
      scotland: 0.92,
      wales: 0.86,
      northern_ireland: 0.84,
    },
    notes: "Gas Safe registered engineer slightly higher at GBP 35+/hr average.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026, buildbetterthings 2025",
  },
  {
    id: "plasterer",
    label: "Plasterer",
    hourlyRateMin: 37,
    hourlyRateMax: 50,
    dayRateMin: 300,
    dayRateMax: 350,
    typicalDaysLow: 1,
    typicalDaysHigh: 5,
    regionalMultiplier: {
      north_east: 0.91,
      north_west: 0.93,
      yorkshire_and_humber: 0.89,
      east_midlands: 0.97,
      west_midlands: 0.98,
      east_of_england: 1.0,
      london: 1.2,
      south_east: 1.1,
      south_west: 1.07,
      scotland: 0.9,
      wales: 0.85,
      northern_ireland: 0.83,
    },
    notes: "Often prices per m² for skimming (GBP 6-GBP 12/m²) rather than day rate.",
    lastUpdated: "2026-04-02",
    source: "buildbetterthings 2025, Checkatrade 2026",
  },
  {
    id: "decorator",
    label: "Decorator",
    hourlyRateMin: 30,
    hourlyRateMax: 40,
    dayRateMin: 250,
    dayRateMax: 350,
    typicalDaysLow: 1,
    typicalDaysHigh: 5,
    regionalMultiplier: {
      north_east: 0.91,
      north_west: 0.93,
      yorkshire_and_humber: 0.89,
      east_midlands: 0.97,
      west_midlands: 0.98,
      east_of_england: 1.0,
      london: 1.2,
      south_east: 1.1,
      south_west: 1.07,
      scotland: 0.9,
      wales: 0.85,
      northern_ireland: 0.83,
    },
    notes: "Cheaper outside London/South East. Paint and materials excluded.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  },
  {
    id: "roofer",
    label: "Roofer",
    hourlyRateMin: 35,
    hourlyRateMax: 45,
    dayRateMin: 280,
    dayRateMax: 400,
    typicalDaysLow: 1,
    typicalDaysHigh: 5,
    regionalMultiplier: {
      north_east: 0.92,
      north_west: 0.94,
      yorkshire_and_humber: 0.9,
      east_midlands: 0.98,
      west_midlands: 0.99,
      east_of_england: 1.0,
      london: 1.22,
      south_east: 1.12,
      south_west: 1.09,
      scotland: 0.92,
      wales: 0.86,
      northern_ireland: 0.84,
    },
    notes: "Emergency/weekend call-out jumps to GBP 60+/hr. Scaffold costs are additional.",
    lastUpdated: "2026-04-02",
    source: "PureSeal Oct 2025, Checkatrade 2026",
  },
  {
    id: "carpenter",
    label: "Carpenter",
    hourlyRateMin: 30,
    hourlyRateMax: 45,
    dayRateMin: 240,
    dayRateMax: 360,
    typicalDaysLow: 1,
    typicalDaysHigh: 5,
    regionalMultiplier: {
      north_east: 0.92,
      north_west: 0.94,
      yorkshire_and_humber: 0.9,
      east_midlands: 0.98,
      west_midlands: 0.99,
      east_of_england: 1.0,
      london: 1.22,
      south_east: 1.12,
      south_west: 1.09,
      scotland: 0.91,
      wales: 0.85,
      northern_ireland: 0.83,
    },
    notes: "Joiner rates similar at ~GBP 280/day. First and second fix are separate visits.",
    lastUpdated: "2026-04-02",
    source: "buildbetterthings 2025, costestimator 2026",
  },
  {
    id: "landscaper",
    label: "Landscaper",
    hourlyRateMin: 20,
    hourlyRateMax: 30,
    dayRateMin: 180,
    dayRateMax: 280,
    typicalDaysLow: 1,
    typicalDaysHigh: 5,
    regionalMultiplier: {
      north_east: 0.9,
      north_west: 0.92,
      yorkshire_and_humber: 0.88,
      east_midlands: 0.96,
      west_midlands: 0.97,
      east_of_england: 1.0,
      london: 1.18,
      south_east: 1.1,
      south_west: 1.07,
      scotland: 0.9,
      wales: 0.85,
      northern_ireland: 0.84,
    },
    notes: "Day rate varies with crew size. Hard landscaping (paving, decking) is higher.",
    lastUpdated: "2026-04-02",
    source: "MyJobQuote Feb 2026, Checkatrade 2026",
  },
];

/** Standardized daily rates used by Labour Assumptions UI rows */
export const TRADE_DAILY_RATES: Record<string, number> = {
  general_builder: 275,
  kitchen_fitter: 300,
  bathroom_fitter: 275,
  electrician: 400,
  plumber: 400,
  plasterer: 325,
  decorator: 300,
  roofer: 340,
  carpenter: 300,
  landscaper: 230,
};

/** Look up a single trade by id. Throws if not found. */
export function getTradeRate(id: string): TradeRate {
  const rate = TRADE_RATES.find((tradeRate) => tradeRate.id === id);
  if (!rate) {
    throw new Error(`No trade rate found for id: "${id}"`);
  }

  return rate;
}

/**
 * Calculate low, midpoint, and high day-rate totals adjusted by region and days.
 * The default "midlands" baseline uses a neutral 1.00 multiplier.
 */
export function estimateLabourCost(
  tradeId: string,
  days: number,
  region: LabourRegion = "midlands",
): { low: number; mid: number; high: number } {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Days must be a positive number. Received: ${days}`);
  }

  const rate = getTradeRate(tradeId);
  const multiplier = region === "midlands" ? 1 : rate.regionalMultiplier[region];

  return {
    low: Math.round(rate.dayRateMin * multiplier * days),
    mid: Math.round(((rate.dayRateMin + rate.dayRateMax) / 2) * multiplier * days),
    high: Math.round(rate.dayRateMax * multiplier * days),
  };
}

/** UI-visible metadata for badges and footers */
export const RATES_METADATA = {
  lastUpdated: "2026-04-02",
  annualUpliftPct: 9.5,
  currency: "GBP",
  notes: "Rates from Checkatrade, TraderStreet, Superscript. Labour only, ex-VAT.",
} as const;
