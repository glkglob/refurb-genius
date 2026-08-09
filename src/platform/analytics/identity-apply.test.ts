/**
 * OBS-T1 / OBS-T1-R1 — applyResolvedAnalyticsIdentity + trackPageView contracts (mocked PostHog).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const identify = vi.fn();
const reset = vi.fn();
const capture = vi.fn();
const ensurePostHogInitialized = vi.fn(() => true);

vi.mock("@/platform/posthog/browser", () => ({
  posthog: {
    identify: (...args: unknown[]) => identify(...args),
    reset: (...args: unknown[]) => reset(...args),
    capture: (...args: unknown[]) => capture(...args),
  },
  ensurePostHogInitialized: () => ensurePostHogInitialized(),
  initPostHog: () => ensurePostHogInitialized(),
}));

import {
  __getLastPageviewNavigationKeyForTests,
  __resetPageviewDedupeForTests,
  __setAnalyticsEnabledForTests,
  __setAnalyticsIdentityStateForTests,
  applyResolvedAnalyticsIdentity,
  getAnalyticsIdentityStateForTests,
  identifyAnalyticsUser,
  resetAnalyticsUser,
  trackPageView,
} from "@/lib/analytics";
import { ANALYTICS_IDENTITY_UNRESOLVED } from "./identity";

beforeEach(() => {
  identify.mockReset();
  reset.mockReset();
  capture.mockReset();
  ensurePostHogInitialized.mockReset();
  ensurePostHogInitialized.mockReturnValue(true);
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

  it("identify ensures PostHog initialization before SDK call", () => {
    identifyAnalyticsUser("user-a");
    expect(ensurePostHogInitialized).toHaveBeenCalled();
    expect(identify).toHaveBeenCalledWith("user-a");
    // identify only receives opaque id — no person props object
    expect(identify.mock.calls[0]?.length).toBe(1);
  });

  it("reset ensures PostHog initialization before SDK call", () => {
    resetAnalyticsUser();
    expect(ensurePostHogInitialized).toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("skips identify when ensurePostHogInitialized returns false", () => {
    ensurePostHogInitialized.mockReturnValue(false);
    identifyAnalyticsUser("user-a");
    expect(identify).not.toHaveBeenCalled();
  });
});

describe("trackPageView", () => {
  it("emits $pageview with route_template and safe $current_url", () => {
    trackPageView("/projects/$id/estimate");
    expect(ensurePostHogInitialized).toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(1);
    const [event, props] = capture.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe("$pageview");
    expect(props.route_template).toBe("/projects/$id/estimate");
    expect(String(props.$current_url)).toContain("/projects/$id/estimate");
    expect(String(props.$current_url)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
    expect(props.$pathname).toBe("/projects/$id/estimate");
    // navigationKey must never appear in the payload
    expect(props).not.toHaveProperty("navigationKey");
    expect(props).not.toHaveProperty("navigation_key");
  });

  it("ensures initialization before capture (cold-load failure mode)", () => {
    trackPageView("/trades", { navigationKey: "/trades" });
    const ensureOrder = ensurePostHogInitialized.mock.invocationCallOrder[0] ?? 0;
    const captureOrder = capture.mock.invocationCallOrder[0] ?? 0;
    expect(ensureOrder).toBeLessThan(captureOrder);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("does not advance dedupe when initialization fails", () => {
    ensurePostHogInitialized.mockReturnValue(false);
    trackPageView("/trades", { navigationKey: "/trades" });
    expect(capture).not.toHaveBeenCalled();
    expect(__getLastPageviewNavigationKeyForTests()).toBe(null);

    // Recovery: later successful init can still emit the same navigation
    ensurePostHogInitialized.mockReturnValue(true);
    trackPageView("/trades", { navigationKey: "/trades" });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(__getLastPageviewNavigationKeyForTests()).toBe("/trades");
  });

  it("emits no pageview when analytics disabled", () => {
    __setAnalyticsEnabledForTests(false);
    trackPageView("/trades");
    expect(ensurePostHogInitialized).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("dedupes identical consecutive navigation keys", () => {
    trackPageView("/dashboard", { navigationKey: "/dashboard" });
    trackPageView("/dashboard", { navigationKey: "/dashboard" });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("emits again when public route_template changes", () => {
    trackPageView("/dashboard", { navigationKey: "/dashboard" });
    trackPageView("/projects", { navigationKey: "/projects" });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("Project A → Project B: two pageviews, same route_template, no raw ids", () => {
    const idA = "11111111-2222-4333-8444-555555555555";
    const idB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    trackPageView("/projects/$id", { navigationKey: `/projects/${idA}` });
    trackPageView("/projects/$id", { navigationKey: `/projects/${idB}` });

    expect(capture).toHaveBeenCalledTimes(2);
    for (const call of capture.mock.calls) {
      const [event, props] = call as [string, Record<string, unknown>];
      expect(event).toBe("$pageview");
      expect(props.route_template).toBe("/projects/$id");
      expect(props.$pathname).toBe("/projects/$id");
      expect(String(props.$current_url)).toContain("/projects/$id");
      expect(String(props.$current_url)).not.toContain(idA);
      expect(String(props.$current_url)).not.toContain(idB);
      expect(JSON.stringify(props)).not.toContain(idA);
      expect(JSON.stringify(props)).not.toContain(idB);
      expect(props).not.toHaveProperty("navigationKey");
    }
  });

  it("same project remount/rerender (same navigationKey): one pageview", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    trackPageView("/projects/$id", { navigationKey: `/projects/${id}` });
    trackPageView("/projects/$id", { navigationKey: `/projects/${id}` });
    trackPageView("/projects/$id", { navigationKey: `/projects/${id}` });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("overview → estimate: new pageview with deeper template", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    trackPageView("/projects/$id", { navigationKey: `/projects/${id}` });
    trackPageView("/projects/$id/estimate", { navigationKey: `/projects/${id}/estimate` });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[1]?.[1]).toMatchObject({
      route_template: "/projects/$id/estimate",
      $pathname: "/projects/$id/estimate",
    });
  });

  it("Trade Job A → Job B: two pageviews, same template", () => {
    const jobA = "11111111-2222-4333-8444-555555555555";
    const jobB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    trackPageView("/trades/$jobId", { navigationKey: `/trades/${jobA}` });
    trackPageView("/trades/$jobId", { navigationKey: `/trades/${jobB}` });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({ route_template: "/trades/$jobId" });
    expect(capture.mock.calls[1]?.[1]).toMatchObject({ route_template: "/trades/$jobId" });
    const serialized = JSON.stringify(capture.mock.calls);
    expect(serialized).not.toContain(jobA);
    expect(serialized).not.toContain(jobB);
  });

  it("force: true re-emits even when navigationKey matches", () => {
    trackPageView("/dashboard", { navigationKey: "/dashboard" });
    trackPageView("/dashboard", { navigationKey: "/dashboard", force: true });
    expect(capture).toHaveBeenCalledTimes(2);
  });
});

describe("resetAnalyticsUser", () => {
  it("calls posthog.reset even without prior trackEvent", () => {
    resetAnalyticsUser();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("clears pageview navigation dedupe", () => {
    trackPageView("/dashboard", { navigationKey: "/dashboard" });
    expect(__getLastPageviewNavigationKeyForTests()).toBe("/dashboard");
    resetAnalyticsUser();
    expect(__getLastPageviewNavigationKeyForTests()).toBe(null);
    trackPageView("/dashboard", { navigationKey: "/dashboard" });
    expect(capture).toHaveBeenCalledTimes(2);
  });
});
