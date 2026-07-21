/**
 * Region helpers ported/adapted from refurb-estimator (glkglob/refurb-estimator).
 * Maps between slug-style region keys and Refurb Genius UKRegion labels.
 */
import type { UKRegion } from "@/lib/projects";

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

/** Infer UK region from a UK postcode (district or full). Defaults to London. */
export function postcodeToUkRegion(postcode: string): UKRegion {
  const area = extractPostcodeArea(postcode);
  if (LONDON.has(area)) return "London";
  if (SOUTH_EAST.has(area)) return "South East England";
  if (SOUTH_WEST.has(area)) return "South West England";
  if (EAST_OF_ENGLAND.has(area)) return "East of England";
  if (EAST_MIDLANDS.has(area)) return "East Midlands";
  if (WEST_MIDLANDS.has(area)) return "West Midlands";
  if (NORTH_WEST.has(area)) return "North West England";
  if (NORTH_EAST.has(area)) return "North East England";
  if (YORKSHIRE.has(area)) return "Yorkshire and the Humber";
  if (SCOTLAND.has(area)) return "Scotland";
  if (WALES.has(area)) return "Wales";
  if (NORTHERN_IRELAND.has(area)) return "Northern Ireland";
  return "London";
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
