// Canonical row → domain-object mappers.
//
// These replace the duplicated `rowToProject` and `rowToPhoto` functions
// that lived in both `src/hooks/` and `src/lib/`. All call-sites should
// import from here.

import type { Tables } from "@repo/supabase";
import type { ProjectPhoto } from "./photos";
import type { UKRegion, PropertyType, ProjectStatus } from "./projects";

// ── Project row types ─────────────────────────────────────────────

/** A Supabase `projects` row, typed via the generated schema. */
type ProjectRow = Tables<"projects">;

/** Domain object with progress booleans. Used by both the external store
 *  (`src/lib/projects.ts`) and the React Query hook (`src/hooks/useProjects.ts`). */
export type ProjectWithProgress = {
  id: string;
  user_id: string;
  name: string;
  address: string;
  postcode: string;
  region: UKRegion;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number;
  purchase_price: number;
  estimated_gdv: number;
  notes: string;
  created_at: string;
  status: ProjectStatus;
  photos_done: boolean;
  analysis_done: boolean;
  estimate_done: boolean;
  report_done: boolean;
};

/**
 * Map a Supabase `projects` row to a `ProjectWithProgress`.
 *
 * Applies safe defaults for nullable columns and coerces string-typed
 * region / property_type / status to their domain union types.
 */
export function rowToProject(r: ProjectRow): ProjectWithProgress {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    address: r.address ?? "",
    postcode: r.postcode ?? "",
    region: r.region as UKRegion,
    property_type: r.property_type as PropertyType,
    bedrooms: Number(r.bedrooms ?? 0),
    bathrooms: Number(r.bathrooms ?? 0),
    size_sqm: Number(r.size_sqm ?? 0),
    purchase_price: Number(r.purchase_price ?? 0),
    estimated_gdv: Number(r.estimated_gdv ?? 0),
    notes: r.notes ?? "",
    created_at: r.created_at,
    status: (r.status ?? "Draft") as ProjectStatus,
    photos_done: !!r.photos_done,
    analysis_done: !!r.analysis_done,
    estimate_done: !!r.estimate_done,
    report_done: !!r.report_done,
  };
}

// ── Photo row types ───────────────────────────────────────────────

/** A Supabase `photos` row, typed via the generated schema. */
type PhotoRow = Tables<"photos">;

/**
 * Map a Supabase `photos` row to a `ProjectPhoto`.
 */
export function rowToPhoto(r: PhotoRow): ProjectPhoto {
  return {
    id: r.id,
    projectId: r.project_id,
    url: r.url,
    name: r.name,
    size: Number(r.size ?? 0),
    uploadedAt: r.uploaded_at,
    storagePath: r.storage_path,
  };
}
