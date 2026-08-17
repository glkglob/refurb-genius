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
export { runPhotoAnalysisForClient } from "./runPhotoAnalysisForClient";
export {
  AnalysisRecoveryActions,
  type AnalysisRecoveryActionsProps,
} from "./AnalysisRecoveryActions";
export { useRoomAnalyses, useRunPhotoAnalysis, photoAnalysisKeys } from "./hooks/usePhotoAnalysis";
export { usePhotos, useUploadPhotos, useRemovePhoto } from "./hooks/usePhotos";
export {
  useInvalidateProjectPhotos,
  invalidateProjectPhotoQueries,
} from "./hooks/useInvalidateProjectPhotos";
export {
  useProjectPhotoDisplayUrl,
  useProjectPhotoDisplayUrls,
  projectPhotoDisplayQueryOptions,
  retryProjectPhotoDisplayOnce,
} from "./hooks/useProjectPhotoDisplayUrl";
export {
  createProjectPhotoSignedUrl,
  SIGNED_URL_TTL_SECONDS,
  SIGNED_URL_REFRESH_MARGIN_SECONDS,
  SIGNED_URL_STALE_TIME_MS,
  isProjectPhotoDisplayFresh,
  ProjectPhotoDisplayError,
} from "./projectPhotoDisplay";
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
export {
  classifyPhotoUploadAnalyticsError,
  type UploadFailureAnalytics,
  type UploadAnalyticsStage,
  type UploadAnalyticsReason,
} from "./classifyPhotoUploadAnalyticsError";

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
  MAX_CONCURRENT_PHOTO_UPLOADS,
  PROJECT_PHOTOS_BUCKET,
  type PhotoUploadItemEvent,
  type PhotoUploadItemState,
  type PhotoWriteStage,
  type PhotoUploadFailure,
  type PhotoWriteErrorCode,
} from "@/lib/photos-write";
export type { ProjectPhoto } from "@/lib/photos-types";
