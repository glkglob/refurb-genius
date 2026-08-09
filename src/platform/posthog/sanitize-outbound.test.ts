/**
 * OBS-T1-R2 — outbound PostHog URL privacy boundary.
 */
import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";

import {
  POSTHOG_URL_PATH_PROPERTY_INVENTORY,
  isPostHogUrlPathPropertyName,
  sanitizeAnalyticsPathname,
  sanitizeAnalyticsUrl,
  sanitizePostHogBrowserEvent,
} from "./sanitize-outbound";

const PROJECT_UUID = "11111111-2222-4333-8444-555555555555";
const JOB_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OPPORTUNITY_UUID = "33333333-4444-4555-8666-777777777777";
const OPAQUE_ID = "abcdefghijklmnopqrstuvwxyz1234567890";

function event(
  name: string,
  properties: Record<string, unknown>,
  extra?: Partial<CaptureResult>,
): CaptureResult {
  return {
    uuid: "00000000-0000-4000-8000-000000000001",
    event: name,
    properties: properties as CaptureResult["properties"],
    ...extra,
  };
}

function assertNoResourceIds(value: unknown) {
  const s = String(value ?? "");
  expect(s).not.toContain(PROJECT_UUID);
  expect(s).not.toContain(JOB_UUID);
  expect(s).not.toContain(OPPORTUNITY_UUID);
  expect(s).not.toContain(OPAQUE_ID);
  expect(s).not.toContain("SECRET-OAUTH-CODE");
  expect(s).not.toContain("SYNTHETIC-TOKEN");
  expect(s).not.toContain("private@example.test");
  expect(s).not.toContain("PRIVATE-FRAGMENT");
}

describe("sanitizeAnalyticsPathname", () => {
  it("redacts project and trades job UUIDs to $id", () => {
    expect(sanitizeAnalyticsPathname(`/projects/${PROJECT_UUID}/estimate`)).toBe(
      "/projects/$id/estimate",
    );
    expect(sanitizeAnalyticsPathname(`/trades/${JOB_UUID}`)).toBe("/trades/$id");
    expect(sanitizeAnalyticsPathname(`/deal-copilot/${OPPORTUNITY_UUID}`)).toBe(
      "/deal-copilot/$id",
    );
    expect(sanitizeAnalyticsPathname(`/x/${OPAQUE_ID}`)).toBe("/x/$id");
  });

  it("preserves ordinary static paths", () => {
    for (const p of ["/dashboard", "/projects", "/trades", "/settings", "/privacy", "/auth"]) {
      expect(sanitizeAnalyticsPathname(p)).toBe(p);
    }
  });

  it("strips query and hash from path-like values", () => {
    expect(
      sanitizeAnalyticsPathname(
        `/projects/${PROJECT_UUID}?code=SECRET-OAUTH-CODE#PRIVATE-FRAGMENT`,
      ),
    ).toBe("/projects/$id");
  });

  it("is deterministic across repeated calls (no regex state)", () => {
    for (let i = 0; i < 25; i++) {
      expect(sanitizeAnalyticsPathname(`/trades/${JOB_UUID}`)).toBe("/trades/$id");
      expect(sanitizeAnalyticsPathname(`/projects/${PROJECT_UUID}`)).toBe("/projects/$id");
    }
  });
});

describe("sanitizeAnalyticsUrl", () => {
  it("keeps origin, strips query/hash, redacts path dynamics", () => {
    const input = `https://preview.example/projects/${PROJECT_UUID}/estimate?code=SECRET-OAUTH-CODE&email=private@example.test&token=SYNTHETIC-TOKEN#PRIVATE-FRAGMENT`;
    const out = sanitizeAnalyticsUrl(input);
    expect(out).toBe("https://preview.example/projects/$id/estimate");
    assertNoResourceIds(out);
  });

  it("preserves $direct referrer sentinel", () => {
    expect(sanitizeAnalyticsUrl("$direct")).toBe("$direct");
  });
});

describe("isPostHogUrlPathPropertyName", () => {
  it("includes inventory fields and excludes identity IDs", () => {
    for (const k of POSTHOG_URL_PATH_PROPERTY_INVENTORY) {
      expect(isPostHogUrlPathPropertyName(k)).toBe(true);
    }
    expect(isPostHogUrlPathPropertyName("distinct_id")).toBe(false);
    expect(isPostHogUrlPathPropertyName("$user_id")).toBe(false);
    expect(isPostHogUrlPathPropertyName("$device_id")).toBe(false);
    expect(isPostHogUrlPathPropertyName("$session_id")).toBe(false);
    expect(isPostHogUrlPathPropertyName("$browser")).toBe(false);
    expect(isPostHogUrlPathPropertyName("route_template")).toBe(false);
    expect(isPostHogUrlPathPropertyName("surface")).toBe(false);
  });
});

