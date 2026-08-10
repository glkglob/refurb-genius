/**
 * PH-SENTRY-1C — Sentry outbound privacy boundary (beforeSend sanitizer).
 * Synthetic data only — no production secrets or real PII.
 */
import { describe, expect, it } from "vitest";

import {
  SENTRY_REDACTED,
  sanitizeSentryEvent,
  sanitizeSentryPathname,
  sanitizeSentryUrl,
  scrubFreeformString,
  shouldRedactSentryKey,
  type SentryEventLike,
} from "./sanitize-outbound";

const PROJECT_UUID = "11111111-2222-4333-8444-555555555555";
const SYNTHETIC_EMAIL = "private@example.test";
const SYNTHETIC_BEARER = "Bearer test-secret-token";
const SYNTHETIC_PASSWORD = "fake-password";
const SYNTHETIC_QUERY = "signed-query-secret";
const SYNTHETIC_SIGNED = "SYNTHETIC-SIGNED-TOKEN";
/**
 * Runtime JWT-shaped fixture for freeform scrub tests.
 * Segments joined at runtime so no contiguous JWT literal appears in source
 * (Gitleaks / PH-SENTRY-1C-G1). Public jwt.io-style synthetic material only.
 */
const SYNTHETIC_JWT = [
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
  "dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
].join(".");

const FORBIDDEN_SUBSTRINGS = [
  SYNTHETIC_EMAIL,
  "test-secret-token",
  SYNTHETIC_PASSWORD,
  SYNTHETIC_QUERY,
  SYNTHETIC_SIGNED,
  "super-secret-api-key-value",
  "nested-secret-value",
  "12 Fake Street",
  "SW1A1AA",
] as const;

function assertNoForbidden(value: unknown) {
  const s = JSON.stringify(value);
  for (const bad of FORBIDDEN_SUBSTRINGS) {
    expect(s, `must not contain ${bad}`).not.toContain(bad);
  }
  expect(s).not.toContain(PROJECT_UUID);
  expect(s).not.toContain(SYNTHETIC_JWT);
}

function baseEvent(overrides: Partial<SentryEventLike> = {}): SentryEventLike {
  return {
    event_id: "evt-synthetic-001",
    platform: "javascript",
    level: "error",
    environment: "test",
    release: "test@0.0.0",
    ...overrides,
  };
}

describe("PH-SENTRY-1C-G1 synthetic JWT fixture shape", () => {
  it("runtime fixture is three non-empty JWT-like segments", () => {
    const parts = SYNTHETIC_JWT.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]?.length).toBeGreaterThan(0);
    expect(parts[1]?.length).toBeGreaterThan(0);
    expect(parts[2]?.length).toBeGreaterThan(0);
    expect(SYNTHETIC_JWT.split(".").length - 1).toBe(2);
  });
});

describe("shouldRedactSentryKey", () => {
  it("matches secrets case-insensitively with partials", () => {
    expect(shouldRedactSentryKey("Authorization")).toBe(true);
    expect(shouldRedactSentryKey("Cookie")).toBe(true);
    expect(shouldRedactSentryKey("access_token")).toBe(true);
    expect(shouldRedactSentryKey("password")).toBe(true);
    expect(shouldRedactSentryKey("my_password_field")).toBe(true);
    expect(shouldRedactSentryKey("x-api-key")).toBe(true);
    expect(shouldRedactSentryKey("client_secret")).toBe(true);
  });

  it("matches token as whole key or _token suffix only", () => {
    expect(shouldRedactSentryKey("token")).toBe(true);
    expect(shouldRedactSentryKey("session_token")).toBe(true);
    expect(shouldRedactSentryKey("refresh_token")).toBe(true);
    expect(shouldRedactSentryKey("mytoken")).toBe(false);
  });

  it("matches PII and business keys", () => {
    expect(shouldRedactSentryKey("email")).toBe(true);
    expect(shouldRedactSentryKey("property_address")).toBe(true);
    expect(shouldRedactSentryKey("postcode")).toBe(true);
    expect(shouldRedactSentryKey("purchase_price")).toBe(true);
    expect(shouldRedactSentryKey("filter")).toBe(true);
    expect(shouldRedactSentryKey("projectId")).toBe(true);
    expect(shouldRedactSentryKey("filename")).toBe(true);
  });

  it("does not redact safe operational keys", () => {
    expect(shouldRedactSentryKey("domain")).toBe(false);
    expect(shouldRedactSentryKey("stage")).toBe(false);
    expect(shouldRedactSentryKey("operation")).toBe(false);
    expect(shouldRedactSentryKey("fileCount")).toBe(false);
    expect(shouldRedactSentryKey("fileSizeMb")).toBe(false);
    expect(shouldRedactSentryKey("durationMs")).toBe(false);
    expect(shouldRedactSentryKey("memoryMbEstimate")).toBe(false);
    expect(shouldRedactSentryKey("table")).toBe(false);
  });
});

