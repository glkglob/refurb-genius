/**
 * PH-SENTRY-1E1 — Sentry tracing / span privacy boundary tests.
 */
import { describe, expect, it } from "vitest";

import { SENTRY_REDACTED } from "@/platform/sentry/sanitize-outbound";

import {
  buildSafeFallbackSpan,
  sanitizeSentrySpan,
  sanitizeSentryTransaction,
  sanitizeSpanAttributes,
  sanitizeSpanDescription,
  type SentrySpanJsonLike,
  type SentryTransactionEventLike,
} from "./sanitize-tracing";

const PROJECT_UUID = "11111111-1111-4111-8111-111111111111";
const SYNTH_CODE = "PH_TRACE_SYNTHETIC_CODE";
const SYNTH_TOKEN_HASH = "PH_TRACE_SYNTHETIC_HASH";
const SYNTH_SIGNED = "PH_TRACE_SYNTHETIC_SIGNED_TOKEN";
const SYNTH_POSTCODE = "W14";

function baseSpan(
  overrides: Partial<SentrySpanJsonLike> & {
    data?: Record<string, string | number | boolean | undefined>;
  } = {},
): SentrySpanJsonLike {
  const { data: dataOverride, ...rest } = overrides;
  return {
    span_id: "aaaaaaaaaaaaaaaa",
    trace_id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    start_timestamp: 1_700_000_000,
    timestamp: 1_700_000_001,
    op: "http.client",
    ...rest,
    data: { ...(dataOverride ?? {}) },
  };
}

function baseTxn(overrides: Partial<SentryTransactionEventLike> = {}): SentryTransactionEventLike {
  return {
    type: "transaction",
    transaction: "/dashboard",
    start_timestamp: 1_700_000_000,
    timestamp: 1_700_000_002,
    ...overrides,
  };
}

describe("sanitizeSpanDescription", () => {
  it("redacts UUID in METHOD + URL and strips query/hash", () => {
    const input = `GET https://example.test/projects/${PROJECT_UUID}?token=${SYNTH_SIGNED}#frag`;
    const out = sanitizeSpanDescription(input);
    expect(out).toBe("GET https://example.test/projects/$id");
    expect(out).not.toContain(PROJECT_UUID);
    expect(out).not.toContain(SYNTH_SIGNED);
    expect(out).not.toContain("frag");
  });

  it("redacts path-only transaction-like descriptions", () => {
    expect(sanitizeSpanDescription(`/projects/${PROJECT_UUID}/estimate`)).toBe(
      "/projects/$id/estimate",
    );
  });

  it("preserves non-URL technical descriptions via freeform scrub only", () => {
    expect(sanitizeSpanDescription("Main UI thread blocked")).toBe("Main UI thread blocked");
  });
});

describe("sanitizeSpanAttributes — GAP-03", () => {
  it("sanitizes http.url / url and omits http.query / http.fragment", () => {
    const raw = {
      "http.url": `https://storage.example.test/object/project/${PROJECT_UUID}/photo.jpg?token=${SYNTH_SIGNED}`,
      url: `https://storage.example.test/object/project/${PROJECT_UUID}/photo.jpg?token=${SYNTH_SIGNED}`,
      "http.query": `?token=${SYNTH_SIGNED}`,
      "http.fragment": "#access_token=HASH",
      "http.method": "GET",
      "server.address": "storage.example.test",
      type: "fetch",
    };
    const out = sanitizeSpanAttributes(raw);
    expect(out["http.url"]).toBe("https://storage.example.test/object/project/$id/photo.jpg");
    expect(out.url).toBe("https://storage.example.test/object/project/$id/photo.jpg");
    expect(out).not.toHaveProperty("http.query");
    expect(out).not.toHaveProperty("http.fragment");
    expect(JSON.stringify(out)).not.toContain(SYNTH_SIGNED);
    expect(JSON.stringify(out)).not.toContain(PROJECT_UUID);
    expect(out["http.method"]).toBe("GET");
    expect(out["server.address"]).toBe("storage.example.test");
  });

  it("omits url.query and url.fragment equivalents", () => {
    const out = sanitizeSpanAttributes({
      "url.query": "?x=1",
      "url.fragment": "#y",
      "url.full": `https://www.refurbgenius.info/projects/${PROJECT_UUID}?postcode=${SYNTH_POSTCODE}`,
    });
    expect(out).not.toHaveProperty("url.query");
    expect(out).not.toHaveProperty("url.fragment");
    expect(out["url.full"]).toBe("https://www.refurbgenius.info/projects/$id");
    expect(JSON.stringify(out)).not.toContain(SYNTH_POSTCODE);
  });

  it("sanitizes lcp.url when present", () => {
    const out = sanitizeSpanAttributes({
      "lcp.url": `https://cdn.example.test/img/${PROJECT_UUID}.jpg?token=${SYNTH_SIGNED}`,
    });
    expect(out["lcp.url"]).toBe("https://cdn.example.test/img/$id.jpg");
    expect(JSON.stringify(out)).not.toContain(SYNTH_SIGNED);
  });

  it("does not invent body/payload fields", () => {
    const out = sanitizeSpanAttributes({ "http.method": "POST" });
    expect(out).not.toHaveProperty("body");
    expect(out).not.toHaveProperty("request_body");
    expect(out).not.toHaveProperty("http.request.body");
    expect(out).not.toHaveProperty("prompt");
  });
});

