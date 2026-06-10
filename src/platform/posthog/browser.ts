/**
 * Platform boundary — PostHog (browser context).
 *
 * Slice presentation and app shell code import analytics primitives from here,
 * never directly from `posthog-js` or `@posthog/react`.
 */
import type { PostHogConfig } from "posthog-js";
import posthog from "posthog-js";

export { PostHogProvider } from "@posthog/react";
export { posthog };

let posthogInitialized = false;

export function getPostHogBrowserConfig(): Partial<PostHogConfig> {
  return {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-01-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    capture_exceptions: true,
  };
}

export function initPostHog(): void {
  if (typeof window === "undefined" || posthogInitialized) return;
  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!apiKey) return;
  posthog.init(apiKey, getPostHogBrowserConfig());
  posthogInitialized = true;
}
