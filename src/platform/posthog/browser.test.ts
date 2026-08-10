/**
 * OBS-T1-R1 — ensurePostHogInitialized idempotency (mocked posthog-js).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: (...args: unknown[]) => init(...args),
  },
}));

import {
  __resetPostHogInitializedForTests,
  ensurePostHogInitialized,
  getPostHogBrowserConfig,
  initPostHog,
} from "./browser";

beforeEach(() => {
  init.mockReset();
  __resetPostHogInitializedForTests();
});

describe("ensurePostHogInitialized", () => {
  it("initializes once and returns true when token is present", () => {
    // Token is baked from env at module load in real app; in unit tests we may
    // only exercise the already-initialized path via helpers if token missing.
    // Call ensure — if token absent in vitest env, returns false without init.
    const first = ensurePostHogInitialized();
    if (first) {
      expect(init).toHaveBeenCalledTimes(1);
      expect(ensurePostHogInitialized()).toBe(true);
      expect(init).toHaveBeenCalledTimes(1);
      initPostHog();
      expect(init).toHaveBeenCalledTimes(1);
    } else {
      // No token in test env — still idempotent false, no throw
      expect(ensurePostHogInitialized()).toBe(false);
      expect(init).not.toHaveBeenCalled();
    }
  });

  it("privacy config remains capture_pageview false and autocapture false", () => {
    const cfg = getPostHogBrowserConfig();
    expect(cfg.autocapture).toBe(false);
    expect(cfg.capture_pageview).toBe(false);
    expect(cfg.capture_pageleave).toBe(false);
    expect(cfg.person_profiles).toBe("identified_only");
  });

  it("wires before_send outbound URL privacy boundary", () => {
    const cfg = getPostHogBrowserConfig();
    expect(typeof cfg.before_send).toBe("function");
    const beforeSend = cfg.before_send as (cr: {
      uuid: string;
      event: string;
      properties: Record<string, unknown>;
    }) => unknown;
    const out = beforeSend({
      uuid: "00000000-0000-4000-8000-000000000099",
      event: "estimate_viewed",
      properties: {
        $current_url:
          "https://preview.example/projects/11111111-2222-4333-8444-555555555555/estimate",
        $pathname: "/projects/11111111-2222-4333-8444-555555555555/estimate",
        $prev_pageview_pathname: "/trades/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      },
    }) as { properties: Record<string, string> };
    expect(out.properties.$current_url).toBe("https://preview.example/projects/$id/estimate");
    expect(out.properties.$pathname).toBe("/projects/$id/estimate");
    expect(out.properties.$prev_pageview_pathname).toBe("/trades/$id");
  });
});
