/**
 * Presentation-safe FloorplanViewer Auth + persistence mutations (AO-1H1 / P1B3).
 *
 * Owns:
 * - auth.getUser() for create model / annotation / measurement
 * - useMutation for six persistence mutations
 * - Storage upload/delete orchestration (via @/lib/floorplan helpers)
 * - floorplanKeys invalidations (models, annotations, measurements)
 * - Refresh invalidation + toast
 * - mutation success/error toasts
 * - isUploading local pending flag for model create
 * - create-model logger.error
 *
 * Does NOT own:
 * - estimate tag cache sync (remains in FloorplanViewer; deferred follow-up)
 * - read queries
 * - editor/UI state (selection, mode, dialogs)
 * - file validation, delete confirmation, exports
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { floorplanKeys } from "@/lib/queries/floorplans";
import { uploadFloorplanModel, deleteFloorplanStorage } from "@/lib/floorplan";
import {
  createFloorplanModelRecord,
  deleteFloorplanModelRecord,
  createFloorplanAnnotation,
  deleteFloorplanAnnotation,
  createFloorplanMeasurement,
  deleteFloorplanMeasurement,
} from "../../infrastructure/floorplanWrite";
import type { FloorplanModelApp } from "../../domain";

export type FloorplanEstimateRoom = {
  id: string;
  name: string;
};

export type SaveAnnotationVariables = {
  position: { x: number; y: number; z: number };
  label: string;
  linkedRoomId?: string;
};

export type SaveMeasurementVariables = {
  p1: { x: number; y: number; z: number };
  p2: { x: number; y: number; z: number };
};

export type UseFloorplanViewerMutationsOptions = {
  /** Currently selected model (annotation/measurement mutations). */
  selectedModelId: string | null;
  /** Estimate rooms for annotation notes (optional link). */
  estimateRooms: FloorplanEstimateRoom[];
  /** Called after model create with the inserted domain model (selection). */
  onModelCreated?: (model: FloorplanModelApp) => void;
  /** Called after model delete (selection recalculation). */
  onModelDeleted?: (model: FloorplanModelApp) => void;
  /** Called after annotation save (clear dialog, reset mode). */
  onAnnotationSaved?: () => void;
  /** Called after measurement save (reset mode). */
  onMeasurementSaved?: () => void;
};

export type UseFloorplanViewerMutationsResult = {
  createModel: (file: File) => void;
  deleteModel: (model: FloorplanModelApp) => void;
  saveAnnotation: (variables: SaveAnnotationVariables) => void;
  saveMeasurement: (variables: SaveMeasurementVariables) => void;
  deleteAnnotation: (id: string) => void;
  deleteMeasurement: (id: string) => void;
  refreshModels: () => void;
  isUploading: boolean;
  isCreateModelPending: boolean;
};