describe("sanitizeSentrySpan", () => {
  it("signed storage span: token and UUID absent; safe host/path retained", () => {
    const input = baseSpan({
      description: `GET https://storage.example.test/object/project/${PROJECT_UUID}/photo.jpg?token=${SYNTH_SIGNED}`,
      data: {
        "http.url": `https://storage.example.test/object/project/${PROJECT_UUID}/photo.jpg?token=${SYNTH_SIGNED}`,
        url: `https://storage.example.test/object/project/${PROJECT_UUID}/photo.jpg?token=${SYNTH_SIGNED}`,
        "http.query": `?token=${SYNTH_SIGNED}`,
        "http.fragment": "",
        "http.method": "GET",
        "server.address": "storage.example.test",
      },
    });
    const originalDesc = input.description;
    const originalQuery = input.data["http.query"];

    const out = sanitizeSentrySpan(input);
    const blob = JSON.stringify(out);

    expect(out).not.toBe(input);
    expect(out.data).not.toBe(input.data);
    expect(input.description).toBe(originalDesc);
    expect(input.data["http.query"]).toBe(originalQuery);

    expect(blob).not.toContain(SYNTH_SIGNED);
    expect(blob).not.toContain(PROJECT_UUID);
    expect(out.data).not.toHaveProperty("http.query");
    expect(out.data).not.toHaveProperty("http.fragment");
    expect(out.description).toBe("GET https://storage.example.test/object/project/$id/photo.jpg");
    expect(out.data["http.url"]).toBe("https://storage.example.test/object/project/$id/photo.jpg");
    expect(out.span_id).toBe(input.span_id);
    expect(out.trace_id).toBe(input.trace_id);
  });

  it("does not mutate input on sanitization", () => {
    const input = baseSpan({
      description: `/projects/${PROJECT_UUID}`,
      data: {
        "http.url": `https://x.test/a?token=${SYNTH_SIGNED}`,
        "http.query": `?token=${SYNTH_SIGNED}`,
      },
    });
    const snapshot = structuredClone(input);
    sanitizeSentrySpan(input);
    expect(input).toEqual(snapshot);
  });

  it("malformed input returns safe fallback, not raw privacy data", () => {
    const poison = {
      span_id: "abc",
      // missing trace_id / start_timestamp
      description: `https://evil.test?token=${SYNTH_SIGNED}`,
      data: { "http.query": `?token=${SYNTH_SIGNED}` },
    };
    const out = sanitizeSentrySpan(poison);
    expect(out.span_id).toBe("abc");
    expect(out.data).toEqual({});
    expect(out.description).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain(SYNTH_SIGNED);
  });

  it("null/undefined returns safe fallback", () => {
    const out = sanitizeSentrySpan(null);
    expect(out.span_id).toBe("0000000000000000");
    expect(out.trace_id).toBe("00000000000000000000000000000000");
    expect(out.data).toEqual({});
  });

  it("buildSafeFallbackSpan never copies description or data", () => {
    const out = buildSafeFallbackSpan({
      span_id: "cafebabe00000001",
      trace_id: "deadbeefdeadbeefdeadbeefdeadbeef",
      start_timestamp: 42,
      description: `secret?token=${SYNTH_SIGNED}`,
      data: { "http.query": SYNTH_SIGNED },
      op: "http.client",
    });
    expect(out.description).toBeUndefined();
    expect(out.data).toEqual({});
    expect(out.op).toBe("http.client");
    expect(JSON.stringify(out)).not.toContain(SYNTH_SIGNED);
  });
});

