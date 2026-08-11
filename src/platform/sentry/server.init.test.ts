/**
 * PH-SENTRY-1B1 — server Sentry init gate contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const init = vi.fn();
const requestDataIntegration = vi.fn((opts: unknown) => ({ name: "RequestData", opts }));

vi.mock("@sentry/node", () => ({
  init: (...args: unknown[]) => init(...args),
  requestDataIntegration: (opts: unknown) => requestDataIntegration(opts),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setConversationId: vi.fn(),
  withIsolationScope: vi.fn(async (cb: (scope: unknown) => unknown) => cb({})),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  __resetServerSentryInitForTests,
  __setServerSentryCaptureEnabledForTests,
  canServerSentryCapture,
  initServerSentry,
  isServerSentryCaptureEnabled,
  isServerSentryInitialized,
  isServerSentryProductionRuntime,
} from "@/platform/sentry/server.init";

/**
 * PH-SENTRY-1B2B — import-time initServerSentry() runs before the first test
 * (side-effect at bottom of server.init.ts). Reset bookkeeping before each
 * test so gate/init assertions are order-independent.
 */
beforeEach(() => {
  __resetServerSentryInitForTests();
  init.mockReset();
  requestDataIntegration.mockClear();
  vi.unstubAllEnvs();
});

afterEach(() => {
  __resetServerSentryInitForTests();
  init.mockReset();
  requestDataIntegration.mockClear();
  vi.unstubAllEnvs();
});

describe("isServerSentryProductionRuntime", () => {
  it("enables Vercel production", () => {
    expect(
      isServerSentryProductionRuntime({
        nodeEnv: "production",
        vercelEnv: "production",
      }),
    ).toBe(true);
  });

  it("disables Vercel preview even when NODE_ENV is production", () => {
    expect(
      isServerSentryProductionRuntime({
        nodeEnv: "production",
        vercelEnv: "preview",
      }),
    ).toBe(false);
  });

  it("disables development and test", () => {
    expect(isServerSentryProductionRuntime({ nodeEnv: "development", vercelEnv: undefined })).toBe(
      false,
    );
    expect(isServerSentryProductionRuntime({ nodeEnv: "test", vercelEnv: undefined })).toBe(false);
    expect(
      isServerSentryProductionRuntime({
        nodeEnv: "production",
        vercelEnv: "development",
      }),
    ).toBe(false);
  });

  it("enables non-Vercel NODE_ENV=production", () => {
    expect(isServerSentryProductionRuntime({ nodeEnv: "production", vercelEnv: undefined })).toBe(
      true,
    );
  });
});

describe("isServerSentryCaptureEnabled", () => {
  it("requires production runtime and non-empty DSN", () => {
    expect(
      isServerSentryCaptureEnabled({
        nodeEnv: "production",
        vercelEnv: "production",
        sentryDsn: "https://example.ingest.sentry.io/1",
      }),
    ).toBe(true);
    expect(
      isServerSentryCaptureEnabled({
        nodeEnv: "production",
        vercelEnv: "production",
        sentryDsn: "  ",
      }),
    ).toBe(false);
    expect(
      isServerSentryCaptureEnabled({
        nodeEnv: "production",
        vercelEnv: "preview",
        sentryDsn: "https://example.ingest.sentry.io/1",
      }),
    ).toBe(false);
    expect(
      isServerSentryCaptureEnabled({
        nodeEnv: "development",
        vercelEnv: undefined,
        sentryDsn: "https://example.ingest.sentry.io/1",
      }),
    ).toBe(false);
  });
});

describe("initServerSentry", () => {
  it("no-ops without DSN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_DSN", "");
    initServerSentry();
    expect(init).not.toHaveBeenCalled();
    expect(isServerSentryInitialized()).toBe(false);
  });

  it("no-ops on preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("SENTRY_DSN", "https://example.ingest.sentry.io/1");
    initServerSentry();
    expect(init).not.toHaveBeenCalled();
  });

  it("initializes with privacy config in production + DSN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_DSN", "https://example.ingest.sentry.io/1");
    initServerSentry();
    expect(init).toHaveBeenCalledTimes(1);
    const opts = init.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.dsn).toBe("https://example.ingest.sentry.io/1");
    expect(opts.sendDefaultPii).toBe(false);
    expect(opts.includeLocalVariables).toBe(false);
    expect(opts.tracesSampleRate).toBeUndefined();
    expect(opts.tracesSampler).toBeUndefined();
    expect(typeof opts.beforeSend).toBe("function");
    expect(requestDataIntegration).toHaveBeenCalledWith({
      include: {
        cookies: false,
        data: false,
        headers: false,
        ip: false,
        query_string: false,
        url: true,
      },
    });
    expect(isServerSentryInitialized()).toBe(true);
  });

  it("beforeSend fails closed on sanitizer throw", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_DSN", "https://example.ingest.sentry.io/1");
    initServerSentry();
    const opts = init.mock.calls[0]![0] as {
      beforeSend: (event: unknown) => unknown;
    };
    // Non-object causes sanitize path to return null
    expect(opts.beforeSend("not-an-event")).toBeNull();
  });

  it("is idempotent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_DSN", "https://example.ingest.sentry.io/1");
    initServerSentry();
    initServerSentry();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it("test override forces gate without init", () => {
    __setServerSentryCaptureEnabledForTests(true);
    expect(canServerSentryCapture()).toBe(true);
    __setServerSentryCaptureEnabledForTests(false);
    expect(canServerSentryCapture()).toBe(false);
  });
});
