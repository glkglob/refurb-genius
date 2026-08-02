/**
 * Floorplan domain public surface (P1B3).
 *
 * Stable application models + parsers/serializers. No React, Supabase client,
 * or generated Database imports.
 */

export {
  type FloorplanJson,
  normalizeFloorplanJson,
  isFloorplanJsonCompatible,
} from "./floorplan-json";

export {
  FLOORPLAN_MODEL_STATUSES,
  FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD,
  FLOORPLAN_ANNOTATION_TYPE_ROOM_TAG,
  type FloorplanModelStatus,
  type FloorplanModelApp,
  mapFloorplanModelRow,
  mapFloorplanModelRows,
} from "./floorplan-model";

export {
  type FloorplanVec3,
  type FloorplanAnnotationData,
  type FloorplanAnnotationApp,
  type SerializeFloorplanAnnotationDataInput,
  parseFloorplanPosition,
  parseFloorplanAnnotationData,
  serializeFloorplanAnnotationData,
  mapFloorplanAnnotationRow,
  mapFloorplanAnnotationRows,
} from "./floorplan-annotation";

export {
  FLOORPLAN_MEASUREMENT_TYPE_DISTANCE,
  FLOORPLAN_MEASUREMENT_UNIT_DEFAULT,
  type FloorplanMeasurementApp,
  parseFloorplanMeasurementValue,
  mapFloorplanMeasurementRow,
  mapFloorplanMeasurementRows,
} from "./floorplan-measurement";
