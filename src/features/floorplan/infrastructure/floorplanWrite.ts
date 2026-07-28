/**
 * Canonical floorplan table-write primitives (AO-1H1).
 *
 * Owns direct inserts/deletes for floorplan_models, floorplan_annotations,
 * and floorplan_measurements. Does NOT coordinate Auth, Storage, React Query,
 * toasts, or logging — presentation/hooks supply identity and orchestration.
 */
import { supabase } from "@/platform/supabase/browser";
import type { Tables, TablesInsert } from "@repo/supabase";
import type { Json } from "@repo/supabase/database.types";

export type FloorplanModelRow = Tables<"floorplan_models">;
export type FloorplanAnnotationRow = Tables<"floorplan_annotations">;
export type FloorplanMeasurementRow = Tables<"floorplan_measurements">;

export type CreateFloorplanModelRecordInput = {
  projectId: string;
  userId: string;
  name: string;
  storagePath: string;
  fileType: string;
  metadata: Json;
};

export type CreateFloorplanAnnotationInput = {
  modelId: string;
  projectId: string;
  userId: string;
  label: string;
  position: Json;
  roomId: string | null;
  notes: string | null;
};

export type CreateFloorplanMeasurementInput = {
  modelId: string;
  projectId: string;
  userId: string;
  /** Stored as measurement_type (exact column name). */
  measurementType: string;
  value: number;
  unit: string;
  points: Json;
};

/**
 * Insert a floorplan_models row after Storage upload.
 * Returns the inserted row (select * .single) for selection.
 * Throws Supabase errors unchanged.
 */
export async function createFloorplanModelRecord(
  input: CreateFloorplanModelRecordInput,
): Promise<FloorplanModelRow> {
  const row: TablesInsert<"floorplan_models"> = {
    project_id: input.projectId,
    uploaded_by: input.userId,
    name: input.name,
    storage_path: input.storagePath,
    file_type: input.fileType,
    metadata: input.metadata,
  };

  const { data: inserted, error } = await supabase
    .from("floorplan_models")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return inserted as FloorplanModelRow;
}

/**
 * Delete a floorplan_models row by id.
 * Throws Supabase errors unchanged.
 */
export async function deleteFloorplanModelRecord(modelId: string): Promise<void> {
  const { error } = await supabase.from("floorplan_models").delete().eq("id", modelId);
  if (error) throw error;
}

/**
 * Insert a floorplan_annotations row.
 * Throws Supabase errors unchanged. Void return (matches prior insert-without-select).
 */
export async function createFloorplanAnnotation(
  input: CreateFloorplanAnnotationInput,
): Promise<void> {
  const row: TablesInsert<"floorplan_annotations"> = {
    model_id: input.modelId,
    project_id: input.projectId,
    created_by: input.userId,
    label: input.label,
    position: input.position,
    room_id: input.roomId,
    notes: input.notes,
  };

  const { error } = await supabase.from("floorplan_annotations").insert(row);
  if (error) throw error;
}

/**
 * Delete a floorplan_annotations row by id.
 * Throws Supabase errors unchanged.
 */
export async function deleteFloorplanAnnotation(annotationId: string): Promise<void> {
  const { error } = await supabase.from("floorplan_annotations").delete().eq("id", annotationId);
  if (error) throw error;
}

/**
 * Insert a floorplan_measurements row.
 * Throws Supabase errors unchanged. Void return (matches prior insert-without-select).
 */
export async function createFloorplanMeasurement(
  input: CreateFloorplanMeasurementInput,
): Promise<void> {
  const row: TablesInsert<"floorplan_measurements"> = {
    model_id: input.modelId,
    project_id: input.projectId,
    created_by: input.userId,
    measurement_type: input.measurementType,
    value: input.value,
    unit: input.unit,
    points: input.points,
  };

  const { error } = await supabase.from("floorplan_measurements").insert(row);
  if (error) throw error;
}

/**
 * Delete a floorplan_measurements row by id.
 * Throws Supabase errors unchanged.
 */
export async function deleteFloorplanMeasurement(measurementId: string): Promise<void> {
  const { error } = await supabase.from("floorplan_measurements").delete().eq("id", measurementId);
  if (error) throw error;
}
