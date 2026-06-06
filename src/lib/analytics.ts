import posthog from "posthog-js";

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
  | "ai_analysis_started"
  | "ai_analysis_completed"
  | "estimate_viewed"
  | "trades_job_posted"
  | "marketplace_listing_viewed";

type FunnelState = {
  started: boolean;
  completed: boolean;
  lastEvent: AnalyticsEventName;
  source?: string;
  startedAt: string;
};

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN || undefined;

const enabled = Boolean(typeof window !== "undefined" && import.meta.env.PROD && posthogKey);
const funnelStorageKey = "refurb-genius:funnel";

let initialized = false;
let abandonmentListenerBound = false;

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
  if (!enabled || abandonmentListenerBound || typeof window === "undefined") return;

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
  if (!enabled || initialized) return;

  // posthog-js is initialized by PostHogProvider in __root.tsx;
  // this function only wires the session-abandonment listener.
  bindSessionAbandonment();
  initialized = true;
}

export function identifyAnalyticsUser(userId: string | null | undefined): void {
  if (!enabled || !userId) return;
  initializeAnalytics();
  posthog.identify(userId);
}

export function resetAnalyticsUser(): void {
  if (!enabled || !initialized) return;
  posthog.reset();
  clearFunnelState();
}

export function trackEvent(name: AnalyticsEventName, properties?: TelemetryMetadata): void {
  if (!enabled) return;

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
