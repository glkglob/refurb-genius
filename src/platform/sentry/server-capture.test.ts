/**
 * PH-SENTRY-1B1 — server capture helper contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const captureException = vi.fn();
const addBreadcrumb = vi.fn();
const setConversationId = vi.fn();
const init = vi.fn();
const withIsolationScope = vi.fn(async (cb: (scope: unknown) => unknown) => cb({}));

vi.mock("@sentry/node", () => ({
  init: (...args: unknown[]) => init(...args),
  requestDataIntegration: vi.fn(() => ({ name: "RequestData" })),
  captureException: (...args: unknown[]) => captureException(...args),
  addBreadcrumb: (...args: unknown[]) => addBreadcrumb(...args),
  setConversationId: (...args: unknown[]) => setConversationId(...args),
  withIsolationScope: (...args: unknown[]) =>
    (withIsolationScope as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  __resetServerSentryInitForTests,
  __setServerSentryCaptureEnabledForTests,
  initServerSentry,
  isServerSentryInitialized,
} from "@/platform/sentry/server.init";
import {
  addDiagnosticBreadcrumb,
  captureAiError,
  captureServerException,
  setConversationId as setConversationIdHelper,
  withServerSentryIsolation,
} from "@/platform/sentry/server-capture";

function enableProdCapture(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SENTRY_DSN", "https://example.ingest.sentry.io/1");
  __resetServerSentryInitForTests();
  initServerSentry();
  __setServerSentryCaptureEnabledForTests(true);
}

beforeEach(() => {
  __resetServerSentryInitForTests();
  captureException.mockReset();
  addBreadcrumb.mockReset();
  setConversationId.mockReset();
  init.mockReset();
  withIsolationScope.mockClear();
  vi.unstubAllEnvs();
});

afterEach(() => {
  __resetServerSentryInitForTests();
  captureException.mockReset();
  addBreadcrumb.mockReset();
  setConversationId.mockReset();
  init.mockReset();
  withIsolationScope.mockClear();
  vi.unstubAllEnvs();
});

describe("server capture gate", () => {
  it("no-ops when capture disabled", () => {
    __setServerSentryCaptureEnabledForTests(false);
    captureServerException(new Error("x"), { source: "server-fetch" });
    captureAiError(new Error("ai"), { provider: "test" });
    addDiagnosticBreadcrumb("crumb");
    setConversationIdHelper("c-1");
    expect(captureException).not.toHaveBeenCalled();
    expect(addBreadcrumb).not.toHaveBeenCalled();
    expect(setConversationId).not.toHaveBeenCalled();
  });
});

describe("captureServerException", () => {
  it("tags source and rejects secret-shaped metadata keys", () => {
    enableProdCapture();

    captureServerException(new Error("boom"), {
      source: "ssr-catastrophic",
      authorization: "Bearer SECRET",
      prompt: "should-not-attach",
      ok: true,
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [, ctx] = captureException.mock.calls[0]! as [
      Error,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(ctx.tags).toEqual({ domain: "server", source: "ssr-catastrophic" });
    expect(ctx.extra.source).toBe("ssr-catastrophic");
    expect(ctx.extra.ok).toBe(true);
    expect(ctx.extra.authorization).toBeUndefined();
    expect(ctx.extra.prompt).toBeUndefined();
  });
});

describe("captureAiError", () => {
  it("tags type ai and provider/reason", () => {
    enableProdCapture();

    captureAiError(new Error("ai fail"), {
      provider: "gpt-4o",
      reason: "api_error",
      prompt: "PH_SERVER_SYNTHETIC_PROMPT",
      photoName: "kitchen.jpg",
    });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [, ctx] = captureException.mock.calls[0]! as [
      Error,
      { tags: Record<string, string>; extra?: Record<string, unknown> },
    ];
    expect(ctx.tags.type).toBe("ai");
    expect(ctx.tags.provider).toBe("gpt-4o");
    expect(ctx.tags.reason).toBe("api_error");
    expect(ctx.extra?.prompt).toBeUndefined();
    expect(ctx.extra?.photoName).toBe("kitchen.jpg");
  });
});

describe("setConversationId", () => {
  it("rejects email-shaped ids and accepts opaque project ids", () => {
    enableProdCapture();

    setConversationIdHelper("user@example.com");
    expect(setConversationId).not.toHaveBeenCalled();

    setConversationIdHelper("project-11111111-1111-4111-8111-111111111111");
    expect(setConversationId).toHaveBeenCalledWith("project-11111111-1111-4111-8111-111111111111");
  });
});

describe("withServerSentryIsolation", () => {
  it("runs operation directly when capture is disabled", async () => {
    __setServerSentryCaptureEnabledForTests(false);
    const result = await withServerSentryIsolation(async () => "ok-disabled");
    expect(result).toBe("ok-disabled");
    expect(withIsolationScope).not.toHaveBeenCalled();
  });

  it("wraps with withIsolationScope when capture is enabled and init succeeded", async () => {
    enableProdCapture();
    const result = await withServerSentryIsolation(async () => "ok-enabled");
    expect(result).toBe("ok-enabled");
    expect(withIsolationScope).toHaveBeenCalledTimes(1);
  });

  it("runs operation when init fails (never rejects for observability)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_DSN", "https://example.ingest.sentry.io/1");
    __resetServerSentryInitForTests();
    init.mockImplementationOnce(() => {
      throw new Error("init boom");
    });
    initServerSentry();
    __setServerSentryCaptureEnabledForTests(true);
    expect(isServerSentryInitialized()).toBe(false);

    const result = await withServerSentryIsolation(async () => "ok-after-init-fail");
    expect(result).toBe("ok-after-init-fail");
    expect(withIsolationScope).not.toHaveBeenCalled();
  });

  it("propagates operation throw without trapping it as Sentry failure", async () => {
    enableProdCapture();
    await expect(
      withServerSentryIsolation(async () => {
        throw new Error("request boom");
      }),
    ).rejects.toThrow("request boom");
    expect(withIsolationScope).toHaveBeenCalledTimes(1);
  });
});