describe("sanitizeSentryUrl / sanitizeSentryPathname", () => {
  it("strips query and hash and redacts dynamic route IDs", () => {
    const url = `https://app.example/projects/${PROJECT_UUID}/estimate?token=${SYNTHETIC_SIGNED}&q=${SYNTHETIC_QUERY}#frag`;
    expect(sanitizeSentryUrl(url)).toBe("https://app.example/projects/$id/estimate");
    expect(sanitizeSentryPathname(`/projects/${PROJECT_UUID}?x=1#y`)).toBe("/projects/$id");
  });

  it("redacts signed media path tokens via dynamic segment rules", () => {
    const media = `https://cdn.example/media/${SYNTHETIC_SIGNED}?sig=${SYNTHETIC_QUERY}`;
    const out = sanitizeSentryUrl(media);
    expect(out).toBe("https://cdn.example/media/$id");
    expect(out).not.toContain(SYNTHETIC_SIGNED);
    expect(out).not.toContain(SYNTHETIC_QUERY);
  });
});

describe("scrubFreeformString", () => {
  it("redacts emails, bearer tokens, JWTs without blanking the whole message", () => {
    const msg = `Failed for ${SYNTHETIC_EMAIL} with ${SYNTHETIC_BEARER} jwt=${SYNTHETIC_JWT}`;
    const out = scrubFreeformString(msg);
    expect(out).toContain("Failed for");
    expect(out).toContain(SENTRY_REDACTED);
    expect(out).not.toContain(SYNTHETIC_EMAIL);
    expect(out).not.toContain("test-secret-token");
    expect(out).not.toContain(SYNTHETIC_JWT);
  });

  it("sanitizes embedded URLs", () => {
    const msg = `See https://app.example/projects/${PROJECT_UUID}?token=${SYNTHETIC_SIGNED}`;
    const out = scrubFreeformString(msg);
    expect(out).toContain("https://app.example/projects/$id");
    expect(out).not.toContain(PROJECT_UUID);
    expect(out).not.toContain(SYNTHETIC_SIGNED);
  });

  it("truncates long freeform strings at 500 chars", () => {
    // Spaces prevent LONG_TOKEN_RE from collapsing the payload before truncate.
    const long = `Error detail ${"word ".repeat(200)}`;
    const out = scrubFreeformString(long);
    expect(out.endsWith("...")).toBe(true);
    expect(out.length).toBe(503); // 500 + "..."
  });
});

describe("sanitizeSentryEvent — secrets", () => {
  it("redacts Authorization, Cookie, access_token, password, nested secret", () => {
    const input = baseEvent({
      extra: {
        Authorization: SYNTHETIC_BEARER,
        Cookie: "session=abc",
        access_token: "super-secret-api-key-value",
        password: SYNTHETIC_PASSWORD,
        nested: { client_secret: "nested-secret-value" },
      },
    });
    const out = sanitizeSentryEvent(input)!;
    expect(out.extra!.Authorization).toBe(SENTRY_REDACTED);
    expect(out.extra!.Cookie).toBe(SENTRY_REDACTED);
    expect(out.extra!.access_token).toBe(SENTRY_REDACTED);
    expect(out.extra!.password).toBe(SENTRY_REDACTED);
    expect((out.extra!.nested as Record<string, unknown>).client_secret).toBe(SENTRY_REDACTED);
    assertNoForbidden(out);
  });
});

