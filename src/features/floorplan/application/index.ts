/**
 * Floorplan slice — application surface (AO-1H2).
 *
 * Pure mappers only. No React, QueryClient, or persistence.
 */
export {
  extractFloorplanAnnotationLabels,
  mapFloorplanAnnotationsToEstimateRooms,
  type FloorplanEstimatePlaceholderRoom,
  type MapFloorplanAnnotationsToEstimateRoomsResult,
} from "./mapFloorplanAnnotationsToEstimateRooms";
