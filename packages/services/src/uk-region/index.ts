export {
  type RegionSlug,
  type PostcodeRegionResolution,
  REGION_SLUG_TO_UK,
  UK_TO_REGION_SLUG,
  postcodeToUkRegion,
  resolvePostcodeRegion,
} from "./regionMap";
export {
  type AuthoritativePricingRegion,
  type ProjectPricingRegionResult,
  type ProjectPricingRegionSource,
  NAME_ONLY_PLACEHOLDER_REGION,
  UNMAPPED_POSTCODE_REGION_MESSAGE,
  UNRESOLVED_POSTCODE_REGION_MESSAGE,
  isUkRegion,
  regionAfterPostcodeChange,
  requireProjectPricingRegion,
  resolveAuthoritativePricingRegion,
  resolveProjectPricingRegion,
} from "./pricingRegionAuthority";
