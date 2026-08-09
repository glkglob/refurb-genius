import {
  applyResolvedAnalyticsIdentity,
  identifyAnalyticsUser,
  resetAnalyticsUser,
  trackEvent,
  trackPageView,
  type AnalyticsEventName,
} from "@/lib/analytics";
import { sanitizeTelemetryMetadata, type TelemetryMetadata } from "@/lib/telemetry";

export { AnalyticsLifecycle } from "./AnalyticsLifecycle";
export {
  ANALYTICS_IDENTITY_UNRESOLVED,
  planAnalyticsIdentityTransition,
  type AnalyticsIdentityPlan,
  type AnalyticsIdentityState,
} from "./identity";
export {
  buildSafePageviewUrl,
  deriveRouteTemplateFromMatches,
  normalizeRouteTemplate,
  redactDynamicSegments,
  type RouterMatchLike,
} from "./route-template";

export interface AnalyticsProvider {
  identifyUser(userId: string): void;
  resetUser(): void;
  track(name: AnalyticsEventName, properties?: TelemetryMetadata): void;
  trackPageView(routeTemplate: string, options?: { navigationKey?: string; force?: boolean }): void;
  applyResolvedIdentity(userId: string | null): void;
}

export const createAnalytics = (): AnalyticsProvider => ({
  identifyUser: identifyAnalyticsUser,
  resetUser: resetAnalyticsUser,
  track: (name, properties) => trackEvent(name, sanitizeTelemetryMetadata(properties)),
  trackPageView,
  applyResolvedIdentity: (userId) => {
    applyResolvedAnalyticsIdentity(userId);
  },
});
