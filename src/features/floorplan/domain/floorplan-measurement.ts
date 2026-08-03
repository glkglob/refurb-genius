/**
 * Floorplan measurement domain contract and row mapper (P1B3).
 *
 * Canonical table public.floorplan_measurements:
 *   id, model_id, measurement_type, value, unit, created_at, updated_at
 *   unit default 'm'
 *
 * Historical columns (not written, not re-created): project_id, created_by,
 * points, label.
 *
 * Geometry points are session-only (evidenced by FloorplanScene MeasurementLines
 * null overlay and mutation NOTE). Not persisted — no canonical JSON column.
 */

export type FloorplanMeasurementApp = {
  id: string;
  modelId: string;
  measurementType: string;
  value: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
};

/** Evidenced measurement type from saveMeasurement (distance between two points). */
export const FLOORPLAN_MEASUREMENT_TYPE_DISTANCE = "distance";

/** Evidenced default unit from write path and UI. */
export const FLOORPLAN_MEASUREMENT_UNIT_DEFAULT = "m";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Parse a finite measurement value. Non-finite / non-numeric → 0 (display fallback).
 * Does not coerce arbitrary strings (e.g. "3m" stays invalid → 0).
 */
export function parseFloorplanMeasurementValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

/**
 * Map dual-baseline measurement row → application model.
 */
export function mapFloorplanMeasurementRow(row: unknown): FloorplanMeasurementApp {
  const r = isRecord(row) ? row : {};

  return {
    id: asString(r.id),
    modelId: asString(r.model_id),
    measurementType: asString(r.measurement_type, FLOORPLAN_MEASUREMENT_TYPE_DISTANCE),
    value: parseFloorplanMeasurementValue(r.value),
    unit:
      asString(r.unit, FLOORPLAN_MEASUREMENT_UNIT_DEFAULT) || FLOORPLAN_MEASUREMENT_UNIT_DEFAULT,
    createdAt: asString(r.created_at),
    updatedAt: asString(r.updated_at),
  };
}

export function mapFloorplanMeasurementRows(rows: unknown): FloorplanMeasurementApp[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapFloorplanMeasurementRow);
}
