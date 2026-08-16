import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import { projectKeys } from "./projects";

/**
 * Stable gallery application row (P1B4).
 * Matches migration-built public_gallery_projects + optional project join.
 * Does not expose obsolete created_by/slug/summary/location columns.
 */
export type PublicGalleryProjectRow = {
  id: string;
  project_id: string;
  is_public: boolean;
  featured: boolean;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  project?: {
    id?: string;
    name?: string;
    address?: string;
    postcode?: string;
    region?: string;
    property_type?: string;
    bedrooms?: number;
    bathrooms?: number;
    size_sqm?: number;
    purchase_price?: number;
    estimated_gdv?: number;
  };
};

type InvestorLeadRow = Tables<"investor_leads">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Map dual-baseline public_gallery_projects row → stable application model.
 */
export function mapPublicGalleryProjectRow(row: unknown): PublicGalleryProjectRow {
  const r = isRecord(row) ? row : {};
  const projectRaw = isRecord(r.project) ? r.project : null;

  const mapped: PublicGalleryProjectRow = {
    id: asString(r.id),
    project_id: asString(r.project_id),
    is_public: asBoolean(r.is_public),
    featured: asBoolean(r.featured),
    title: asNullableString(r.title),
    description: asNullableString(r.description) ?? asNullableString(r.summary),
    cover_image_url: asNullableString(r.cover_image_url),
    view_count: asNumber(r.view_count),
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
  };

  if (projectRaw) {
    mapped.project = {
      id: asNullableString(projectRaw.id) ?? undefined,
      name: asNullableString(projectRaw.name) ?? undefined,
      address: asNullableString(projectRaw.address) ?? undefined,
      postcode: asNullableString(projectRaw.postcode) ?? undefined,
      region: asNullableString(projectRaw.region) ?? undefined,
      property_type: asNullableString(projectRaw.property_type) ?? undefined,
      bedrooms: typeof projectRaw.bedrooms === "number" ? projectRaw.bedrooms : undefined,
      bathrooms: typeof projectRaw.bathrooms === "number" ? projectRaw.bathrooms : undefined,
      size_sqm: typeof projectRaw.size_sqm === "number" ? projectRaw.size_sqm : undefined,
      purchase_price:
        typeof projectRaw.purchase_price === "number" ? projectRaw.purchase_price : undefined,
      estimated_gdv:
        typeof projectRaw.estimated_gdv === "number" ? projectRaw.estimated_gdv : undefined,
    };
  }

  return mapped;
}

export function mapPublicGalleryProjectRows(rows: unknown): PublicGalleryProjectRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapPublicGalleryProjectRow);
}

/**
 * Public gallery keys.
 * Public listing can be fetched by anon (RLS: is_public = true).
 * Owner-specific via project ownership.
 */
export const galleryKeys = {
  all: ["gallery"] as const,
  publicList: () => [...galleryKeys.all, "public"] as const,
  byProject: (projectId: string) => [...projectKeys.galleryByProject(projectId)] as const,
  leadsByGallery: (galleryId: string) => [...galleryKeys.all, "leads", galleryId] as const,
};

/**
 * Public / featured gallery projects (for the public showcase page).
 */
export const publicGalleryProjectsQueryOptions = () =>
  queryOptions<PublicGalleryProjectRow[]>({
    queryKey: galleryKeys.publicList(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_gallery_projects")
        .select(
          `
          *,
          project:projects (
            id,
            name,
            address,
            postcode,
            region,
            property_type,
            bedrooms,
            bathrooms,
            size_sqm,
            purchase_price,
            estimated_gdv
          )
        `,
        )
        .eq("is_public", true)
        .order("featured", { ascending: false })
        .order("view_count", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("[queries] public gallery fetch failed", { error: error.message });
        throw new Error(error.message);
      }
      return mapPublicGalleryProjectRows(data ?? []);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });

/**
 * Gallery entry for a specific project (owner management + status).
 */
export const galleryByProjectQueryOptions = (projectId: string) =>
  queryOptions<PublicGalleryProjectRow | null>({
    queryKey: galleryKeys.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_gallery_projects")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) {
        logger.error("[queries] gallery by project fetch failed", {
          projectId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      if (!data) return null;
      return mapPublicGalleryProjectRow(data);
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

/**
 * Investor leads captured for a gallery project (owner only).
 */
export const investorLeadsQueryOptions = (galleryProjectId: string) =>
  queryOptions<InvestorLeadRow[]>({
    queryKey: galleryKeys.leadsByGallery(galleryProjectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investor_leads")
        .select("*")
        .eq("gallery_project_id", galleryProjectId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[queries] investor leads fetch failed", {
          galleryProjectId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as InvestorLeadRow[];
    },
    enabled: !!galleryProjectId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

/**
 * Public gallery detail by row id (URL param is gallery id, not a slug column).
 */
export const publicGalleryProjectByIdQueryOptions = (galleryId: string) =>
  queryOptions<PublicGalleryProjectRow | null>({
    queryKey: [...galleryKeys.all, "byId", galleryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_gallery_projects")
        .select(
          `
          *,
          project:projects (
            id,
            name,
            address,
            postcode,
            region,
            property_type,
            bedrooms,
            bathrooms,
            size_sqm,
            purchase_price,
            estimated_gdv
          )
        `,
        )
        .eq("id", galleryId)
        .eq("is_public", true)
        .maybeSingle();

      if (error) {
        logger.error("[queries] public gallery by id fetch failed", {
          galleryId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      if (!data) return null;
      return mapPublicGalleryProjectRow(data);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
