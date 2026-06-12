import { supabase } from "@/platform/supabase/browser";
import { logger } from "@/lib/logger";
import type { Tables } from "@repo/supabase";
import * as THREE from "three";

export type FloorplanModelRow = Tables<"floorplan_models">;
export type FloorplanAnnotationRow = Tables<"floorplan_annotations">;
export type FloorplanMeasurementRow = Tables<"floorplan_measurements">;

const FLOORPLAN_BUCKET = "floorplans";

/**
 * Get a short-lived signed URL for a private floorplan model asset.
 * Use this before passing to GLTF loaders.
 */
export async function getSignedModelUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (!storagePath) throw new Error("Missing storage path for model");
  const { data, error } = await supabase.storage
    .from(FLOORPLAN_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    logger.error("[floorplan] failed to create signed url", { storagePath, error: error?.message });
    throw new Error("Failed to load model (signed URL)");
  }
  return data.signedUrl;
}

/**
 * Upload a GLB/GLTF file for a floorplan model.
 * Returns the storage path to store in model_url.
 */
export async function uploadFloorplanModel(
  projectId: string,
  file: File,
  userId: string,
): Promise<{ path: string; publicUrl?: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "glb";
  const safeName = file.name.replace(/[^a-z0-9.-]/gi, "_");
  const id = crypto.randomUUID();
  const path = `${userId}/${projectId}/${id}-${safeName}`;

  const { error: uploadErr } = await supabase.storage.from(FLOORPLAN_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || (ext === "glb" ? "model/gltf-binary" : "model/gltf+json"),
  });

  if (uploadErr) {
    logger.error("[floorplan] model upload failed", { path, error: uploadErr.message });
    throw uploadErr;
  }

  // We deliberately store the *path*, not a public URL (bucket is private).
  // Consumers call getSignedModelUrl(path) when they need a fetchable URL.
  return { path };
}

/**
 * Delete a model file from storage (call before or after deleting DB row).
 */
export async function deleteFloorplanStorage(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(FLOORPLAN_BUCKET).remove([path]);
  if (error) {
    logger.warn("[floorplan] storage delete warning (non-fatal)", { path, error: error.message });
  }
}

/**
 * Basic distance between two Vector3 points (in model units, assume meters).
 */
export function computeDistance(p1: THREE.Vector3, p2: THREE.Vector3): number {
  return p1.distanceTo(p2);
}

/**
 * Simple area for a polygon of points (shoelace on XY, assumes flat-ish floor plan).
 * Returns area in square units.
 */
export function computePolygonArea(points: THREE.Vector3[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Export a screenshot from a WebGL canvas (the fiber gl.domElement).
 */
export function exportScreenshot(
  canvas: HTMLCanvasElement,
  filename = "floorplan-screenshot.png",
): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/**
 * Export annotations + measurements as JSON (for the current model).
 */
export function exportAnnotationsJson(
  model: FloorplanModelRow | null,
  annotations: FloorplanAnnotationRow[],
  measurements: FloorplanMeasurementRow[],
  filename = "floorplan-annotations.json",
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    model: model ? { id: model.id, name: model.name, storage_path: model.storage_path } : null,
    annotations,
    measurements,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert a world point to a serializable array for JSONB storage.
 */
export function pointToArray(p: THREE.Vector3): [number, number, number] {
  return [p.x, p.y, p.z];
}

/**
 * Re-hydrate a point from stored data (defensive).
 */
export function arrayToPoint(arr: unknown): THREE.Vector3 {
  if (Array.isArray(arr) && arr.length >= 3) {
    return new THREE.Vector3(Number(arr[0]), Number(arr[1]), Number(arr[2]));
  }
  return new THREE.Vector3();
}
