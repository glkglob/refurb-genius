/**
 * Bounded domain errors for photo analysis authority (P0-PHOTO-ANALYZE).
 */

export const PHOTO_ANALYSIS_NO_SOURCE_PHOTOS = "PHOTO_ANALYSIS_NO_SOURCE_PHOTOS" as const;
export const PHOTO_ANALYSIS_CARDINALITY_MISMATCH = "PHOTO_ANALYSIS_CARDINALITY_MISMATCH" as const;
export const PHOTO_ANALYSIS_PROVENANCE_MISMATCH = "PHOTO_ANALYSIS_PROVENANCE_MISMATCH" as const;
export const PHOTO_ANALYSIS_MOCK_FORBIDDEN = "PHOTO_ANALYSIS_MOCK_FORBIDDEN" as const;
export const PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS =
  "PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS" as const;

export type PhotoAnalysisErrorCode =
  | typeof PHOTO_ANALYSIS_NO_SOURCE_PHOTOS
  | typeof PHOTO_ANALYSIS_CARDINALITY_MISMATCH
  | typeof PHOTO_ANALYSIS_PROVENANCE_MISMATCH
  | typeof PHOTO_ANALYSIS_MOCK_FORBIDDEN
  | typeof PHOTO_ANALYSIS_STALE_REQUIRES_REANALYSIS
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