describe("sanitizeSentryEvent — PII", () => {
  it("redacts email, property address, postcode", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        extra: {
          email: SYNTHETIC_EMAIL,
          property_address: "12 Fake Street",
          postcode: "SW1A1AA",
        },
        user: {
          id: "user-opaque-99",
          email: SYNTHETIC_EMAIL,
          username: "alice",
          name: "Alice Example",
          ip_address: "203.0.113.10",
          geo: { city: "London" },
        },
      }),
    )!;

    expect(out.extra!.email).toBe(SENTRY_REDACTED);
    expect(out.extra!.property_address).toBe(SENTRY_REDACTED);
    expect(out.extra!.postcode).toBe(SENTRY_REDACTED);
    expect(out.user).toEqual({ id: "user-opaque-99" });
    assertNoForbidden(out);
  });
});

describe("sanitizeSentryEvent — URLs", () => {
  it("strips query/hash, redacts dynamic route IDs, drops request body/headers/cookies", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        request: {
          url: `https://app.example/projects/${PROJECT_UUID}/photos?token=${SYNTHETIC_SIGNED}&sig=${SYNTHETIC_QUERY}#top`,
          method: "POST",
          headers: {
            Authorization: SYNTHETIC_BEARER,
            Cookie: "a=1",
          },
          cookies: { session: "x" },
          data: { password: SYNTHETIC_PASSWORD },
          query_string: `token=${SYNTHETIC_SIGNED}`,
        },
        transaction: `/projects/${PROJECT_UUID}/estimate`,
      }),
    )!;

    expect(out.request!.url).toBe("https://app.example/projects/$id/photos");
    expect(out.request!.method).toBe("POST");
    expect(out.request!.headers).toBeUndefined();
    expect(out.request!.cookies).toBeUndefined();
    expect(out.request!.data).toBeUndefined();
    expect(out.request!.query_string).toBeUndefined();
    expect(out.transaction).toBe("/projects/$id/estimate");
    assertNoForbidden(out);
  });
});

describe("sanitizeSentryEvent — nested structures", () => {
  it("walks extra, contexts, breadcrumb data, and arrays", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        extra: {
          items: [{ email: SYNTHETIC_EMAIL }, { ok: true }],
          deep: { level2: { password: SYNTHETIC_PASSWORD } },
        },
        contexts: {
          runtime: { name: "browser" },
          custom: { access_token: "super-secret-api-key-value" },
        },
        breadcrumbs: [
          {
            message: `load ${SYNTHETIC_EMAIL}`,
            data: {
              url: `https://app.example/p/${PROJECT_UUID}?t=${SYNTHETIC_SIGNED}`,
              href: `https://cdn.example/f?sig=${SYNTHETIC_QUERY}`,
              pathname: `/projects/${PROJECT_UUID}`,
              fileCount: 3,
            },
          },
        ],
      }),
    )!;

    const items = out.extra!.items as Array<Record<string, unknown>>;
    expect(items[0].email).toBe(SENTRY_REDACTED);
    expect(items[1].ok).toBe(true);
    expect(
      ((out.extra!.deep as Record<string, unknown>).level2 as Record<string, unknown>).password,
    ).toBe(SENTRY_REDACTED);
    expect((out.contexts!.custom as Record<string, unknown>).access_token).toBe(SENTRY_REDACTED);
    expect((out.contexts!.runtime as Record<string, unknown>).name).toBe("browser");

    const crumb = out.breadcrumbs![0];
    expect(crumb.message).not.toContain(SYNTHETIC_EMAIL);
    expect(crumb.data!.url).toBe("https://app.example/p/$id");
    expect(crumb.data!.pathname).toBe("/projects/$id");
    expect(crumb.data!.fileCount).toBe(3);
    assertNoForbidden(out);
  });
});

