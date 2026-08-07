/**
 * Bounded domain errors for photo analysis authority (P0-PHOTO-ANALYZE).
 */

export const PHOTO_ANALYSIS_NO_SOURCE_PHOTOS = "PHOTO_ANALYSIS_NO_SOURCE_PHOTOS" as const;
export const PHOTO_ANALYSIS_CARDINALITY_MISMATCH = "PHOTO_ANALYSIS_CARDINALITY_MISMATCH" as const;
export const PHOTO_ANALYSIS_PROVENANCE_MISMATCH = "PHOTO_ANALYSIS_PROVENANCE_MISMATCH" as const;
export const PHOTO_ANALYSIS_MOCK_FORBIDDEN = "PHOTO_ANALYSIS_MOCK_FORBIDDEN" as const;
export const PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS =
  "PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS" as const;
export const PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED =
  "PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED" as const;
export const PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED = "PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED" as const;
export const PHOTO_ANALYSIS_SOURCE_SET_MISMATCH = "PHOTO_ANALYSIS_SOURCE_SET_MISMATCH" as const;
export const PHOTO_ANALYSIS_PERSISTENCE_FAILED = "PHOTO_ANALYSIS_PERSISTENCE_FAILED" as const;

export type PhotoAnalysisErrorCode =
  | typeof PHOTO_ANALYSIS_NO_SOURCE_PHOTOS
  | typeof PHOTO_ANALYSIS_CARDINALITY_MISMATCH
  | typeof PHOTO_ANALYSIS_PROVENANCE_MISMATCH
  | typeof PHOTO_ANALYSIS_MOCK_FORBIDDEN
  | typeof PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS
  | typeof PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED
  | typeof PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED
  | typeof PHOTO_ANALYSIS_SOURCE_SET_MISMATCH
  | typeof PHOTO_ANALYSIS_PERSISTENCE_FAILED
  | string;

export class PhotoAnalysisError extends Error {
  readonly code: PhotoAnalysisErrorCode;

  constructor(code: PhotoAnalysisErrorCode, message: string) {
    super(message);
    this.name = "PhotoAnalysisError";
    this.code = code;
  }
}

export function noSourcePhotosError(): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_NO_SOURCE_PHOTOS,
    "Upload at least one project photo before running AI analysis.",
  );
}

export function staleAnalysisRequiresReanalysisError(): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS,
    "Previous analysis was not based on the current project photos. Run analysis again to use your uploaded photos.",
  );
}

export function projectNotAuthorisedError(): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
    "Photo analysis is not available for this project.",
  );
}

export function sourceNotAuthorisedError(): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED,
    "Photo analysis is not available for one or more selected photos.",
  );
}

export function sourceSetMismatchError(): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_SOURCE_SET_MISMATCH,
    "Photo analysis source set is invalid or incomplete.",
  );
}

export function persistenceFailedError(detail?: string): PhotoAnalysisError {
  return new PhotoAnalysisError(
    PHOTO_ANALYSIS_PERSISTENCE_FAILED,
    detail?.trim() ? `Failed to save photo analysis: ${detail}` : "Failed to save photo analysis.",
  );
}
