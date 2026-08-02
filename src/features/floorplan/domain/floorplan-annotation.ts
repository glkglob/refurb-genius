/**
 * Floorplan annotation domain contract, data parser/serializer, row mapper (P1B3).
 *
 * Canonical table public.floorplan_annotations:
 *   id, model_id, annotation_type, data (jsonb), created_at, updated_at
 *
 * Historical flat columns (not written): project_id, created_by, label, position,
 * notes, room_id, normal.
 *
 * Application content is stored inside `data` with evidenced keys:
 *   label      — DIRECTLY EVIDENCED (UI list, estimate sync, write path)
 *   position   — DIRECTLY EVIDENCED (3D markers, write path as [x,y,z])
 *   notes      — DIRECTLY EVIDENCED (linked room name display)
 *   room_id    — DIRECTLY EVIDENCED (linked estimate room)
 */

import { normalizeFloorplanJson, type FloorplanJson } from "./floorplan-json";
import { FLOORPLAN_ANNOTATION_TYPE_ROOM_TAG } from "./floorplan-model";

export type FloorplanVec3 = [number, number, number];

/**
 * Validated annotation payload stored in `data` jsonb.
 * Optional fields are omitted from serialized JSON rather than set to undefined.
 */
export type FloorplanAnnotationData = {
  label: string;
  position: FloorplanVec3;
  notes?: string;
  roomId?: string;
};

export type FloorplanAnnotationApp = {
  id: string;
  modelId: string;
  annotationType: string;
  label: string;
  position: FloorplanVec3;
  notes: string | null;
  roomId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializeFloorplanAnnotationDataInput = {
  label: string;
  position: FloorplanVec3 | { x: number; y: number; z: number };
  notes?: string | null;
  roomId?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * Parse a position from JSON array or {x,y,z}. Invalid coordinates → null.
 */
export function parseFloorplanPosition(value: unknown): FloorplanVec3 | null {
  if (Array.isArray(value) && value.length >= 3) {
    const x = finiteNumber(value[0]);
    const y = finiteNumber(value[1]);
    const z = finiteNumber(value[2]);
    if (x === null || y === null || z === null) return null;
    return [x, y, z];
  }
  if (isRecord(value)) {
    const x = finiteNumber(value.x);
    const y = finiteNumber(value.y);
    const z = finiteNumber(value.z);
    if (x === null || y === null || z === null) return null;
    return [x, y, z];
  }
  return null;
}

const EMPTY_POSITION: FloorplanVec3 = [0, 0, 0];

/**
 * Parse annotation `data` jsonb (or legacy flat fields via mapper).
 *
 * Policy:
 * - null / non-object → empty defaults
 * - invalid coordinates rejected (fallback [0,0,0] for display)
 * - unknown keys ignored
 * - no coercion of arbitrary values to strings/numbers beyond finite checks
 */
export function parseFloorplanAnnotationData(value: unknown): FloorplanAnnotationData {
  if (!isRecord(value)) {
    return { label: "", position: EMPTY_POSITION };
  }

  const label = typeof value.label === "string" ? value.label : "";
  const position = parseFloorplanPosition(value.position) ?? EMPTY_POSITION;

  const result: FloorplanAnnotationData = { label, position };

  if (typeof value.notes === "string" && value.notes.length > 0) {
    result.notes = value.notes;
  }

  // room_id in JSON (snake) — DIRECTLY EVIDENCED write key
  if (typeof value.room_id === "string" && value.room_id.length > 0) {
    result.roomId = value.room_id;
  } else if (typeof value.roomId === "string" && value.roomId.length > 0) {
    // SUPPORTED LEGACY ALIAS (camelCase)
    result.roomId = value.roomId;
  }

  return result;
}

/**
 * Serialize annotation content to JSON-compatible `data` object.
 * Omits undefined / null optional fields. No JSON.parse/stringify.
 */
export function serializeFloorplanAnnotationData(
  input: SerializeFloorplanAnnotationDataInput,
): FloorplanJson {
  const position: FloorplanVec3 = Array.isArray(input.position)
    ? input.position
    : [input.position.x, input.position.y, input.position.z];

  const raw: { [key: string]: FloorplanJson | undefined } = {
    label: input.label,
    position,
  };

  if (input.notes != null && input.notes !== "") {
    raw.notes = input.notes;
  }
  if (input.roomId != null && input.roomId !== "") {
    raw.room_id = input.roomId;
  }

  return normalizeFloorplanJson(raw);
}

/**
 * Map dual-baseline annotation row → application model.
 * Prefers canonical `data` jsonb; falls back to historical flat columns.
 */
export function mapFloorplanAnnotationRow(row: unknown): FloorplanAnnotationApp {
  const r = isRecord(row) ? row : {};
  const fromData = parseFloorplanAnnotationData(r.data);
  const hasDataObject = isRecord(r.data);

  const labelFromFlat = typeof r.label === "string" ? r.label : "";
  const positionFromFlat = parseFloorplanPosition(r.position);
  const notesFromFlat = typeof r.notes === "string" ? r.notes : null;
  const roomIdFromFlat = typeof r.room_id === "string" ? r.room_id : null;

  const label = (hasDataObject ? fromData.label : "") || labelFromFlat || fromData.label || "Tag";

  const position =
    (hasDataObject ? parseFloorplanPosition((r.data as Record<string, unknown>).position) : null) ??
    positionFromFlat ??
    fromData.position;

  const notes =
    (hasDataObject && fromData.notes !== undefined ? fromData.notes : null) ??
    notesFromFlat ??
    null;

  const roomId =
    (hasDataObject && fromData.roomId !== undefined ? fromData.roomId : null) ??
    roomIdFromFlat ??
    null;

  return {
    id: asString(r.id),
    modelId: asString(r.model_id),
    annotationType: asString(r.annotation_type, FLOORPLAN_ANNOTATION_TYPE_ROOM_TAG),
    label,
    position,
    notes: notes === "" ? null : notes,
    roomId: roomId === "" ? null : roomId,
    createdAt: asString(r.created_at),
    updatedAt: asString(r.updated_at),
  };
}

export function mapFloorplanAnnotationRows(rows: unknown): FloorplanAnnotationApp[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapFloorplanAnnotationRow);
}