describe("sanitizeSentryEvent — safe preservation", () => {
  it("preserves domain tags, stage, operation, metrics, technical error message, table", () => {
    const technical = "TypeError: Cannot read properties of undefined (reading 'map')";
    const out = sanitizeSentryEvent(
      baseEvent({
        message: technical,
        tags: {
          type: "ai",
          domain: "upload",
          stage: "storage",
          operation: "insert",
        },
        extra: {
          stage: "storage",
          domain: "upload",
          operation: "insert",
          table: "photos",
          fileCount: 4,
          fileSizeMb: 12.5,
          durationMs: 900,
          memoryMbEstimate: 64,
          timestamp: "2026-01-01T00:00:00.000Z",
          provider: "test",
          reason: "timeout",
          componentStack: "at Foo",
          // identifiers still redacted even in otherwise-safe extras
          projectId: PROJECT_UUID,
          filter: "id=eq.1",
        },
        exception: {
          values: [
            {
              type: "TypeError",
              value: technical,
              stacktrace: {
                frames: [
                  {
                    filename: "app://src/features/x.ts",
                    function: "doWork",
                    lineno: 10,
                    colno: 4,
                    in_app: true,
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    expect(out.message).toBe(technical);
    expect(out.tags).toEqual({
      type: "ai",
      domain: "upload",
      stage: "storage",
      operation: "insert",
    });
    expect(out.extra!.stage).toBe("storage");
    expect(out.extra!.domain).toBe("upload");
    expect(out.extra!.operation).toBe("insert");
    expect(out.extra!.table).toBe("photos");
    expect(out.extra!.fileCount).toBe(4);
    expect(out.extra!.fileSizeMb).toBe(12.5);
    expect(out.extra!.durationMs).toBe(900);
    expect(out.extra!.memoryMbEstimate).toBe(64);
    expect(out.extra!.provider).toBe("test");
    expect(out.extra!.reason).toBe("timeout");
    expect(out.extra!.componentStack).toBe("at Foo");
    expect(out.extra!.projectId).toBe(SENTRY_REDACTED);
    expect(out.extra!.filter).toBe(SENTRY_REDACTED);

    const frame = (
      out.exception!.values![0].stacktrace as { frames: Array<Record<string, unknown>> }
    ).frames[0];
    expect(frame.filename).toBe("app://src/features/x.ts");
    expect(frame.function).toBe("doWork");
    expect(frame.lineno).toBe(10);
    expect(frame.colno).toBe(4);
    expect(out.exception!.values![0].type).toBe("TypeError");
    expect(out.level).toBe("error");
    expect(out.release).toBe("test@0.0.0");
    expect(out.environment).toBe("test");
    expect(out.event_id).toBe("evt-synthetic-001");
    expect(out.platform).toBe("javascript");
    assertNoForbidden(out);
  });
});

describe("sanitizeSentryEvent — PH-SENTRY-1C-R1 stack frames", () => {
  const AUTH_CODE = "TOP_SECRET_CODE";
  const TOKEN_HASH = "TOP_SECRET_TOKEN_HASH_VALUE";
  const SIGNED_SECRET = "SIGNED_SECRET_TOKEN_VALUE";
  const CONTEXT_EMAIL = "private-user@example.com";
  const FRAME_BEARER = "Bearer test-frame-secret-token";
  function frameFrom(out: SentryEventLike): Record<string, unknown> {
    const st = out.exception!.values![0].stacktrace as {
      frames: Array<Record<string, unknown>>;
    };
    return st.frames[0];
  }

  it("sanitizes auth callback filename query secrets (code + token_hash)", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        exception: {
          values: [
            {
              type: "Error",
              value: "callback failed",
              stacktrace: {
                frames: [
                  {
                    filename: `https://www.refurbgenius.info/auth/callback?code=${AUTH_CODE}&token_hash=${TOKEN_HASH}`,
                    function: "completeAuthCallback",
                    lineno: 42,
                    colno: 17,
                    in_app: true,
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    const frame = frameFrom(out);
    expect(frame.filename).toBe("https://www.refurbgenius.info/auth/callback");
    expect(String(frame.filename)).not.toContain(AUTH_CODE);
    expect(String(frame.filename)).not.toContain(TOKEN_HASH);
    expect(String(frame.filename)).not.toContain("?");
    expect(frame.function).toBe("completeAuthCallback");
    expect(frame.lineno).toBe(42);
    expect(frame.colno).toBe(17);
    expect(frame.in_app).toBe(true);
    assertNoForbidden(out);
    expect(JSON.stringify(out)).not.toContain(AUTH_CODE);
    expect(JSON.stringify(out)).not.toContain(TOKEN_HASH);
  });

  it("sanitizes signed abs_path query secrets", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        exception: {
          values: [
            {
              type: "Error",
              value: "storage fail",
              stacktrace: {
                frames: [
                  {
                    filename: "app://src/lib/photos-write.ts",
                    abs_path: `https://storage.example.com/object.jpg?token=${SIGNED_SECRET}&expires=9999999999`,
                    function: "uploadPhoto",
                    lineno: 10,
                    colno: 2,
                    in_app: true,
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    const frame = frameFrom(out);
    expect(frame.abs_path).toBe("https://storage.example.com/object.jpg");
    expect(String(frame.abs_path)).not.toContain(SIGNED_SECRET);
    expect(String(frame.abs_path)).not.toContain("expires=");
    expect(String(frame.abs_path)).not.toContain("?");
    expect(JSON.stringify(out)).not.toContain(SIGNED_SECRET);
  });

  it("scrubs email from context_line while retaining technical text", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        exception: {
          values: [
            {
              type: "TypeError",
              value: "boom",
              stacktrace: {
                frames: [
                  {
                    filename: "app://src/features/auth/callback.ts",
                    function: "completeAuthCallback",
                    lineno: 42,
                    colno: 17,
                    in_app: true,
                    context_line: `const email = "${CONTEXT_EMAIL}";`,
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    const frame = frameFrom(out);
    expect(String(frame.context_line)).not.toContain(CONTEXT_EMAIL);
    expect(String(frame.context_line)).toContain("const email");
    expect(String(frame.context_line)).toContain(SENTRY_REDACTED);
    expect(frame.function).toBe("completeAuthCallback");
    expect(frame.lineno).toBe(42);
    expect(frame.colno).toBe(17);
    expect(frame.in_app).toBe(true);
  });

  it("scrubs pre_context and post_context secrets while retaining array structure", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        exception: {
          values: [
            {
              type: "Error",
              value: "ctx",
              stacktrace: {
                frames: [
                  {
                    filename: "app://src/x.ts",
                    function: "run",
                    lineno: 5,
                    colno: 1,
                    in_app: true,
                    pre_context: [
                      `// auth ${FRAME_BEARER}`,
                      `const jwt = "${SYNTHETIC_JWT}";`,
                      `const email = "${CONTEXT_EMAIL}";`,
                    ],
                    post_context: [
                      `fetch("https://cdn.example/media/x?token=${SIGNED_SECRET}")`,
                      "return result;",
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    const frame = frameFrom(out);
    const pre = frame.pre_context as string[];
    const post = frame.post_context as string[];
    expect(Array.isArray(pre)).toBe(true);
    expect(Array.isArray(post)).toBe(true);
    expect(pre).toHaveLength(3);
    expect(post).toHaveLength(2);
    const json = JSON.stringify(out);
    expect(json).not.toContain("test-frame-secret-token");
    expect(json).not.toContain(SYNTHETIC_JWT);
    expect(json).not.toContain(CONTEXT_EMAIL);
    expect(json).not.toContain(SIGNED_SECRET);
    expect(pre[0]).toContain("// auth");
    expect(post[1]).toBe("return result;");
  });

  it("preserves diagnostic metadata (function/lineno/colno/in_app)", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        exception: {
          values: [
            {
              type: "Error",
              value: "meta",
              stacktrace: {
                frames: [
                  {
                    filename: `https://www.refurbgenius.info/auth/callback?code=${AUTH_CODE}`,
                    abs_path: `https://storage.example.com/o.jpg?token=${SIGNED_SECRET}`,
                    function: "completeAuthCallback",
                    module: "auth-callback",
                    lineno: 42,
                    colno: 17,
                    in_app: true,
                    platform: "javascript",
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    const frame = frameFrom(out);
    expect(frame.function).toBe("completeAuthCallback");
    expect(frame.module).toBe("auth-callback");
    expect(frame.lineno).toBe(42);
    expect(frame.colno).toBe(17);
    expect(frame.in_app).toBe(true);
    expect(frame.platform).toBe("javascript");
    // still sanitized locations
    expect(frame.filename).toBe("https://www.refurbgenius.info/auth/callback");
    expect(frame.abs_path).toBe("https://storage.example.com/o.jpg");
  });

  it("whole-event negative scan including frames has no synthetic secrets", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        message: `Error for ${SYNTHETIC_EMAIL}`,
        request: {
          url: `https://www.refurbgenius.info/auth/callback?code=${AUTH_CODE}`,
          method: "GET",
          headers: { Authorization: SYNTHETIC_BEARER },
          cookies: { session: "x" },
          data: { password: SYNTHETIC_PASSWORD },
          query_string: `code=${AUTH_CODE}`,
        },
        extra: {
          email: SYNTHETIC_EMAIL,
          password: SYNTHETIC_PASSWORD,
          access_token: "super-secret-api-key-value",
          property_address: "12 Fake Street",
        },
        breadcrumbs: [
          {
            message: "auth:sign_in:attempt",
            data: { email: SYNTHETIC_EMAIL },
          },
        ],
        exception: {
          values: [
            {
              type: "Error",
              value: `Failed with ${SYNTHETIC_BEARER}`,
              stacktrace: {
                frames: [
                  {
                    filename: `https://www.refurbgenius.info/auth/callback?code=${AUTH_CODE}&token_hash=${TOKEN_HASH}`,
                    abs_path: `https://storage.example.com/object.jpg?token=${SIGNED_SECRET}&sig=${SYNTHETIC_QUERY}`,
                    function: "completeAuthCallback",
                    lineno: 42,
                    colno: 17,
                    in_app: true,
                    context_line: `const email = "${CONTEXT_EMAIL}";`,
                    pre_context: [`// ${FRAME_BEARER}`],
                    post_context: [`fetch("https://cdn.example/media/x?token=${SIGNED_SECRET}")`],
                    vars: { password: SYNTHETIC_PASSWORD, email: SYNTHETIC_EMAIL },
                  },
                ],
              },
            },
          ],
        },
      }),
    )!;

    expect(out).not.toBeNull();
    const json = JSON.stringify(out);
    for (const bad of [
      SYNTHETIC_EMAIL,
      "test-secret-token",
      SYNTHETIC_PASSWORD,
      SYNTHETIC_QUERY,
      SYNTHETIC_SIGNED,
      AUTH_CODE,
      TOKEN_HASH,
      SIGNED_SECRET,
      CONTEXT_EMAIL,
      "test-frame-secret-token",
      "super-secret-api-key-value",
      "12 Fake Street",
    ]) {
      expect(json, `must not contain ${bad}`).not.toContain(bad);
    }

    const frame = frameFrom(out);
    expect(frame.function).toBe("completeAuthCallback");
    expect(frame.lineno).toBe(42);
    expect(frame.colno).toBe(17);
    expect(frame.in_app).toBe(true);
    expect(frame.filename).toBe("https://www.refurbgenius.info/auth/callback");
    expect(frame.abs_path).toBe("https://storage.example.com/object.jpg");
    expect(out.request!.headers).toBeUndefined();
    expect(out.extra!.email).toBe(SENTRY_REDACTED);
  });
});

describe("sanitizeSentryEvent — fail-closed & immutability", () => {
  it("returns null on throwing getter / poison (never original)", () => {
    const poison: SentryEventLike = baseEvent();
    Object.defineProperty(poison, "extra", {
      enumerable: true,
      get() {
        throw new Error("poison");
      },
    });

    const out = sanitizeSentryEvent(poison);
    expect(out).toBeNull();
    expect(out).not.toBe(poison);
  });

  it("returns null for null/undefined input", () => {
    expect(sanitizeSentryEvent(null)).toBeNull();
    expect(sanitizeSentryEvent(undefined)).toBeNull();
  });

  it("does not mutate the input fixture", () => {
    const input = baseEvent({
      extra: {
        password: SYNTHETIC_PASSWORD,
        email: SYNTHETIC_EMAIL,
        nested: { access_token: "super-secret-api-key-value" },
      },
      request: {
        url: `https://app.example/projects/${PROJECT_UUID}?token=${SYNTHETIC_SIGNED}`,
        headers: { Authorization: SYNTHETIC_BEARER },
        data: { body: true },
      },
      user: { id: "u1", email: SYNTHETIC_EMAIL },
    });
    const snapshot = JSON.parse(JSON.stringify(input));

    const out = sanitizeSentryEvent(input)!;
    expect(JSON.stringify(input)).toBe(JSON.stringify(snapshot));
    expect(out).not.toBe(input);
    expect(out.extra).not.toBe(input.extra);
    expect(input.extra!.password).toBe(SYNTHETIC_PASSWORD);
    expect(input.request!.headers).toEqual({ Authorization: SYNTHETIC_BEARER });
    assertNoForbidden(out);
  });

  it("handles circular references without throwing", () => {
    const extra: Record<string, unknown> = { stage: "storage" };
    extra.self = extra;
    const out = sanitizeSentryEvent(baseEvent({ extra }))!;
    expect(out.extra!.stage).toBe("storage");
    expect(out.extra!.self).toBe("[Circular]");
  });

  it("redacts at max depth", () => {
    // depth: extra(0)->a(1)->b(2)->c(3)->d(4)->e(5)->f(6) => f becomes redacted
    const deep = {
      a: { b: { c: { d: { e: { f: { secretLeaf: "x" } } } } } },
    };
    const out = sanitizeSentryEvent(baseEvent({ extra: deep }))!;
    const a = out.extra!.a as Record<string, unknown>;
    const b = a.b as Record<string, unknown>;
    const c = b.c as Record<string, unknown>;
    const d = c.d as Record<string, unknown>;
    const e = d.e as Record<string, unknown>;
    // At depth 6 the object under e is replaced
    expect(e.f).toBe(SENTRY_REDACTED);
  });
});

describe("sanitizeSentryEvent — negative JSON.stringify scan", () => {
  it("output JSON never contains synthetic secrets", () => {
    const out = sanitizeSentryEvent(
      baseEvent({
        message: `Error for ${SYNTHETIC_EMAIL} ${SYNTHETIC_BEARER}`,
        extra: {
          password: SYNTHETIC_PASSWORD,
          Authorization: SYNTHETIC_BEARER,
          access_token: "super-secret-api-key-value",
          email: SYNTHETIC_EMAIL,
          property_address: "12 Fake Street",
          postcode: "SW1A1AA",
          listing_url: `https://list.example/x?t=${SYNTHETIC_SIGNED}`,
          nested: { client_secret: "nested-secret-value" },
        },
        request: {
          url: `https://app.example/projects/${PROJECT_UUID}?sig=${SYNTHETIC_QUERY}&token=${SYNTHETIC_SIGNED}`,
          headers: { Authorization: SYNTHETIC_BEARER, Cookie: "x=1" },
          cookies: { a: "b" },
          data: { password: SYNTHETIC_PASSWORD },
          query_string: SYNTHETIC_QUERY,
        },
        user: {
          id: "keep-me",
          email: SYNTHETIC_EMAIL,
          username: "bob",
          name: "Bob",
          ip_address: "198.51.100.1",
        },
        breadcrumbs: [
          {
            message: `auth ${SYNTHETIC_BEARER}`,
            data: {
              url: `https://cdn.example/media/${PROJECT_UUID}?token=${SYNTHETIC_SIGNED}`,
            },
          },
        ],
      }),
    )!;

    expect(out).not.toBeNull();
    expect(out.user).toEqual({ id: "keep-me" });
    assertNoForbidden(out);
    const json = JSON.stringify(out);
    expect(json).not.toContain("private@example.test");
    expect(json).not.toContain("Bearer test-secret-token");
    expect(json).not.toContain("fake-password");
    expect(json).not.toContain("signed-query-secret");
    expect(json).not.toContain("SYNTHETIC-SIGNED-TOKEN");
  });
});
