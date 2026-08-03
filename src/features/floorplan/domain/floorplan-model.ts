/**
 * Floorplan model domain contract and dual-baseline row mapper (P1B3).
 *
 * Canonical table public.floorplan_models (migration 20260605123000):
 *   id, project_id, user_id, name, model_url, metadata, status, created_at, updated_at
 *   status CHECK (draft | processing | ready | error), default 'draft'
 *
 * Historical tracked columns (not written): storage_path, uploaded_by, file_type, is_active.
 * model_url stores the private Storage object path (not a public URL).
 */

export const FLOORPLAN_MODEL_STATUSES = ["draft", "processing", "ready", "error"] as const;
export type FloorplanModelStatus = (typeof FLOORPLAN_MODEL_STATUSES)[number];

/** Default status after a successful model file upload. */
export const FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD: FloorplanModelStatus = "ready";

/** Default annotation type for room tags (UI: "Room tagged" / Tag Room mode). */
export const FLOORPLAN_ANNOTATION_TYPE_ROOM_TAG = "room_tag";

export type FloorplanModelApp = {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  /**
   * Private Storage object path used with getSignedModelUrl.
   * Persisted in canonical column `model_url`.
   */
  modelUrl: string | null;
  status: FloorplanModelStatus;
  metadata: Record<string, FloorplanJsonValue>;
  createdAt: string;
  updatedAt: string;
};

type FloorplanJsonValue =
  | string
  | number
  | boolean
  | null
  | FloorplanJsonValue[]
  | {
      [key: string]: FloorplanJsonValue | undefined;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseStatus(value: unknown): FloorplanModelStatus {
  if (
    typeof value === "string" &&
    (FLOORPLAN_MODEL_STATUSES as readonly string[]).includes(value)
  ) {
    return value as FloorplanModelStatus;
  }
  // Unknown or missing → draft (migration default). Do not invent "active".
  return "draft";
}

function parseMetadata(value: unknown): Record<string, FloorplanJsonValue> {
  if (!isRecord(value)) return {};
  const out: Record<string, FloorplanJsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    // Keep only JSON-safe leaves; drop functions/symbols by omission of non-JSON.
    if (
      child === null ||
      typeof child === "string" ||
      typeof child === "boolean" ||
      (typeof child === "number" && Number.isFinite(child)) ||
      Array.isArray(child) ||
      isRecord(child)
    ) {
      out[key] = child as FloorplanJsonValue;
    }
  }
  return out;
}

/**
 * Map a dual-baseline floorplan_models row (tracked historical or canonical)
 * into the stable application model.
 *
 * - modelUrl: model_url ?? storage_path (legacy alias)
 * - userId: user_id ?? uploaded_by (legacy alias)
 * - status: validated enum; unknown → draft
 * - is_active / file_type are not domain fields (file type may live in metadata)
 */
export function mapFloorplanModelRow(row: unknown): FloorplanModelApp {
  const r = isRecord(row) ? row : {};

  const modelUrl = asNullableString(r.model_url) ?? asNullableString(r.storage_path);

  const userId = asString(r.user_id) || asString(r.uploaded_by);

  return {
    id: asString(r.id),
    projectId: asString(r.project_id),
    userId,
    name: asString(r.name, "Floorplan"),
    modelUrl,
    status: parseStatus(r.status),
    metadata: parseMetadata(r.metadata),
    createdAt: asString(r.created_at),
    updatedAt: asString(r.updated_at),
  };
}

export function mapFloorplanModelRows(rows: unknown): FloorplanModelApp[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapFloorplanModelRow);
}
