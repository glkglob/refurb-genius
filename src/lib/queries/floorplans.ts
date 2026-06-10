import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import type { FloorplanModel, FloorplanAnnotation, FloorplanMeasurement } from "@repo/types";
import { projectKeys } from "./projects";

type FloorplanModelRow = Tables<"floorplan_models">;
type FloorplanAnnotationRow = Tables<"floorplan_annotations">;
type FloorplanMeasurementRow = Tables<"floorplan_measurements">;

/**
 * Query key factory for 3D floorplan models (per-project).
 * Consistent with projectKeys style for easy invalidation from project mutations.
 */
export const floorplanKeys = {
  all: ["floorplans"] as const,
  byProject: (projectId: string) => [...projectKeys.floorplansByProject(projectId)] as const,
  byId: (modelId: string) => [...floorplanKeys.all, modelId] as const,
  annotationsByModel: (modelId: string) => [...floorplanKeys.byId(modelId), "annotations"] as const,
  measurementsByModel: (modelId: string) =>
    [...floorplanKeys.byId(modelId), "measurements"] as const,
};

/**
 * List floorplan models for a project.
 * Fresh-ish data (models change on upload/processing).
 */
export const floorplansByProjectQueryOptions = (projectId: string) =>
  queryOptions<FloorplanModelRow[]>({
    queryKey: floorplanKeys.byProject(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floorplan_models")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("[queries] floorplans fetch failed", { projectId, error: error.message });
        throw new Error(error.message);
      }
      return (data ?? []) as FloorplanModelRow[];
    },
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 min
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

/**
 * Single floorplan model (for 3D viewer / editor).
 */
export const floorplanModelQueryOptions = (modelId: string) =>
  queryOptions<FloorplanModelRow | null>({
    queryKey: floorplanKeys.byId(modelId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floorplan_models")
        .select("*")
        .eq("id", modelId)
        .maybeSingle();

      if (error) {
        logger.error("[queries] floorplan model fetch failed", { modelId, error: error.message });
        throw new Error(error.message);
      }
      return (data as FloorplanModelRow | null) ?? null;
    },
    enabled: !!modelId,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });

/**
 * Annotations for a model (used in 3D annotation layer).
 */
export const floorplanAnnotationsQueryOptions = (modelId: string) =>
  queryOptions<FloorplanAnnotationRow[]>({
    queryKey: floorplanKeys.annotationsByModel(modelId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floorplan_annotations")
        .select("*")
        .eq("model_id", modelId)
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("[queries] floorplan annotations fetch failed", {
          modelId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as FloorplanAnnotationRow[];
    },
    enabled: !!modelId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

/**
 * Measurements for a model.
 */
export const floorplanMeasurementsQueryOptions = (modelId: string) =>
  queryOptions<FloorplanMeasurementRow[]>({
    queryKey: floorplanKeys.measurementsByModel(modelId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floorplan_measurements")
        .select("*")
        .eq("model_id", modelId)
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("[queries] floorplan measurements fetch failed", {
          modelId,
          error: error.message,
        });
        throw new Error(error.message);
      }
      return (data ?? []) as FloorplanMeasurementRow[];
    },
    enabled: !!modelId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

/**
 * Convenience: fetch a full model + annotations + measurements in one (for viewer).
 * Still separate cache entries for granular invalidation.
 */
export const floorplanFullQueryOptions = (modelId: string) =>
  queryOptions<{
    model: FloorplanModelRow | null;
    annotations: FloorplanAnnotationRow[];
    measurements: FloorplanMeasurementRow[];
  }>({
    queryKey: [...floorplanKeys.byId(modelId), "full"] as const,
    queryFn: async () => {
      const [modelRes, annRes, measRes] = await Promise.all([
        supabase.from("floorplan_models").select("*").eq("id", modelId).maybeSingle(),
        supabase
          .from("floorplan_annotations")
          .select("*")
          .eq("model_id", modelId)
          .order("created_at"),
        supabase
          .from("floorplan_measurements")
          .select("*")
          .eq("model_id", modelId)
          .order("created_at"),
      ]);

      if (modelRes.error) throw new Error(modelRes.error.message);
      if (annRes.error) throw new Error(annRes.error.message);
      if (measRes.error) throw new Error(measRes.error.message);

      return {
        model: (modelRes.data as FloorplanModelRow | null) ?? null,
        annotations: (annRes.data ?? []) as FloorplanAnnotationRow[],
        measurements: (measRes.data ?? []) as FloorplanMeasurementRow[],
      };
    },
    enabled: !!modelId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
