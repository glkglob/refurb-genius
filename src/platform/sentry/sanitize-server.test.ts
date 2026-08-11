/**
 * PH-SENTRY-1B1 — server Sentry outbound privacy sanitizer.
 */
import { describe, expect, it } from "vitest";

import { SENTRY_REDACTED, sanitizeServerSentryEvent } from "@/platform/sentry/sanitize-server";

describe("sanitizeServerSentryEvent", () => {
  it("drops non-object input", () => {
    expect(sanitizeServerSentryEvent(null)).toBeNull();
    expect(sanitizeServerSentryEvent(undefined)).toBeNull();
    expect(sanitizeServerSentryEvent("x")).toBeNull();
  });

  it("strips Authorization and Cookie from request headers", () => {
    const out = sanitizeServerSentryEvent({
      request: {
        url: "https://www.refurbgenius.info/projects/11111111-1111-4111-8111-111111111111?token=secret",
        method: "POST",
        headers: {
          Authorization: "Bearer PH_SERVER_SYNTHETIC_TOKEN",
          Cookie: "session=PH_SERVER_SYNTHETIC_SESSION",
          "content-type": "application/json",
        },
        cookies: { session: "PH_SERVER_SYNTHETIC_SESSION" },
        data: { address: "1 Fake Street", purchase_price: 250000 },
        query_string: "code=PH_SERVER_SYNTHETIC_OAUTH",
      },
    });

    expect(out).not.toBeNull();
    expect(out!.request?.headers).toBeUndefined();
    expect(out!.request?.cookies).toBeUndefined();
    expect(out!.request?.data).toBeUndefined();
    expect(out!.request?.query_string).toBeUndefined();
    expect(out!.request?.method).toBe("POST");
    // Dynamic UUID → $id; query stripped
    expect(out!.request?.url).toBe("https://www.refurbgenius.info/projects/$id");
    expect(JSON.stringify(out)).not.toContain("PH_SERVER_SYNTHETIC_TOKEN");
    expect(JSON.stringify(out)).not.toContain("PH_SERVER_SYNTHETIC_SESSION");
    expect(JSON.stringify(out)).not.toContain("1 Fake Street");
  });

  it("redacts nested provider cause content (prompt / response / auth marker)", () => {
    const out = sanitizeServerSentryEvent({
      exception: {
        values: [
          {
            type: "Error",
            value: "provider failed",
            // Nested shapes land in mechanism / extra in real SDK; model via extra
          },
        ],
      },
      extra: {
        cause: {
          prompt: "PH_SERVER_SYNTHETIC_PROMPT",
          messages: [{ role: "user", content: "PH_SERVER_SYNTHETIC_PROMPT" }],
          response_body: "PH_SERVER_SYNTHETIC_RESPONSE",
          headers: {
            Authorization: "Bearer PH_SERVER_SYNTHETIC_TOKEN",
          },
        },
      },
    });

    expect(out).not.toBeNull();
    const json = JSON.stringify(out);
    expect(json).not.toContain("PH_SERVER_SYNTHETIC_PROMPT");
    expect(json).not.toContain("PH_SERVER_SYNTHETIC_RESPONSE");
    expect(json).not.toContain("PH_SERVER_SYNTHETIC_TOKEN");
    expect(out!.extra?.cause).toBeDefined();
    const cause = out!.extra!.cause as Record<string, unknown>;
    expect(cause.prompt).toBe(SENTRY_REDACTED);
    expect(cause.messages).toBe(SENTRY_REDACTED);
    expect(cause.response_body).toBe(SENTRY_REDACTED);
    expect(cause.headers).toBe(SENTRY_REDACTED);
  });

  it("redacts serverFn-shaped financial / address keys in extra", () => {
    const out = sanitizeServerSentryEvent({
      extra: {
        address: "10 Acacia Avenue",
        postcode: "SW1A 1AA",
        purchase_price: 450000,
        purchasePrice: 450000,
        provider: "gpt-4o",
        reason: "api_error",
      },
    });

    expect(out).not.toBeNull();
    expect(out!.extra!.address).toBe(SENTRY_REDACTED);
    expect(out!.extra!.postcode).toBe(SENTRY_REDACTED);
    expect(out!.extra!.purchase_price).toBe(SENTRY_REDACTED);
    expect(out!.extra!.purchasePrice).toBe(SENTRY_REDACTED);
    expect(out!.extra!.provider).toBe("gpt-4o");
    expect(out!.extra!.reason).toBe("api_error");
  });

  it("keeps opaque user id only", () => {
    const out = sanitizeServerSentryEvent({
      user: {
        id: "user-uuid-opaque",
        email: "user@example.com",
        ip_address: "203.0.113.1",
        username: "alice",
      },
    });

    expect(out!.user).toEqual({ id: "user-uuid-opaque" });
  });

  it("scrubs Bearer tokens in freeform exception values", () => {
    const out = sanitizeServerSentryEvent({
      exception: {
        values: [
          {
            type: "Error",
            value: "Upstream failed: Authorization: Bearer PH_SERVER_SYNTHETIC_TOKEN",
          },
        ],
      },
    });

    expect(out!.exception!.values![0]!.value).toContain(SENTRY_REDACTED);
    expect(JSON.stringify(out)).not.toContain("PH_SERVER_SYNTHETIC_TOKEN");
  });

  it("fail-closed: never returns the original event reference", () => {
    const original = {
      request: {
        url: "https://example.com/ok",
        headers: { Authorization: "Bearer X" },
      },
      message: "test",
    };
    const out = sanitizeServerSentryEvent(original);
    expect(out).not.toBe(original);
    expect(out!.request?.headers).toBeUndefined();
    expect(original.request.headers.Authorization).toBe("Bearer X");
  });
});
