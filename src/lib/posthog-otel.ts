/**
 * Backward compatibility shim — OTEL bootstrap lives in the platform layer.
 * TODO(feature-slice): remove when server entry imports @/platform/posthog/otel.server directly.
 */
import "@/platform/posthog/otel.server";