describe("sanitizeSentryTransaction — GAP-01 / GAP-02", () => {
  it("redacts dynamic UUID in transaction name", () => {
    const input = baseTxn({
      transaction: `/projects/${PROJECT_UUID}/estimate`,
    });
    const out = sanitizeSentryTransaction(input)!;
    expect(out.transaction).toBe("/projects/$id/estimate");
    expect(out.transaction).not.toContain(PROJECT_UUID);
  });

  it("strips query and hash from request.url; omits query_string and headers", () => {
    const input = baseTxn({
      transaction: `/projects/${PROJECT_UUID}/analysis`,
      request: {
        url: `https://www.refurbgenius.info/projects/${PROJECT_UUID}/analysis?postcode=${SYNTH_POSTCODE}&token=${SYNTH_SIGNED}#access_token=HASH`,
        method: "GET",
        headers: {
          Referer: `https://www.refurbgenius.info/auth/callback?code=${SYNTH_CODE}`,
          Authorization: "Bearer secret",
          Cookie: "session=abc",
        },
        query_string: `postcode=${SYNTH_POSTCODE}&token=${SYNTH_SIGNED}`,
        data: { body: "should-not-emit" },
      },
    });
    const originalUrl = input.request!.url;
    const out = sanitizeSentryTransaction(input)!;
    const blob = JSON.stringify(out);

    expect(out).not.toBe(input);
    expect(input.request!.url).toBe(originalUrl);

    expect(out.request?.url).toBe("https://www.refurbgenius.info/projects/$id/analysis");
    expect(out.request).not.toHaveProperty("headers");
    expect(out.request).not.toHaveProperty("query_string");
    expect(out.request).not.toHaveProperty("data");
    expect(out.request?.method).toBe("GET");

    expect(blob).not.toContain(SYNTH_POSTCODE);
    expect(blob).not.toContain(SYNTH_SIGNED);
    expect(blob).not.toContain(SYNTH_CODE);
    expect(blob).not.toContain(PROJECT_UUID);
    expect(blob).not.toContain("access_token");
    expect(blob).not.toContain("Bearer secret");
    expect(blob).not.toContain("session=abc");
  });

  it("sanitizes nested spans (defence-in-depth)", () => {
    const input = baseTxn({
      transaction: `/projects/${PROJECT_UUID}/estimate`,
      spans: [
        baseSpan({
          description: `GET https://storage.example.test/o?token=${SYNTH_SIGNED}`,
          data: {
            "http.url": `https://storage.example.test/o?token=${SYNTH_SIGNED}`,
            "http.query": `?token=${SYNTH_SIGNED}`,
          },
        }),
      ],
    });
    const out = sanitizeSentryTransaction(input)!;
    const blob = JSON.stringify(out);
    expect(blob).not.toContain(SYNTH_SIGNED);
    expect(blob).not.toContain(PROJECT_UUID);
    expect(out.spans?.[0]?.data).not.toHaveProperty("http.query");
  });

  it("preserves transaction_info.source (baggage semantics)", () => {
    const input = baseTxn({
      transaction: `/projects/${PROJECT_UUID}/estimate`,
      transaction_info: { source: "url" },
    });
    const out = sanitizeSentryTransaction(input)!;
    expect(out.transaction_info?.source).toBe("url");
    expect(out.transaction).toBe("/projects/$id/estimate");
  });

  it("does not mutate input", () => {
    const input = baseTxn({
      transaction: `/projects/${PROJECT_UUID}/estimate`,
      request: {
        url: `https://www.refurbgenius.info/projects/${PROJECT_UUID}?token=${SYNTH_SIGNED}`,
      },
    });
    const snapshot = structuredClone(input);
    sanitizeSentryTransaction(input);
    expect(input).toEqual(snapshot);
  });

  it("failure returns null, never original", () => {
    // Force throw via poison: defineProperty that throws on read during sanitize
    const poison = baseTxn({ transaction: "/ok" });
    Object.defineProperty(poison, "transaction", {
      get() {
        throw new Error("boom");
      },
      enumerable: true,
      configurable: true,
    });
    const out = sanitizeSentryTransaction(poison);
    expect(out).toBeNull();
  });

  it("non-object / wrong type returns null", () => {
    expect(sanitizeSentryTransaction(null)).toBeNull();
    expect(sanitizeSentryTransaction(undefined)).toBeNull();
    expect(sanitizeSentryTransaction("txn")).toBeNull();
    expect(sanitizeSentryTransaction({ type: "replay_event", transaction: "/x" })).toBeNull();
  });

  it("does not copy extra/user/breadcrumbs onto tracing payload", () => {
    const input = baseTxn({
      transaction: "/dashboard",
      extra: { prompt: "secret-prompt", address: "1 High St" },
      user: { email: "user@example.com", id: "u1" },
      breadcrumbs: [{ message: "crumb", data: { email: "a@b.com" } }],
    });
    const out = sanitizeSentryTransaction(input)!;
    expect(out.extra).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("secret-prompt");
    expect(JSON.stringify(out)).not.toContain("user@example.com");
  });
});

