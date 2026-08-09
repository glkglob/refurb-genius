/**
 * Platform boundary — PostHog (browser context).
 *
 * Slice presentation and app shell code import analytics primitives from here,
 * never directly from `posthog-js` or `@posthog/react`.
 */
import type { PostHogConfig } from "posthog-js";
import posthog from "posthog-js";

import { sanitizePostHogBrowserEvent } from "./sanitize-outbound";

export { PostHogProvider } from "@posthog/react";
export { posthog };
export {
  POSTHOG_URL_PATH_PROPERTY_INVENTORY,
  isPostHogUrlPathPropertyName,
  sanitizeAnalyticsPathname,
  sanitizeAnalyticsUrl,
  sanitizePostHogBrowserEvent,
} from "./sanitize-outbound";

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
    // OBS-T1-R2: browser-wide outbound URL/path/referrer privacy (after SDK auto-props).
    before_send: sanitizePostHogBrowserEvent,
  };
}

/**
 * Idempotent PostHog initialization authority.
 * Analytics capture/identify/reset must call this before SDK use so correctness
 * does not depend on React parent/child effect ordering.
 *
 * @returns true when the SDK is ready to accept capture/identify/reset
 */
export function ensurePostHogInitialized(): boolean {
  if (typeof window === "undefined") return false;
  if (posthogInitialized) return true;

  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!apiKey) return false;

  try {
    posthog.init(apiKey, getPostHogBrowserConfig());
    posthogInitialized = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Eager warm-up entry (e.g. RootComponent). Delegates to ensurePostHogInitialized.
 * Safe to call multiple times; not a second competing authority.
 */
export function initPostHog(): void {
  ensurePostHogInitialized();
}

/** Test helper — reset module init flag (does not tear down the SDK instance). */
export function __resetPostHogInitializedForTests(): void {
  posthogInitialized = false;
}

/** Test helper — force init flag without calling posthog.init. */
export function __setPostHogInitializedForTests(value: boolean): void {
  posthogInitialized = value;
}
