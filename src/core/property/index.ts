export type PropertyType =
  | "flat"
  | "terraced_house"
  | "semi_detached_house"
  | "detached_house"
  | "bungalow"
  | "commercial"
  | "mixed_use";

export type PropertyCondition = "unknown" | "good" | "tired" | "dated" | "poor" | "heavy_refurb";

export type PropertyAddress = {
  line1?: string;
  line2?: string;
  town?: string;
  postcode?: string;
  region?: string;
  country: "GB";
};

export type PropertyProfile = {
  id: string;
  workspaceId?: string;
  address?: PropertyAddress;
  propertyType: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  floorAreaSqm?: number;
  condition: PropertyCondition;
  createdAt?: string;
  updatedAt?: string;
};
