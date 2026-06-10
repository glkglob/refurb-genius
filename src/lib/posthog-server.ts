/**
 * Backward compatibility shim — PostHog server client lives in the platform layer.
 * TODO(feature-slice): remove when all callers import from @/platform/posthog/server.
 */
export { getPostHogServerClient, type PostHog } from "@/platform/posthog/server";
