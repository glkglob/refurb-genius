/**
 * JSON-compatible values for floorplan domain serialization (P1B3).
 * Mirrors PostgREST/Supabase Json without importing generated database types.
 */
export type FloorplanJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: FloorplanJson | undefined }
  | FloorplanJson[];

/**
 * Total map: FloorplanJson → FloorplanJson with undefined properties omitted
 * and non-finite numbers replaced by null.
 */
export function normalizeFloorplanJson(value: FloorplanJson): FloorplanJson {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFloorplanJson(item));
  }
  const out: { [key: string]: FloorplanJson | undefined } = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    out[key] = normalizeFloorplanJson(child);
  }
  return out;
}

/**
 * True when a value is JSON-serializable under the floorplan rules
 * (no undefined properties, no non-finite numbers, plain data only).
 */
export function isFloorplanJsonCompatible(value: unknown): value is FloorplanJson {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isFloorplanJsonCompatible);
  if (typeof value === "object") {
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      return false;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) return false;
      if (typeof key !== "string") return false;
      if (!isFloorplanJsonCompatible(child)) return false;
    }
    return true;
  }
  return false;
}
