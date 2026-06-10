import { identifyAnalyticsUser, trackEvent, type AnalyticsEventName } from "@/lib/analytics";
import { sanitizeTelemetryMetadata, type TelemetryMetadata } from "@/lib/telemetry";

export interface AnalyticsProvider {
  identifyUser(userId: string): void;
  track(name: AnalyticsEventName, properties?: TelemetryMetadata): void;
}

export const createAnalytics = (): AnalyticsProvider => ({
  identifyUser: identifyAnalyticsUser,
  track: (name, properties) => trackEvent(name, sanitizeTelemetryMetadata(properties)),
});
