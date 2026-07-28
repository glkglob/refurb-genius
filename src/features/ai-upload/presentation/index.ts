/**
 * AI-upload slice — Presentation surface.
 */
export {
  runPhotoAnalysisServerFn,
  runPhotoAnalysisWithProviderServerFn,
  roomAnalysisOutputSchema,
} from "./serverFns";
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
export { useInvalidateProjectPhotos } from "./hooks/useInvalidateProjectPhotos";
export {
  useUpdatePhotoAnalysisResult,
  type UpdatePhotoAnalysisResultMutationInput,
  type UpdatePhotoAnalysisResultMutationResult,
} from "./hooks/useUpdatePhotoAnalysisResult";
export {
  PhotoAnalysisViewer,
  PhotoAnalysisCard,
  PhotoAnalysisFilters,
  PhotoUploadZone,
  type PhotoUploadZoneProps,
} from "./components";
