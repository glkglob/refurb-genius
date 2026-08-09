/**
 * OBS-T1 — applyResolvedAnalyticsIdentity side-effect contracts (mocked PostHog).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const identify = vi.fn();
const reset = vi.fn();
const capture = vi.fn();

vi.mock("@/platform/posthog/browser", () => ({
  posthog: {
    identify: (...args: unknown[]) => identify(...args),
    reset: (...args: unknown[]) => reset(...args),
    capture: (...args: unknown[]) => capture(...args),
  },
}));

import {
  __resetPageviewDedupeForTests,
  __setAnalyticsEnabledForTests,
  __setAnalyticsIdentityStateForTests,
  applyResolvedAnalyticsIdentity,
  getAnalyticsIdentityStateForTests,
  resetAnalyticsUser,
  trackPageView,
} from "@/lib/analytics";
import { ANALYTICS_IDENTITY_UNRESOLVED } from "./identity";

beforeEach(() => {
  identify.mockReset();
  reset.mockReset();
  capture.mockReset();
  __setAnalyticsEnabledForTests(true);
  __setAnalyticsIdentityStateForTests(ANALYTICS_IDENTITY_UNRESOLVED);
  __resetPageviewDedupeForTests();
});

describe("applyResolvedAnalyticsIdentity", () => {
  it("identifies once on UNRESOLVED → user", () => {
    applyResolvedAnalyticsIdentity("user-a");
    expect(identify).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledWith("user-a");
    expect(reset).not.toHaveBeenCalled();
    expect(getAnalyticsIdentityStateForTests()).toBe("user-a");
  });

  it("does not re-identify same user", () => {
    applyResolvedAnalyticsIdentity("user-a");
    applyResolvedAnalyticsIdentity("user-a");
    expect(identify).toHaveBeenCalledTimes(1);
  });

  it("resets on logout", () => {
    applyResolvedAnalyticsIdentity("user-a");
    applyResolvedAnalyticsIdentity(null);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(getAnalyticsIdentityStateForTests()).toBe(null);
  });

  it("resets then identifies on account switch", () => {
    applyResolvedAnalyticsIdentity("user-a");
    applyResolvedAnalyticsIdentity("user-b");
    expect(reset).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledTimes(2);
    expect(identify.mock.calls[1]?.[0]).toBe("user-b");
    // Order: first identify A, then reset, then identify B
    const order = [
      ...identify.mock.invocationCallOrder.map((n) => ({ n, t: "identify" as const })),
      ...reset.mock.invocationCallOrder.map((n) => ({ n, t: "reset" as const })),
    ].sort((a, b) => a.n - b.n);
    expect(order.map((o) => o.t)).toEqual(["identify", "reset", "identify"]);
  });

  it("does not reset on first anonymous resolution", () => {
    applyResolvedAnalyticsIdentity(null);
    expect(reset).not.toHaveBeenCalled();
    expect(identify).not.toHaveBeenCalled();
  });
});

describe("trackPageView", () => {
  it("emits $pageview with route_template and safe $current_url", () => {
    trackPageView("/projects/$id/estimate");
    expect(capture).toHaveBeenCalledTimes(1);
    const [event, props] = capture.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe("$pageview");
    expect(props.route_template).toBe("/projects/$id/estimate");
    expect(String(props.$current_url)).toContain("/projects/$id/estimate");
    expect(String(props.$current_url)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
    expect(props.$pathname).toBe("/projects/$id/estimate");
  });

  it("dedupes identical consecutive templates", () => {
    trackPageView("/dashboard");
    trackPageView("/dashboard");
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("emits again when template changes", () => {
    trackPageView("/dashboard");
    trackPageView("/projects");
    expect(capture).toHaveBeenCalledTimes(2);
  });
});

describe("resetAnalyticsUser", () => {
  it("calls posthog.reset even without prior trackEvent", () => {
    resetAnalyticsUser();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
