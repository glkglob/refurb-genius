/**
 * AI-upload slice — Presentation surface.
 */
export { runPhotoAnalysisServerFn, roomAnalysisOutputSchema } from "./serverFns";
export {
  photoAnalysisProvider,
  mockPhotoAnalysisProvider,
  serverPhotoAnalysisProvider,
  getPhotoAnalysis,
  loadPhotoAnalysis,
  runPhotoAnalysis,
  subscribePhotoAnalysis,
  type PhotoAnalysisInput,
  type PhotoAnalysisProvider,
} from "./photo-analysis.provider";
export { useRoomAnalyses, useRunPhotoAnalysis, photoAnalysisKeys } from "./hooks/usePhotoAnalysis";
export { usePhotos, useUploadPhotos, useRemovePhoto } from "./hooks/usePhotos";
export {
  PhotoAnalysisViewer,
  PhotoAnalysisCard,
  PhotoAnalysisFilters,
  PhotoUploadZone,
  type PhotoUploadZoneProps,
} from "./components";
