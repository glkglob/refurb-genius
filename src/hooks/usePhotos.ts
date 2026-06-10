/**
 * Legacy shim — moved to the ai-upload feature slice.
 * TODO(feature-slice): delete once no importers remain.
 */
export {
  usePhotos,
  useUploadPhotos,
  useRemovePhoto,
} from "@/features/ai-upload/presentation/hooks/usePhotos";
