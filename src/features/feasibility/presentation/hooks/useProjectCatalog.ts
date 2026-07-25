/**
 * Feasibility Projects catalog adapter (C4c-6).
 *
 * Consumes the canonical Projects list cache (projectKeys.all / projectsListQueryOptions).
 * Does not own a separate query key or network fetch.
 */
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@repo/types";
import { useAuth } from "@/hooks/useAuth";
import type { ProjectWithProgress } from "@/lib/mappers";
import { projectsListQueryOptions } from "@/lib/queries/projects";

/**
 * Pure map from canonical list rows to @repo/types Project.
 * Drops progress flags; preserves core fields used by Analyze / Studies / orchestrator.
 * Missing property_condition continues to default to "Average" inside the orchestrator.
 */
export function toProjectCatalog(projects: ProjectWithProgress[]): Project[] {
  return projects.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    address: p.address,
    postcode: p.postcode,
    region: p.region,
    property_type: p.property_type,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    size_sqm: p.size_sqm,
    purchase_price: p.purchase_price,
    estimated_gdv: p.estimated_gdv,
    notes: p.notes,
    created_at: p.created_at,
    status: p.status,
  }));
}

export function useProjectCatalog() {
  const { user } = useAuth();
  return useQuery({
    ...projectsListQueryOptions(),
    enabled: Boolean(user),
    select: toProjectCatalog,
  });
}
