/**
 * UK trade day rates — adapted from refurb-estimator `lib/pricing/trade-rates.ts`
 * (Checkatrade / TraderStreet 2026 sources). Multipliers use Refurb Genius UKRegion.
 */
import type { UKRegion } from "@/lib/projects";
import { postcodeToUkRegion, type RegionSlug } from "../uk-region";

export type TradeRate = {
  id: string;
  label: string;
  hourlyRateMin: number;
  hourlyRateMax: number;
  dayRateMin: number;
  dayRateMax: number;
  typicalDaysLow: number;
  typicalDaysHigh: number;
  regionalMultiplier: Record<UKRegion, number>;
  notes: string;
  lastUpdated: string;
  source: string;
};

type SlugMultipliers = Record<RegionSlug, number>;

function toUkMultipliers(slugMap: SlugMultipliers): Record<UKRegion, number> {
  return {
    London: slugMap.london,
    "South East England": slugMap.south_east,
    "East of England": slugMap.east_of_england,
    "East Midlands": slugMap.east_midlands,
    "West Midlands": slugMap.west_midlands,
    "South West England": slugMap.south_west,
    "North West England": slugMap.north_west,
    "North East England": slugMap.north_east,
    "Yorkshire and the Humber": slugMap.yorkshire_and_humber,
    Scotland: slugMap.scotland,
    Wales: slugMap.wales,
    "Northern Ireland": slugMap.northern_ireland,
  };
}

function rate(
  partial: Omit<TradeRate, "regionalMultiplier"> & { regionalMultiplier: SlugMultipliers },
): TradeRate {
  return {
    ...partial,
    regionalMultiplier: toUkMultipliers(partial.regionalMultiplier),
  };
}

/** Authoritative 2026 UK trade rates (from refurb-estimator). */
export const TRADE_RATES: TradeRate[] = [
  rate({
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
  }),
  rate({
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
  }),
  rate({
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
    source: "Checkatrade 2026",
  }),
  rate({
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
    notes: "NICEIC/NAPIT certified work commands a premium.",
    lastUpdated: "2026-04-02",
    source: "Logic4Training / Superscript 2026",
  }),
  rate({
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
    source: "Checkatrade 2026",
  }),
  rate({
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
    notes: "Often prices per m² for skimming (GBP 6–12/m²) rather than day rate.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  }),
  rate({
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
    notes: "Paint and materials excluded.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  }),
  rate({
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
    notes: "Scaffold costs are additional.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  }),
  rate({
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
    notes: "First and second fix are separate visits.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  }),
  rate({
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
    notes: "Hard landscaping (paving, decking) is higher.",
    lastUpdated: "2026-04-02",
    source: "Checkatrade 2026",
  }),
];

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

export function getTradeRate(id: string): TradeRate {
  const found = TRADE_RATES.find((t) => t.id === id);
  if (!found) throw new Error(`No trade rate found for id: "${id}"`);
  return found;
}

/** Regional labour cost band for a trade × days. */
export function estimateLabourCost(
  tradeId: string,
  days: number,
  region: UKRegion = "West Midlands",
): { low: number; mid: number; high: number } {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Days must be a positive number. Received: ${days}`);
  }
  const trade = getTradeRate(tradeId);
  const multiplier = trade.regionalMultiplier[region] ?? 1;
  return {
    low: Math.round(trade.dayRateMin * multiplier * days),
    mid: Math.round(((trade.dayRateMin + trade.dayRateMax) / 2) * multiplier * days),
    high: Math.round(trade.dayRateMax * multiplier * days),
  };
}

export function estimateLabourCostForPostcode(
  tradeId: string,
  days: number,
  postcode: string,
): { low: number; mid: number; high: number; region: UKRegion } {
  const region = postcodeToUkRegion(postcode);
  return { ...estimateLabourCost(tradeId, days, region), region };
}

export const TRADE_RATES_METADATA = {
  lastUpdated: "2026-04-02",
  annualUpliftPct: 9.5,
  currency: "GBP",
  notes: "Rates from Checkatrade, TraderStreet, Superscript. Labour only, ex-VAT.",
  sourceRepo: "https://github.com/glkglob/refurb-estimator",
} as const;
