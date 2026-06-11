/**
 * Pure file-type utilities shared across the app.
 *
 * Intentionally dependency-free so any module (including feature-slice
 * infrastructure) can import without creating circular references.
 */

export const IMAGE_EXTENSIONS = new Set([
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

export const EXT_TO_MIME: Record<string, string> = {
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

/** Lowercased file extension, or undefined when the name has none. */
export function fileExtension(name: string): string | undefined {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
  return ext ? ext : undefined;
}

/** True when the file is an image, by MIME type or extension fallback (covers HEIC, mobile captures). */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = fileExtension(file.name);
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

/**
 * Resolve the content type to send to storage.
 * Camera captures on mobile often arrive with an empty `file.type`;
 * fall back to the extension (or JPEG) so the object is stored as an
 * image rather than `application/octet-stream`.
 */
export function imageContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = fileExtension(file.name);
  return (ext && EXT_TO_MIME[ext]) || "image/jpeg";
}