describe("sanitizePostHogBrowserEvent", () => {
  it("repairs $prev_pageview_pathname IV observation on $pageview", () => {
    const cr = event("$pageview", {
      route_template: "/trades/$jobId",
      $current_url: "https://preview.example/trades/$jobId",
      $pathname: "/trades/$jobId",
      // IV observation: previous real browser path leaked raw job UUID
      $prev_pageview_pathname: `/trades/${JOB_UUID}`,
      distinct_id: "019fe882-aa60-7f54-932b-ce1f7ac79cfa",
      $device_id: "019fe882-aa60-7f54-932b-ce1f7ac79cfa",
      $session_id: "019fe882-sess-0000-0000-000000000001",
    });

    const out = sanitizePostHogBrowserEvent(cr);
    expect(out).not.toBeNull();
    expect(out!.properties.$prev_pageview_pathname).toBe("/trades/$id");
    expect(out!.properties.$current_url).toBe("https://preview.example/trades/$jobId");
    expect(out!.properties.$pathname).toBe("/trades/$jobId");
    expect(out!.properties.route_template).toBe("/trades/$jobId");
    // Identity protocol preserved (opaque UUIDs OK)
    expect(out!.properties.distinct_id).toBe("019fe882-aa60-7f54-932b-ce1f7ac79cfa");
    expect(out!.properties.$device_id).toBe("019fe882-aa60-7f54-932b-ce1f7ac79cfa");
    expect(out!.properties.$session_id).toBe("019fe882-sess-0000-0000-000000000001");
    assertNoResourceIds(out!.properties.$prev_pageview_pathname);
  });

  it("sanitizes estimate_viewed automatic browser URL properties", () => {
    const cr = event("estimate_viewed", {
      surface: "builder",
      $current_url: `https://preview.example/projects/${PROJECT_UUID}/estimate?tab=summary`,
      $pathname: `/projects/${PROJECT_UUID}/estimate`,
      $prev_pageview_pathname: `/projects/${PROJECT_UUID}`,
      $session_entry_url: `https://preview.example/projects/${PROJECT_UUID}?tab=overview`,
      $session_entry_pathname: `/projects/${PROJECT_UUID}`,
      $referrer: "$direct",
      distinct_id: PROJECT_UUID, // identity-like — preserve
      $user_id: PROJECT_UUID,
    });

    const out = sanitizePostHogBrowserEvent(cr)!;
    expect(out.event).toBe("estimate_viewed");
    expect(out.properties.$current_url).toBe("https://preview.example/projects/$id/estimate");
    expect(out.properties.$pathname).toBe("/projects/$id/estimate");
    expect(out.properties.$prev_pageview_pathname).toBe("/projects/$id");
    expect(out.properties.$session_entry_url).toBe("https://preview.example/projects/$id");
    expect(out.properties.$session_entry_pathname).toBe("/projects/$id");
    expect(out.properties.$referrer).toBe("$direct");
    expect(out.properties.surface).toBe("builder");
    expect(out.properties.distinct_id).toBe(PROJECT_UUID);
    expect(out.properties.$user_id).toBe(PROJECT_UUID);
    for (const k of [
      "$current_url",
      "$pathname",
      "$prev_pageview_pathname",
      "$session_entry_url",
      "$session_entry_pathname",
    ]) {
      assertNoResourceIds(out.properties[k]);
    }
  });

  it("sanitizes $web_vitals URL properties when present", () => {
    const cr = event("$web_vitals", {
      $current_url: `https://preview.example/projects/${PROJECT_UUID}/estimate`,
      $pathname: `/projects/${PROJECT_UUID}/estimate`,
      $web_vitals_enabled_server_side: true,
    });
    const out = sanitizePostHogBrowserEvent(cr)!;
    expect(out.properties.$current_url).toBe("https://preview.example/projects/$id/estimate");
    expect(out.properties.$pathname).toBe("/projects/$id/estimate");
    assertNoResourceIds(out.properties.$current_url);
    assertNoResourceIds(out.properties.$pathname);
  });

  it("covers marketplace_listing_viewed, user_signed_in, and another custom event", () => {
    for (const name of ["marketplace_listing_viewed", "user_signed_in", "project_created"]) {
      const out = sanitizePostHogBrowserEvent(
        event(name, {
          $current_url: `https://preview.example/trades/${JOB_UUID}`,
          $pathname: `/trades/${JOB_UUID}`,
        }),
      )!;
      expect(out.properties.$current_url).toBe("https://preview.example/trades/$id");
      expect(out.properties.$pathname).toBe("/trades/$id");
      assertNoResourceIds(out.properties.$current_url);
    }
  });

  it("preserves $identify protocol and opaque identity IDs", () => {
    const userId = "d23b3ede-79db-486e-af22-a79f1802469d";
    const out = sanitizePostHogBrowserEvent(
      event("$identify", {
        distinct_id: userId,
        $user_id: userId,
        $anon_distinct_id: "019fe882-aa60-7f54-932b-ce1f7ac79cfa",
        $current_url: `https://preview.example/auth?code=SECRET-OAUTH-CODE`,
        $pathname: "/auth",
      }),
    )!;
    expect(out.event).toBe("$identify");
    expect(out.properties.distinct_id).toBe(userId);
    expect(out.properties.$user_id).toBe(userId);
    expect(out.properties.$anon_distinct_id).toBe("019fe882-aa60-7f54-932b-ce1f7ac79cfa");
    expect(out.properties.$current_url).toBe("https://preview.example/auth");
    expect(String(out.properties.$current_url)).not.toContain("SECRET-OAUTH-CODE");
  });

  it("sanitizes same-origin referrer path IDs; keeps external origin useful", () => {
    const sameOrigin = sanitizePostHogBrowserEvent(
      event("$pageview", {
        $referrer: `https://preview.example/projects/${PROJECT_UUID}/estimate?x=1`,
        $referring_domain: "preview.example",
      }),
    )!;
    expect(sameOrigin.properties.$referrer).toBe("https://preview.example/projects/$id/estimate");
    expect(sameOrigin.properties.$referring_domain).toBe("preview.example");

    const external = sanitizePostHogBrowserEvent(
      event("$pageview", {
        $referrer: "https://google.com/search?q=SECRET-OAUTH-CODE&email=private@example.test",
        $referring_domain: "google.com",
      }),
    )!;
    expect(external.properties.$referrer).toBe("https://google.com/search");
    expect(String(external.properties.$referrer)).not.toContain("SECRET-OAUTH-CODE");
    expect(external.properties.$referring_domain).toBe("google.com");
  });

  it("preserves already-safe manual pageview canonical properties", () => {
    const out = sanitizePostHogBrowserEvent(
      event("$pageview", {
        route_template: "/projects/$id/estimate",
        $current_url: "https://preview.example/projects/$id/estimate",
        $pathname: "/projects/$id/estimate",
      }),
    )!;
    expect(out.properties.route_template).toBe("/projects/$id/estimate");
    expect(out.properties.$current_url).toBe("https://preview.example/projects/$id/estimate");
    expect(out.properties.$pathname).toBe("/projects/$id/estimate");
  });

  it("fails closed by stripping URL props when sanitizer throws", () => {
    const cr = event("$pageview", {
      $current_url: `https://preview.example/projects/${PROJECT_UUID}`,
      $pathname: `/projects/${PROJECT_UUID}`,
      safe_flag: true,
    });
    // Poison pathname to throw inside sanitize by replacing redact path via
    // non-configurable weird value — instead exercise catch by passing a
    // Proxy properties object that throws on enumeration after first keys.
    const poison = new Proxy(
      {
        $current_url: `https://preview.example/projects/${PROJECT_UUID}`,
        $pathname: `/projects/${PROJECT_UUID}`,
        safe_flag: true,
      },
      {
        ownKeys() {
          throw new Error("forced failure");
        },
      },
    ) as unknown as CaptureResult["properties"];

    const poisoned: CaptureResult = {
      uuid: cr.uuid,
      event: "$pageview",
      properties: poison,
    };

    const out = sanitizePostHogBrowserEvent(poisoned);
    // Must not return the original unsanitized properties object.
    if (out) {
      // Either stripped or rejected path — never raw UUID in remaining URL fields.
      for (const [k, v] of Object.entries(out.properties || {})) {
        if (isPostHogUrlPathPropertyName(k)) {
          assertNoResourceIds(v);
        }
      }
    } else {
      expect(out).toBeNull();
    }
  });

  it("returns null for null input", () => {
    expect(sanitizePostHogBrowserEvent(null)).toBeNull();
  });

  it("does not scrub non-URL business properties", () => {
    const out = sanitizePostHogBrowserEvent(
      event("estimate_viewed", {
        surface: "builder",
        band: "mid",
        $browser: "Chrome",
        $os: "Mac OS X",
        $current_url: `https://preview.example/projects/${PROJECT_UUID}/estimate`,
      }),
    )!;
    expect(out.properties.surface).toBe("builder");
    expect(out.properties.band).toBe("mid");
    expect(out.properties.$browser).toBe("Chrome");
    expect(out.properties.$os).toBe("Mac OS X");
  });
});
