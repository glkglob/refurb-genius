/**
 * AI-upload slice — Domain rules.
 *
 * Pure judgements over domain types. Vision AI produces language and condition
 * signals; pricing/ROI math stays in @repo/services (not here).
 */
import type { RoomAnalysis } from "./types";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "avif",
]);

/** Lowercased file extension, or undefined when the name has none. */
function fileExtension(name: string): string | undefined {
  return name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
}

/** Accept camera/library picks where MIME is missing (common on mobile) or HEIC. */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = fileExtension(file.name);
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  avif: "image/avif",
};

/**
 * Resolve the content type to send to storage. Camera captures on mobile often
 * arrive with an empty `file.type`; fall back to the extension (or JPEG) so the
 * object is stored as an image rather than `application/octet-stream`.
 */
export function imageContentType(file: File): string {
  if (file.type) return file.type;
  const ext = fileExtension(file.name);
  return (ext && EXT_TO_MIME[ext]) || "image/jpeg";
}

/** A single analysis succeeded when the model returned a non-zero confidence. */
export function isSuccessfulAnalysis(analysis: RoomAnalysis): boolean {
  return analysis.confidence_score > 0 && analysis.source !== "fallback";
}

/** True when at least one photo fell back (per-photo failure or missing API key in dev). */
export function hasFallbackResults(analyses: RoomAnalysis[]): boolean {
  return analyses.some((a) => a.source === "fallback");
}

/** An analysis set is actionable when it contains at least one room with content. */
export function isActionableAnalysisSet(analyses: RoomAnalysis[]): boolean {
  return analyses.length > 0 && analyses.some((a) => a.ai_summary.length > 0);
}

/** Average confidence across a batch (0 when empty). */
export function averageConfidence(analyses: RoomAnalysis[]): number {
  if (analyses.length === 0) return 0;
  const sum = analyses.reduce((acc, a) => acc + a.confidence_score, 0);
  return sum / analyses.length;
}
