/**
 * Canonical floorplan table-write primitives (AO-1H1 / P1B3).
 *
 * Owns direct inserts/deletes for floorplan_models, floorplan_annotations,
 * and floorplan_measurements. Does NOT coordinate Auth, Storage, React Query,
 * toasts, or logging — presentation/hooks supply identity and orchestration.
 *
 * Persistence contract (migration 20260605123000):
 * - models: project_id, user_id, name, model_url, metadata, status
 * - annotations: model_id, annotation_type, data
 * - measurements: model_id, measurement_type, value, unit
 *
 * Dual-baseline typing (P1B3):
 * Tracked generated Insert shapes still require obsolete columns (storage_path,
 * uploaded_by, file_type, project_id on children, points, …). Canonical Insert
 * shapes reject those columns. A single runtime payload cannot be TablesInsert
 * under both baselines without a double assertion.
 *
 * Solution: erase the Database generic by assigning the typed browser client to
 * SupabaseClient (default). Domain Canonical*Insert types re-introduce
 * field-level safety without type assertions or obsolete columns.
 */
import type { SupabaseClient } from "@repo/supabase";
import { supabase } from "@/platform/supabase/browser";
import {
  FLOORPLAN_ANNOTATION_TYPE_ROOM_TAG,
  FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD,
  FLOORPLAN_MEASUREMENT_TYPE_DISTANCE,
  FLOORPLAN_MEASUREMENT_UNIT_DEFAULT,
  mapFloorplanModelRow,
  serializeFloorplanAnnotationData,
  type FloorplanJson,
  type FloorplanModelApp,
  type FloorplanVec3,
} from "../domain";

/** Alias for domain model — retained for existing import paths. */
export type FloorplanModelRow = FloorplanModelApp;

export type CreateFloorplanModelRecordInput = {
  projectId: string;
  userId: string;
  name: string;
  /** Private Storage object path — persisted as model_url. */
  modelUrl: string;
  /** Optional file extension hint stored in metadata.fileType only. */
  fileType?: string;
  metadata?: { [key: string]: FloorplanJson | undefined };
  /** Defaults to ready after successful upload. */
  status?: typeof FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD | "draft" | "processing" | "error";
};

export type CreateFloorplanAnnotationInput = {
  modelId: string;
  label: string;
  position: FloorplanVec3 | { x: number; y: number; z: number };
  roomId?: string | null;
  notes?: string | null;
  annotationType?: string;
};

export type CreateFloorplanMeasurementInput = {
  modelId: string;
  measurementType?: string;
  value: number;
  unit?: string;
};

/** Canonical insert payload for public.floorplan_models. */
type CanonicalFloorplanModelInsert = {
  project_id: string;
  user_id: string;
  name: string;
  model_url: string;
  metadata: FloorplanJson;
  status: string;
};

/** Canonical insert payload for public.floorplan_annotations. */
type CanonicalFloorplanAnnotationInsert = {
  model_id: string;
  annotation_type: string;
  data: FloorplanJson;
};

/** Canonical insert payload for public.floorplan_measurements. */
type CanonicalFloorplanMeasurementInsert = {
  model_id: string;
  measurement_type: string;
  value: number;
  unit: string;
};

/**
 * Dual-baseline write client: assign typed Database client to default
 * SupabaseClient so canonical payloads typecheck under both baselines.
 */
function floorplanWriteClient(): SupabaseClient {
  return supabase;
}

function buildModelMetadata(input: CreateFloorplanModelRecordInput): FloorplanJson {
  const base: { [key: string]: FloorplanJson | undefined } = {
    ...(input.metadata ?? {}),
  };
  if (input.fileType) {
    base.fileType = input.fileType;
  }
  // Omit undefined keys
  const out: { [key: string]: FloorplanJson | undefined } = {};
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Insert a floorplan_models row after Storage upload.
 * Returns the mapped application model for selection.
 * Throws Supabase errors unchanged.
 */
export async function createFloorplanModelRecord(
  input: CreateFloorplanModelRecordInput,
): Promise<FloorplanModelApp> {
  const row: CanonicalFloorplanModelInsert = {
    project_id: input.projectId,
    user_id: input.userId,
    name: input.name,
    model_url: input.modelUrl,
    metadata: buildModelMetadata(input),
    status: input.status ?? FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD,
  };

  const { data: inserted, error } = await floorplanWriteClient()
    .from("floorplan_models")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return mapFloorplanModelRow(inserted);
}

/**
 * Delete a floorplan_models row by id.
 * Throws Supabase errors unchanged.
 */
export async function deleteFloorplanModelRecord(modelId: string): Promise<void> {
  const { error } = await floorplanWriteClient()
    .from("floorplan_models")
    .delete()
    .eq("id", modelId);
  if (error) throw error;
}

/**
 * Insert a floorplan_annotations row (canonical annotation_type + data).
 * Throws Supabase errors unchanged. Void return (matches prior insert-without-select).
 */
export async function createFloorplanAnnotation(
  input: CreateFloorplanAnnotationInput,
): Promise<void> {
  const row: CanonicalFloorplanAnnotationInsert = {
    model_id: input.modelId,
    annotation_type: input.annotationType ?? FLOORPLAN_ANNOTATION_TYPE_ROOM_TAG,
    data: serializeFloorplanAnnotationData({
      label: input.label,
      position: input.position,
      notes: input.notes,
      roomId: input.roomId,
    }),
  };

  const { error } = await floorplanWriteClient().from("floorplan_annotations").insert(row);
  if (error) throw error;
}

/**
 * Delete a floorplan_annotations row by id.
 * Throws Supabase errors unchanged.
 */
export async function deleteFloorplanAnnotation(annotationId: string): Promise<void> {
  const { error } = await floorplanWriteClient()
    .from("floorplan_annotations")
    .delete()
    .eq("id", annotationId);
  if (error) throw error;
}

/**
 * Insert a floorplan_measurements row (scalar value + unit only).
 * Points are intentionally not persisted (no canonical geometry column).
 * Throws Supabase errors unchanged. Void return.
 */
export async function createFloorplanMeasurement(
  input: CreateFloorplanMeasurementInput,
): Promise<void> {
  if (!Number.isFinite(input.value)) {
    throw new Error("Measurement value must be a finite number");
  }

  const row: CanonicalFloorplanMeasurementInsert = {
    model_id: input.modelId,
    measurement_type: input.measurementType ?? FLOORPLAN_MEASUREMENT_TYPE_DISTANCE,
    value: input.value,
    unit: input.unit ?? FLOORPLAN_MEASUREMENT_UNIT_DEFAULT,
  };

  const { error } = await floorplanWriteClient().from("floorplan_measurements").insert(row);
  if (error) throw error;
}

/**
 * Delete a floorplan_measurements row by id.
 * Throws Supabase errors unchanged.
 */
export async function deleteFloorplanMeasurement(measurementId: string): Promise<void> {
  const { error } = await floorplanWriteClient()
    .from("floorplan_measurements")
    .delete()
    .eq("id", measurementId);
  if (error) throw error;
}
