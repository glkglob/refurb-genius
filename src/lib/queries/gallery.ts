import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import type { PublicGalleryProject, InvestorLead } from "@repo/types";
import { projectKeys } from "./projects";

export type PublicGalleryProjectRow = Tables<"public_gallery_projects">;
type InvestorLeadRow = Tables<"investor_leads">;

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
 * No auth required for the base list (RLS filters to is_public).
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
      return (data ?? []) as PublicGalleryProjectRow[];
    },
    staleTime: 2 * 60 * 1000, // public content can be a bit fresher
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
      return (data as PublicGalleryProjectRow | null) ?? null;
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
 * Public insert helper note: leads are inserted directly via supabase.from("investor_leads").insert(...)
 * (public policy allows anon insert; no query helper needed for write).
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
      return (data as PublicGalleryProjectRow) ?? null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

/**
 * Public photos for a gallery project (limited public view for demo; in prod may be restricted or use cover only).
 * Falls back gracefully if RLS blocks.
 */
export const publicProjectPhotosQueryOptions = (projectId: string) =>
  queryOptions<Array<{ id: string; url: string; name: string }>>({
    queryKey: ["publicPhotos", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("id, url, name")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: true })
        .limit(12);

      if (error) {
        // Public may not have RLS access to all photos; return empty gracefully
        return [];
      }
      return (data ?? []).map((p) => ({
        id: p.id as string,
        url: p.url as string,
        name: p.name as string,
      }));
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
