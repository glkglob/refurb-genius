import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import type { PublicGalleryProject, InvestorLead } from "@repo/types";
import { projectKeys } from "./projects";

type PublicGalleryProjectRow = Tables<"public_gallery_projects">;
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
        .select("*")
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
