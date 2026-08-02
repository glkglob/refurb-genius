/**
 * Floorplan slice — infrastructure public surface (AO-1H1 / P1B3).
 *
 * Table-write primitives only. Storage helpers remain in @/lib/floorplan.
 */
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
} from "./floorplanWrite";
