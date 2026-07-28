/**
 * Floorplan slice — infrastructure public surface (AO-1H1).
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
  type FloorplanAnnotationRow,
  type FloorplanMeasurementRow,
  type CreateFloorplanModelRecordInput,
  type CreateFloorplanAnnotationInput,
  type CreateFloorplanMeasurementInput,
} from "./floorplanWrite";
