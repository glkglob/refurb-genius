/**
 * Platform boundary — PostHog (browser context).
 *
 * Slice presentation and app shell code import analytics primitives from here,
 * never directly from `posthog-js` or `@posthog/react`.
 */
export { default as posthog } from "posthog-js";
export { PostHogProvider } from "@posthog/react";
