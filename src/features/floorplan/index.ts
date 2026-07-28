/**
 * Floorplan feature public API (AO-1H1).
 *
 * Components import the presentation mutation hook from here.
 * Table-write primitives are available via infrastructure re-export for tests.
 */
export {
  useFloorplanViewerMutations,
  type UseFloorplanViewerMutationsOptions,
  type UseFloorplanViewerMutationsResult,
  type SaveAnnotationVariables,
  type SaveMeasurementVariables,
  type FloorplanEstimateRoom,
} from "./presentation";

export {
  createFloorplanModelRecord,
  deleteFloorplanModelRecord,
  createFloorplanAnnotation,
  deleteFloorplanAnnotation,
  createFloorplanMeasurement,
  deleteFloorplanMeasurement,
  type FloorplanModelRow,
  type FloorplanAnnotationRow,
  type FloorplanMeasurementRow,
} from "./infrastructure";
