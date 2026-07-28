/**
 * Pure Floorplan annotation labels → estimate placeholder rooms (AO-1H2).
 *
 * Side effects: none except optional injectable `now` (default Date.now)
 * called once per newly created room for ID construction.
 * No React, QueryClient, toast, Auth, or Supabase.
 */

/** Placeholder room written into the product estimate client cache. */
export interface FloorplanEstimatePlaceholderRoom {
  id: string;
  name: string;
  items: [];
}

export interface MapFloorplanAnnotationsToEstimateRoomsResult {
  /** Unique non-empty string labels in first-seen order. */
  uniqueLabels: string[];
  /** Rooms not already present by exact name match. */
  newRooms: FloorplanEstimatePlaceholderRoom[];
}

/**
 * Unique non-empty string labels in first-seen order (no Date.now).
 * Used for silent early-return before cache access.
 */
export function extractFloorplanAnnotationLabels(
  annotations: ReadonlyArray<{ label?: unknown }>,
): string[] {
  return Array.from(
    new Set(
      annotations
        .map((annotation) => annotation.label)
        .filter((label): label is string => typeof label === "string" && !!label),
    ),
  );
}

/**
 * Map floorplan annotation labels into new estimate-room placeholders.
 * Does not merge into cache; append ownership is the presentation hook's.
 */
export function mapFloorplanAnnotationsToEstimateRooms(
  annotations: ReadonlyArray<{ label?: unknown }>,
  existingRooms: ReadonlyArray<{ name?: string }>,
  now: () => number = Date.now,
): MapFloorplanAnnotationsToEstimateRoomsResult {
  const uniqueLabels = extractFloorplanAnnotationLabels(annotations);

  const existingNames = new Set(existingRooms.map((room) => room.name));

  const newRooms = uniqueLabels
    .filter((label) => !existingNames.has(label))
    .map((label) => ({
      id: `fp-${now()}-${label}`,
      name: label,
      items: [] as [],
    }));

  return {
    uniqueLabels,
    newRooms,
  };
}
