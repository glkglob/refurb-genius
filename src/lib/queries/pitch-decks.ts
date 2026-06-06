import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import type { PitchDeckExport } from "@repo/types";
import { projectKeys } from "./projects";

type PitchDeckExportRow = Tables<"pitch_deck_exports">;

/**
 * Pitch deck exports keys (project scoped).
 */
export const pitchDeckKeys = {
  all: ["pitchDecks"] as const,
  byProject: (projectId: string) => [...projectKeys.pitchDecksByProject(projectId)] as const,
  byId: (exportId: string) => [...pitchDeckKeys.all, exportId] as const,
};

/**
 * List pitch deck exports for a project (history of generated decks).
 * Used by "Generate Pitch Deck" UI + list of previous exports.
 */
export const pitchDecksByProjectQueryOptions = (projectId: string) =>
  queryOptions<PitchDeckExportRow[]>({
    queryKey: pitchDeckKeys.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitch_deck_exports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[queries] pitch decks fetch failed", { projectId, error: error.message });
        throw new Error(error.message);
      }
      return (data ?? []) as PitchDeckExportRow[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // exports are mostly immutable after generation
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

/**
 * Single export (for download / preview after generation).
 */
export const pitchDeckExportQueryOptions = (exportId: string) =>
  queryOptions<PitchDeckExportRow | null>({
    queryKey: pitchDeckKeys.byId(exportId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitch_deck_exports")
        .select("*")
        .eq("id", exportId)
        .maybeSingle();

      if (error) {
        logger.error("[queries] pitch deck export fetch failed", {
          exportId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data as PitchDeckExportRow | null) ?? null;
    },
    enabled: !!exportId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
