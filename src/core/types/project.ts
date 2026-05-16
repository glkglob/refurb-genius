// Project — canonical shape consumed across the app and future products.
// Mirrors the `projects` table plus a few derived fields kept in app state.
import type { Project as DbProject } from "@/lib/projects";

export type ProjectStatus = "Draft" | "Analysing" | "Estimated" | "Complete";

// Re-export the DB-aligned Project (id, user_id, name, address, postcode,
// region, property_type, bedrooms, bathrooms, size_sqm, purchase_price,
// estimated_gdv, notes, status, created_at) plus optional extension fields
// for property condition / refurbishment level / updated_at that future
// migrations may add. Optional today, required-ready tomorrow.
export type Project = DbProject & {
  property_condition?: import("./analysis").ConditionLevel;
  refurbishment_level?: import("./analysis").RefurbLevel;
  updated_at?: string;
};

export type { NewProjectInput, ProjectStage, PropertyType, UKRegion } from "@/lib/projects";
