import { posthog } from "@/platform/posthog/browser";

import {
  ANALYTICS_IDENTITY_UNRESOLVED,
  planAnalyticsIdentityTransition,
  type AnalyticsIdentityState,
} from "@/platform/analytics/identity";
import { buildSafePageviewUrl } from "@/platform/analytics/route-template";
import { logger } from "./logger";
import { sanitizeIdentifier, sanitizeTelemetryMetadata, type TelemetryMetadata } from "./telemetry";

export type AnalyticsEventName =
  | "deal_analyzed"
  | "roi_viewed"
  | "report_exported"
  | "signup_completed"
  | "pricing_band_selected"
  | "onboarding_started"
  | "onboarding_completed"
  | "session_abandoned"
  | "user_signed_in"
  | "oauth_sign_in_initiated"
  | "project_created"
  | "photos_uploaded"
  | "upload_started"
  | "upload_failed"
  | "upload_partial_success"
  | "ai_analysis_started"
  | "ai_analysis_completed"
  | "analysis_fallback"
  | "analysis_retry"
  | "estimate_generated"
  | "estimate_viewed"
  | "trades_job_posted"
  | "marketplace_listing_viewed"
  | "study_created"
  | "study_shared"
  | "deal_thread_created"
  | "deal_message_sent";

type FunnelState = {
  started: boolean;
  completed: boolean;
  lastEvent: AnalyticsEventName;
  source?: string;
  startedAt: string;
};

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || undefined;

/** Production + browser + project token required. Overridable in unit tests. */
let enabledOverride: boolean | null = null;

function isAnalyticsEnabled(): boolean {
  if (enabledOverride !== null) return enabledOverride;
  return Boolean(typeof window !== "undefined" && import.meta.env.PROD && posthogKey);
}

const funnelStorageKey = "refurb-genius:funnel";

let initialized = false;
let abandonmentListenerBound = false;

/** Last applied analytics identity (module-level so helper remains the authority). */
let analyticsIdentityState: AnalyticsIdentityState = ANALYTICS_IDENTITY_UNRESOLVED;

/** Last pageview template emitted (dedupe SPA/auth rerenders). */
let lastPageviewTemplate: string | null = null;

function readFunnelState(): FunnelState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(funnelStorageKey);
    if (!raw) return null;
    return JSON.parse(raw) as FunnelState;
  } catch {
    return null;
  }
}

function writeFunnelState(state: FunnelState | null): void {
  if (typeof window === "undefined") return;

  try {
    if (!state) {
      window.sessionStorage.removeItem(funnelStorageKey);
      return;
    }
    window.sessionStorage.setItem(funnelStorageKey, JSON.stringify(state));
  } catch {
    // Ignore blocked sessionStorage.
  }
}

function markFunnelState(event: AnalyticsEventName, source?: string, completed = false): void {
  const current = readFunnelState();
  writeFunnelState({
    started: true,
    completed: completed || current?.completed || false,
    lastEvent: event,
    source: source ?? current?.source,
    startedAt: current?.startedAt ?? new Date().toISOString(),
  });
}

function clearFunnelState(): void {
  writeFunnelState(null);
}

function bindSessionAbandonment(): void {
  if (!isAnalyticsEnabled() || abandonmentListenerBound || typeof window === "undefined") return;

  const onPageHide = () => {
    const state = readFunnelState();
    if (!state || state.completed) return;

    posthog.capture(
      "session_abandoned",
      sanitizeTelemetryMetadata({
        source: state.source ?? "unknown",
        lastEvent: state.lastEvent,
      }),
    );
    clearFunnelState();
  };

  window.addEventListener("pagehide", onPageHide);
  abandonmentListenerBound = true;
}

export function initializeAnalytics(): void {
  if (!isAnalyticsEnabled() || initialized) return;

  // posthog-js is initialized by PostHogProvider / initPostHog in __root.tsx;
  // this function only wires the session-abandonment listener.
  bindSessionAbandonment();
  initialized = true;
}

/**
 * Identify the current authenticated user for product analytics.
 * Opaque user UUID only — never pass email/name/person properties here.
 */
export function identifyAnalyticsUser(userId: string | null | undefined): void {
  if (!isAnalyticsEnabled() || !userId) return;
  initializeAnalytics();
  try {
    posthog.identify(userId);
  } catch (error) {
    logger.warn("[analytics] identify failed", { error: String(error) });
  }
}

/**
 * Reset PostHog person identity (logout / account switch).
 * Safe to call even when only identify has run (does not require prior trackEvent).
 */
