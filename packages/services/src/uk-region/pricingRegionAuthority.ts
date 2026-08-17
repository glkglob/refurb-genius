/**
 * Canonical postcode → pricing-region authority.
 *
 * When a postcode maps, it is authoritative. Unknown/invalid postcodes never
 * become London. Name-only projects (missing postcode, no explicit region)
 * persist the documented placeholder London so the NOT NULL column is filled.
 */
import { UK_REGIONS, type UKRegion } from "@repo/types";
import { resolvePostcodeRegion } from "./regionMap";

export const NAME_ONLY_PLACEHOLDER_REGION: UKRegion = "London";

export const UNRESOLVED_POSTCODE_REGION_MESSAGE =
  "Enter a recognised UK postcode or choose a region.";

export const UNMAPPED_POSTCODE_REGION_MESSAGE =
  "Region cannot be determined because the postcode area was missing or unrecognised";

export type AuthoritativePricingRegion =
  | { status: "matched"; area: string; region: UKRegion }
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "unknown"; area: string };

export function isUkRegion(value: unknown): value is UKRegion {
  return typeof value === "string" && (UK_REGIONS as readonly string[]).includes(value);
}

export function resolveAuthoritativePricingRegion(
  postcode: string | null | undefined,
): AuthoritativePricingRegion {
  if (postcode == null || postcode.trim() === "") {
    return { status: "missing" };
  }

  const resolved = resolvePostcodeRegion(postcode);
  if (resolved.matched && resolved.region) {
    return { status: "matched", area: resolved.area, region: resolved.region };
  }
  if (!resolved.area) {
    return { status: "invalid" };
  }
  return { status: "unknown", area: resolved.area };
}

export type ProjectPricingRegionSource = "postcode" | "explicit" | "name-only-placeholder";

export type ProjectPricingRegionResult =
  | { ok: true; region: UKRegion; source: ProjectPricingRegionSource }
  | { ok: false; reason: "unresolved" };

/**
 * Resolve the region a project/estimate should use.
 * Matched postcodes win over any stored/explicit region.
 */
export function resolveProjectPricingRegion(input: {
  postcode?: string | null;
  explicitRegion?: string | null;
}): ProjectPricingRegionResult {
  const mapped = resolveAuthoritativePricingRegion(input.postcode);
  if (mapped.status === "matched") {
    return { ok: true, region: mapped.region, source: "postcode" };
  }
  if (isUkRegion(input.explicitRegion)) {
    return { ok: true, region: input.explicitRegion, source: "explicit" };
  }
  if (mapped.status === "missing") {
    return {
      ok: true,
      region: NAME_ONLY_PLACEHOLDER_REGION,
      source: "name-only-placeholder",
    };
  }
  return { ok: false, reason: "unresolved" };
}

export function requireProjectPricingRegion(input: {
  postcode?: string | null;
  explicitRegion?: string | null;
}): { region: UKRegion; source: ProjectPricingRegionSource } {
  const result = resolveProjectPricingRegion(input);
  if (!result.ok) {
    throw new Error(UNRESOLVED_POSTCODE_REGION_MESSAGE);
  }
  return result;
}

/** When a project postcode changes, rematch; matched postcodes overwrite region. */
export function regionAfterPostcodeChange(input: {
  nextPostcode: string;
  previousRegion?: string | null;
}): ProjectPricingRegionResult {
  return resolveProjectPricingRegion({
    postcode: input.nextPostcode,
    explicitRegion: input.previousRegion,
  });
}
