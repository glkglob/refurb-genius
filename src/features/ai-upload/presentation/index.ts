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
export {
  formatPhotoUploadError,
  formatPhotoUploadBatchError,
  stageLabel,
} from "./formatPhotoUploadError";
export {
  checkUploadHealth,
  type UploadHealthResult,
  type UploadHealthStatus,
} from "./checkUploadHealth";
export {
  retryWeakPhotoAnalyses,
  mergeAnalysesRetainingGood,
  analysisPhotoKey,
} from "./retryWeakAnalyses";

/** Re-export analytics for feature consumers (avoids new @/lib edges from components). */
export { trackEvent } from "@/lib/analytics";

/** Transitional write primitives re-exported so routes avoid new @/lib edges. */
export {
  uploadProjectPhotos,
  removeProjectPhoto,
  PhotoUploadBatchError,
  PhotoWriteError,
  MAX_PHOTOS_PER_BATCH,
  MAX_PHOTO_BYTES,
  PROJECT_PHOTOS_BUCKET,
  type PhotoUploadItemEvent,
  type PhotoUploadItemState,
  type PhotoWriteStage,
  type PhotoUploadFailure,
} from "@/lib/photos-write";
export type { ProjectPhoto } from "@/lib/photos-types";