export function resetAnalyticsUser(): void {
  if (!isAnalyticsEnabled()) return;
  initializeAnalytics();
  try {
    posthog.reset();
  } catch (error) {
    logger.warn("[analytics] reset failed", { error: String(error) });
  }
  clearFunnelState();
  lastPageviewTemplate = null;
}

/**
 * Apply a resolved auth identity observation (null = signed out).
 * Dedupes same-user re-observations; handles A→B with reset-then-identify.
 *
 * @returns whether an identify or reset side-effect was applied
 */
export function applyResolvedAnalyticsIdentity(nextUserId: string | null): {
  applied: boolean;
  action: string;
} {
  const plan = planAnalyticsIdentityTransition(analyticsIdentityState, nextUserId);

  if (plan.action === "noop") {
    analyticsIdentityState = plan.next;
    return { applied: false, action: "noop" };
  }

  if (plan.action === "identify") {
    identifyAnalyticsUser(plan.userId);
    analyticsIdentityState = plan.next;
    return { applied: true, action: "identify" };
  }

  if (plan.action === "reset") {
    resetAnalyticsUser();
    analyticsIdentityState = plan.next;
    return { applied: true, action: "reset" };
  }

  // reset_then_identify
  resetAnalyticsUser();
  identifyAnalyticsUser(plan.userId);
  analyticsIdentityState = plan.next;
  return { applied: true, action: "reset_then_identify" };
}

/** Test / diagnostics helper — current identity observation. */
export function getAnalyticsIdentityStateForTests(): AnalyticsIdentityState {
  return analyticsIdentityState;
}

/** Test helper — force identity state without PostHog side effects. */
export function __setAnalyticsIdentityStateForTests(state: AnalyticsIdentityState): void {
  analyticsIdentityState = state;
}

/** Test helper — reset module pageview dedupe. */
export function __resetPageviewDedupeForTests(): void {
  lastPageviewTemplate = null;
}

/** Test helper — force analytics on/off (null restores env-based gate). */
export function __setAnalyticsEnabledForTests(value: boolean | null): void {
  enabledOverride = value;
}

/**
 * Capture a single SPA `$pageview` for a sanitized route template.
 * Overrides `$current_url` / `$pathname` so raw UUID URLs never leave the client.
 */
export function trackPageView(routeTemplate: string, options?: { force?: boolean }): void {
  if (!isAnalyticsEnabled()) return;
  if (!routeTemplate) return;

  if (!options?.force && routeTemplate === lastPageviewTemplate) {
    return;
  }

  initializeAnalytics();

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.refurbgenius.info";
  const safeUrl = buildSafePageviewUrl(origin, routeTemplate);

  try {
    posthog.capture(
      "$pageview",
      sanitizeTelemetryMetadata({
        route_template: routeTemplate,
        // Override auto-attached browser URL (merge-blocking privacy).
        $current_url: safeUrl,
        $pathname: routeTemplate,
      }),
    );
    lastPageviewTemplate = routeTemplate;
  } catch (error) {
    logger.warn("[analytics] pageview failed", { error: String(error) });
  }
}

export function trackEvent(name: AnalyticsEventName, properties?: TelemetryMetadata): void {
  if (!isAnalyticsEnabled()) return;

  initializeAnalytics();
  try {
    posthog.capture(name, sanitizeTelemetryMetadata(properties));
  } catch (error) {
    logger.warn("[analytics] capture failed", { event: name, error: String(error) });
  }
}

export function trackOnboardingStarted(source: string): void {
  markFunnelState("onboarding_started", source);
  trackEvent("onboarding_started", { source });
}

export function trackOnboardingCompleted(source: string, userId?: string): void {
  markFunnelState("onboarding_completed", source, true);
  trackEvent("onboarding_completed", { source, userId: sanitizeIdentifier(userId) });
}

export function trackSignupCompleted(provider: "email" | "google", userId?: string): void {
  markFunnelState("signup_completed", provider, true);
  trackEvent("signup_completed", { provider, userId: sanitizeIdentifier(userId) });
}

export function trackDealAnalyzed(surface: string): void {
  markFunnelState("deal_analyzed", surface);
  trackEvent("deal_analyzed", { surface });
}

export function trackRoiViewed(surface: string): void {
  markFunnelState("roi_viewed", surface);
  trackEvent("roi_viewed", { surface });
}

export function trackPricingBandSelected(band: "mid", surface: string): void {
  trackEvent("pricing_band_selected", { band, surface, authority: "pricing.mid_total" });
}

export function trackReportExported(surface: string, pageCount?: number): void {
  markFunnelState("report_exported", surface, true);
  trackEvent("report_exported", { surface, pageCount });
}