describe("auth synthetic markers — no reintroduction", () => {
  it("PKCE code absent from transaction request after sanitize", () => {
    const input = baseTxn({
      transaction: "/auth/callback",
      request: {
        url: `https://www.refurbgenius.info/auth/callback?code=${SYNTH_CODE}&type=email`,
      },
    });
    const out = sanitizeSentryTransaction(input)!;
    expect(JSON.stringify(out)).not.toContain(SYNTH_CODE);
    expect(out.request?.url).toBe("https://www.refurbgenius.info/auth/callback");
  });

  it("token_hash absent from transaction request after sanitize", () => {
    const input = baseTxn({
      transaction: "/auth/callback",
      request: {
        url: `https://www.refurbgenius.info/auth/callback?token_hash=${SYNTH_TOKEN_HASH}&type=email`,
      },
    });
    const out = sanitizeSentryTransaction(input)!;
    expect(JSON.stringify(out)).not.toContain(SYNTH_TOKEN_HASH);
  });

  it("hash token removed from outbound transaction copy only", () => {
    const input = baseTxn({
      transaction: "/auth/callback",
      request: {
        url: `https://www.refurbgenius.info/auth/callback#access_token=${SYNTH_SIGNED}&type=email`,
      },
    });
    const out = sanitizeSentryTransaction(input)!;
    expect(JSON.stringify(out)).not.toContain(SYNTH_SIGNED);
    expect(JSON.stringify(out)).not.toContain("access_token");
    expect(out.request?.url).toBe("https://www.refurbgenius.info/auth/callback");
  });

  it("auth markers absent from span attributes", () => {
    const out = sanitizeSentrySpan(
      baseSpan({
        data: {
          "http.url": `https://www.refurbgenius.info/auth/callback?code=${SYNTH_CODE}`,
          "http.query": `?code=${SYNTH_CODE}&token_hash=${SYNTH_TOKEN_HASH}`,
        },
      }),
    );
    const blob = JSON.stringify(out);
    expect(blob).not.toContain(SYNTH_CODE);
    expect(blob).not.toContain(SYNTH_TOKEN_HASH);
    expect(out.data).not.toHaveProperty("http.query");
  });
});

describe("body non-capture regression", () => {
  it("sanitizer does not create body or application payload fields", () => {
    const out = sanitizeSentryTransaction(
      baseTxn({
        transaction: "/dashboard",
        spans: [baseSpan({ data: { "http.method": "POST" } })],
      }),
    )!;
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/"body"/);
    expect(blob).not.toContain("prompt");
    expect(blob).not.toContain("purchase_price");
    expect(out.spans?.[0]?.data).not.toHaveProperty("http.request.body");
  });
});

// Silence unused constant if tree-shaken checks complain about SENTRY_REDACTED import usage
void SENTRY_REDACTED;
