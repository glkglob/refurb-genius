/**
 * Region helpers ported/adapted from refurb-estimator (glkglob/refurb-estimator).
 * Maps between slug-style region keys and Refurb Genius UKRegion labels.
 */
import type { UKRegion } from "@repo/types";

/** Slug keys used in the estimator cost library / trade rates data. */
export type RegionSlug =
  | "london"
  | "south_east"
  | "east_of_england"
  | "east_midlands"
  | "west_midlands"
  | "south_west"
  | "north_west"
  | "north_east"
  | "yorkshire_and_humber"
  | "scotland"
  | "wales"
  | "northern_ireland";

export const REGION_SLUG_TO_UK: Record<RegionSlug, UKRegion> = {
  london: "London",
  south_east: "South East England",
  east_of_england: "East of England",
  east_midlands: "East Midlands",
  west_midlands: "West Midlands",
  south_west: "South West England",
  north_west: "North West England",
  north_east: "North East England",
  yorkshire_and_humber: "Yorkshire and the Humber",
  scotland: "Scotland",
  wales: "Wales",
  northern_ireland: "Northern Ireland",
};

export const UK_TO_REGION_SLUG: Record<UKRegion, RegionSlug> = {
  London: "london",
  "South East England": "south_east",
  "East of England": "east_of_england",
  "East Midlands": "east_midlands",
  "West Midlands": "west_midlands",
  "South West England": "south_west",
  "North West England": "north_west",
  "North East England": "north_east",
  "Yorkshire and the Humber": "yorkshire_and_humber",
  Scotland: "scotland",
  Wales: "wales",
  "Northern Ireland": "northern_ireland",
};

/** Resolution of a postcode area to a UK region, including match honesty. */
export type PostcodeRegionResolution = {
  area: string;
  /** Canonical region when matched; never a silent London fallback. */
  region: UKRegion | null;
  /** True only when the postcode area is present in the canonical area sets. */
  matched: boolean;
};

/**
 * Resolve a UK postcode (district or full) to a region with an explicit match flag.
 * Unknown, empty or malformed areas return matched=false and region=null.
 * They must not be silently converted to London.
 */
export function resolvePostcodeRegion(postcode: string): PostcodeRegionResolution {
  const area = extractPostcodeArea(postcode);

  if (LONDON.has(area)) {
    return { area, region: "London", matched: true };
  }
  if (SOUTH_EAST.has(area)) {
    return { area, region: "South East England", matched: true };
  }
  if (SOUTH_WEST.has(area)) {
    return { area, region: "South West England", matched: true };
  }
  if (EAST_OF_ENGLAND.has(area)) {
    return { area, region: "East of England", matched: true };
  }
  if (EAST_MIDLANDS.has(area)) {
    return { area, region: "East Midlands", matched: true };
  }
  if (WEST_MIDLANDS.has(area)) {
    return { area, region: "West Midlands", matched: true };
  }
  if (NORTH_WEST.has(area)) {
    return { area, region: "North West England", matched: true };
  }
  if (NORTH_EAST.has(area)) {
    return { area, region: "North East England", matched: true };
  }
  if (YORKSHIRE.has(area)) {
    return { area, region: "Yorkshire and the Humber", matched: true };
  }
  if (SCOTLAND.has(area)) {
    return { area, region: "Scotland", matched: true };
  }
  if (WALES.has(area)) {
    return { area, region: "Wales", matched: true };
  }
  if (NORTHERN_IRELAND.has(area)) {
    return { area, region: "Northern Ireland", matched: true };
  }

  return {
    area,
    region: null,
    matched: false,
  };
}

/** Infer UK region from a UK postcode. Returns null when the area is unknown. */
export function postcodeToUkRegion(postcode: string): UKRegion | null {
  const resolved = resolvePostcodeRegion(postcode);
  return resolved.matched ? resolved.region : null;
}

function extractPostcodeArea(postcode: string): string {
  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/^[A-Z]{1,2}/);
  return match ? match[0] : "";
}

const LONDON = new Set([
  "E",
  "EC",
  "N",
  "NW",
  "SE",
  "SW",
  "W",
  "WC",
  "BR",
  "CR",
  "DA",
  "EN",
  "HA",
  "IG",
  "KT",
  "RM",
  "SM",
  "TW",
  "UB",
  "WD",
]);
const SOUTH_EAST = new Set([
  "BN",
  "CT",
  "GU",
  "ME",
  "MK",
  "OX",
  "PO",
  "RG",
  "RH",
  "SL",
  "SO",
  "TN",
]);
const SOUTH_WEST = new Set([
  "BA",
  "BH",
  "BS",
  "DT",
  "EX",
  "GL",
  "PL",
  "SN",
  "SP",
  "TA",
  "TQ",
  "TR",
]);
const EAST_OF_ENGLAND = new Set(["AL", "CB", "CM", "CO", "IP", "LU", "NR", "PE", "SG", "SS"]);
const EAST_MIDLANDS = new Set(["DE", "DN", "LE", "LN", "NG", "NN"]);
const WEST_MIDLANDS = new Set(["B", "CV", "DY", "HR", "ST", "TF", "WR", "WS", "WV"]);
const NORTH_WEST = new Set([
  "BB",
  "BL",
  "CA",
  "CH",
  "CW",
  "FY",
  "L",
  "LA",
  "M",
  "OL",
  "PR",
  "SK",
  "WA",
  "WN",
]);
const NORTH_EAST = new Set(["DH", "DL", "NE", "SR", "TS"]);
const YORKSHIRE = new Set(["BD", "DN", "HD", "HG", "HU", "HX", "LS", "S", "WF", "YO"]);
const SCOTLAND = new Set([
  "AB",
  "DD",
  "DG",
  "EH",
  "FK",
  "G",
  "HS",
  "IV",
  "KA",
  "KW",
  "KY",
  "ML",
  "PA",
  "PH",
  "TD",
  "ZE",
]);
const WALES = new Set(["CF", "LD", "LL", "NP", "SA", "SY"]);
const NORTHERN_IRELAND = new Set(["BT"]);