export function useFloorplanViewerMutations(
  projectId: string,
  options: UseFloorplanViewerMutationsOptions,
): UseFloorplanViewerMutationsResult {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const {
    selectedModelId,
    estimateRooms,
    onModelCreated,
    onModelDeleted,
    onAnnotationSaved,
    onMeasurementSaved,
  } = options;

  const createModelMutation = useMutation({
    mutationFn: async (file: File) => {
      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in to upload models.");

      setIsUploading(true);
      const { path } = await uploadFloorplanModel(projectId, file, user.id);

      try {
        return await createFloorplanModelRecord({
          projectId,
          userId: user.id,
          name: file.name.replace(/\.[^/.]+$/, ""),
          modelUrl: path,
          fileType: file.name.split(".").pop()?.toLowerCase() ?? "glb",
          metadata: { originalName: file.name, size: file.size },
        });
      } catch (error) {
        // Attempt Storage cleanup; swallow cleanup failure (exact prior behaviour).
        await deleteFloorplanStorage(path).catch(() => {});
        throw error;
      }
    },
    onSuccess: (newModel) => {
      queryClient.invalidateQueries({ queryKey: floorplanKeys.byProject(projectId) });
      onModelCreated?.(newModel);
      toast.success("Model uploaded", { description: newModel.name });
    },
    onError: (err: Error) => {
      logger.error("[floorplan] model create failed", { projectId, error: err.message });
      toast.error("Upload failed", { description: err.message });
    },
    onSettled: () => setIsUploading(false),
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (model: FloorplanModelApp) => {
      if (model.modelUrl) {
        await deleteFloorplanStorage(model.modelUrl);
      }
      await deleteFloorplanModelRecord(model.id);
    },
    onSuccess: (_data, model) => {
      queryClient.invalidateQueries({ queryKey: floorplanKeys.byProject(projectId) });
      onModelDeleted?.(model);
      toast.success("Model deleted");
    },
    onError: (err: Error) => {
      toast.error("Delete failed", { description: err.message });
    },
  });

  const saveAnnotationMutation = useMutation({
    mutationFn: async (payload: SaveAnnotationVariables) => {
      if (!selectedModelId) throw new Error("No model selected");

      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in");

      await createFloorplanAnnotation({
        modelId: selectedModelId,
        label: payload.label,
        position: payload.position,
        roomId: payload.linkedRoomId ?? null,
        notes: payload.linkedRoomId
          ? (estimateRooms.find((r) => r.id === payload.linkedRoomId)?.name ?? null)
          : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: floorplanKeys.annotationsByModel(selectedModelId!),
      });
      toast.success("Room tagged");
      onAnnotationSaved?.();
    },
    onError: (err: Error) => {
      toast.error("Failed to save tag", { description: err.message });
    },
  });

  const saveMeasurementMutation = useMutation({
    mutationFn: async (payload: SaveMeasurementVariables) => {
      if (!selectedModelId) throw new Error("No model selected");

      const THREE = await import("three");
      const v1 = new THREE.Vector3(payload.p1.x, payload.p1.y, payload.p1.z);
      const v2 = new THREE.Vector3(payload.p2.x, payload.p2.y, payload.p2.z);
      const dist = v1.distanceTo(v2);

      // Measurements table stores scalar value + unit. Points are session-only
      // (no canonical geometry column). Persisted measurements appear in the list.
      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in");

      await createFloorplanMeasurement({
        modelId: selectedModelId,
        measurementType: "distance",
        value: Math.round(dist * 1000) / 1000,
        unit: "m",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: floorplanKeys.measurementsByModel(selectedModelId!),
      });
      toast.success("Measurement saved");
      onMeasurementSaved?.();
    },
    onError: (err: Error) => {
      toast.error("Failed to save measurement", { description: err.message });
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteFloorplanAnnotation(id);
    },
    onSuccess: () => {
      if (selectedModelId) {
        queryClient.invalidateQueries({
          queryKey: floorplanKeys.annotationsByModel(selectedModelId),
        });
      }
      toast.success("Annotation removed");
    },
    onError: (err: Error) => toast.error("Delete failed", { description: err.message }),
  });

  const deleteMeasurementMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteFloorplanMeasurement(id);
    },
    onSuccess: () => {
      if (selectedModelId) {
        queryClient.invalidateQueries({
          queryKey: floorplanKeys.measurementsByModel(selectedModelId),
        });
      }
      toast.success("Measurement removed");
    },
    onError: (err: Error) => toast.error("Delete failed", { description: err.message }),
  });

  const refreshModels = () => {
    queryClient.invalidateQueries({ queryKey: floorplanKeys.byProject(projectId) });
    toast.info("Refreshed");
  };

  return {
    createModel: (file: File) => {
      createModelMutation.mutate(file);
    },
    deleteModel: (model: FloorplanModelApp) => {
      deleteModelMutation.mutate(model);
    },
    saveAnnotation: (variables: SaveAnnotationVariables) => {
      saveAnnotationMutation.mutate(variables);
    },
    saveMeasurement: (variables: SaveMeasurementVariables) => {
      saveMeasurementMutation.mutate(variables);
    },
    deleteAnnotation: (id: string) => {
      deleteAnnotationMutation.mutate(id);
    },
    deleteMeasurement: (id: string) => {
      deleteMeasurementMutation.mutate(id);
    },
    refreshModels,
    isUploading,
    isCreateModelPending: createModelMutation.isPending,
  };
}
