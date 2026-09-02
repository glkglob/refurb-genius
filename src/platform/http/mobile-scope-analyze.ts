/**
 * Native client helper for Bearer scope analysis (NATIVE-SCOPE-ANALYSIS-1).
 *
 * POST https://<production>/api/mobile/v1/scope/analyze
 * Returns unknown JSON — callers must assert ScopeAnalysisResult.
 * Does not import feature domain types (public-api boundary).
 */
import { nativeAuthenticatedJson } from "./native-authenticated-fetch";
import { MOBILE_API_PREFIX } from "./mobile-session-ping";

export const MOBILE_SCOPE_ANALYZE_PATH = `${MOBILE_API_PREFIX}/scope/analyze` as const;

export type RunScopeAnalysisNativeInput = {
  projectId: string;
  photos: Array<{ id: string; url: string; name: string; size?: number }>;
  roomTags: string[];
  propertyType: string;
  bedrooms: number;
  bathrooms?: number;
  region: string;
  notes?: string;
};

export async function runScopeAnalysisNative(input: RunScopeAnalysisNativeInput): Promise<unknown> {
  const photos = input.photos.map((photo) => {
    const row: { id: string; url: string; name: string; size?: number } = {
      id: photo.id,
      url: photo.url,
      name: photo.name,
    };
    if (photo.size != null) row.size = photo.size;
    return row;
  });

  const json: Record<string, unknown> = {
    projectId: input.projectId,
    photos,
    roomTags: input.roomTags,
    propertyType: input.propertyType,
    bedrooms: input.bedrooms,
    region: input.region,
  };
  if (input.bathrooms != null) json.bathrooms = input.bathrooms;
  if (input.notes != null) json.notes = input.notes;

  return nativeAuthenticatedJson<unknown>(MOBILE_SCOPE_ANALYZE_PATH, {
    method: "POST",
    json,
  });
}
