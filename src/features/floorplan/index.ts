/**
 * Floorplan feature public API (AO-1H1 / AO-1H2 / P1B3).
 *
 * Components import presentation hooks and pure mappers from here.
 * Table-write primitives are available via infrastructure re-export for tests.
 * Domain models and parsers are available via ./domain.
 */
export {
  useFloorplanViewerMutations,
  type UseFloorplanViewerMutationsOptions,
  type UseFloorplanViewerMutationsResult,
  type SaveAnnotationVariables,
  type SaveMeasurementVariables,
  type FloorplanEstimateRoom,
  useSyncFloorplanTagsToEstimate,
  type UseSyncFloorplanTagsToEstimateResult,
} from "./presentation";

export {
  mapFloorplanAnnotationsToEstimateRooms,
  extractFloorplanAnnotationLabels,
  type FloorplanEstimatePlaceholderRoom,
  type MapFloorplanAnnotationsToEstimateRoomsResult,
} from "./application";

export {
  createFloorplanModelRecord,
  deleteFloorplanModelRecord,
  createFloorplanAnnotation,
  deleteFloorplanAnnotation,
  createFloorplanMeasurement,
  deleteFloorplanMeasurement,
  type FloorplanModelRow,
  type CreateFloorplanModelRecordInput,
  type CreateFloorplanAnnotationInput,
  type CreateFloorplanMeasurementInput,
} from "./infrastructure";

export {
  type FloorplanModelApp,
  type FloorplanAnnotationApp,
  type FloorplanMeasurementApp,
  type FloorplanModelStatus,
  mapFloorplanModelRow,
  mapFloorplanAnnotationRow,
  mapFloorplanMeasurementRow,
  parseFloorplanAnnotationData,
  serializeFloorplanAnnotationData,
} from "./domain";
