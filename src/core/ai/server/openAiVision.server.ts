/**
 * Legacy shim — implementation moved to the ai-upload feature slice.
 * New code: dynamic-import
 * `@/features/ai-upload/infrastructure/adapters/ai-vision.adapter.server`.
 * TODO(feature-slice): delete once no importers remain.
 */
export { runSecurePhotoAnalysis } from "@/features/ai-upload/infrastructure/adapters/ai-vision.adapter.server";
