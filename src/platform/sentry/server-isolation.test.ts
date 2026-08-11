/**
 * PH-SENTRY-1B2B — concurrent request isolation using real @sentry/node ACS.
 *
 * Uses installed SDK (no withIsolationScope mock). Transport is local-only
 * (no network). Proves overlapping isolation scopes do not cross-bleed tags.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import * as Sentry from "@sentry/node";

import {
  __resetServerSentryInitForTests,
  __setServerSentryCaptureEnabledForTests,
  initServerSentry,
  isServerSentryInitialized,
} from "@/platform/sentry/server.init";
import {
  captureServerException,
  withServerSentryIsolation,
} from "@/platform/sentry/server-capture";

type Captured = {
  message?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

const captured: Captured[] = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installCollector(): void {
  Sentry.addEventProcessor((event) => {
    const tags = event.tags as Record<string, string> | undefined;
    captured.push({
      message: event.exception?.values?.[0]?.value ?? event.message,
      tags: tags ? { ...tags } : undefined,
      extra: event.extra ? { ...(event.extra as Record<string, unknown>) } : undefined,
    });
    // Drop — no network
    return null;
  });
}

beforeEach(() => {
  captured.length = 0;
  __resetServerSentryInitForTests();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  // Synthetic non-secret DSN shape — transport never used for network (events dropped)
  vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
  initServerSentry();
  __setServerSentryCaptureEnabledForTests(true);
  expect(isServerSentryInitialized()).toBe(true);
  installCollector();
});

afterEach(async () => {
  __resetServerSentryInitForTests();
  __setServerSentryCaptureEnabledForTests(null);
  vi.unstubAllEnvs();
  try {
    await Sentry.close(0);
  } catch {
    // ignore
  }
});

describe("withServerSentryIsolation concurrent ACS", () => {
  it("does not cross-bleed isolation tags across overlapping requests (repeated)", async () => {
    for (let iter = 0; iter < 5; iter++) {
      captured.length = 0;

      await Promise.all([
        withServerSentryIsolation(async () => {
          Sentry.getIsolationScope().setTag("iso_marker", "A");
          Sentry.getIsolationScope().setExtra("iso_extra", "extra-A");
          await delay(40);
          captureServerException(new Error(`err-A-${iter}`), { source: "probe-a" });
          await Sentry.flush(2000);
        }),
        withServerSentryIsolation(async () => {
          Sentry.getIsolationScope().setTag("iso_marker", "B");
          Sentry.getIsolationScope().setExtra("iso_extra", "extra-B");
          await delay(10);
          captureServerException(new Error(`err-B-${iter}`), { source: "probe-b" });
          await Sentry.flush(2000);
        }),
      ]);

      // Wait for processors
      await Sentry.flush(2000);
      await delay(20);

      const aEvents = captured.filter((e) => e.message?.includes(`err-A-${iter}`));
      const bEvents = captured.filter((e) => e.message?.includes(`err-B-${iter}`));

      expect(aEvents.length, `iter ${iter}: A events`).toBeGreaterThanOrEqual(1);
      expect(bEvents.length, `iter ${iter}: B events`).toBeGreaterThanOrEqual(1);

      for (const e of aEvents) {
        expect(e.tags?.iso_marker, `iter ${iter}: A must not see B`).toBe("A");
        expect(e.extra?.iso_extra).toBe("extra-A");
        expect(e.tags?.iso_marker).not.toBe("B");
      }
      for (const e of bEvents) {
        expect(e.tags?.iso_marker, `iter ${iter}: B must not see A`).toBe("B");
        expect(e.extra?.iso_extra).toBe("extra-B");
        expect(e.tags?.iso_marker).not.toBe("A");
      }
    }
  });

  it("isolates throw path from overlapping success path", async () => {
    captured.length = 0;

    const results = await Promise.allSettled([
      withServerSentryIsolation(async () => {
        Sentry.getIsolationScope().setTag("iso_marker", "SUCCESS");
        await delay(30);
        captureServerException(new Error("err-success-path"), { source: "probe-success" });
        await Sentry.flush(2000);
        return "ok";
      }),
      withServerSentryIsolation(async () => {
        Sentry.getIsolationScope().setTag("iso_marker", "THROW");
        await delay(5);
        captureServerException(new Error("err-throw-path"), { source: "probe-throw" });
        await Sentry.flush(2000);
        throw new Error("request-fail");
      }),
    ]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");

    await Sentry.flush(2000);
    await delay(20);

    const successEv = captured.filter((e) => e.message?.includes("err-success-path"));
    const throwEv = captured.filter((e) => e.message?.includes("err-throw-path"));

    expect(successEv.length).toBeGreaterThanOrEqual(1);
    expect(throwEv.length).toBeGreaterThanOrEqual(1);

    for (const e of successEv) {
      expect(e.tags?.iso_marker).toBe("SUCCESS");
    }
    for (const e of throwEv) {
      expect(e.tags?.iso_marker).toBe("THROW");
    }
  });
});
