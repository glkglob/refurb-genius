// @vitest-environment node
/**
 * PH-SENTRY-1B2B / 1B3A — concurrent request isolation using real @sentry/node ACS.
 *
 * Uses installed SDK (no withIsolationScope mock). Transport is local-only
 * (no network). Proves overlapping isolation scopes do not cross-bleed tags.
 *
 * PH-SENTRY-1B3A adds stream-lifetime coverage: Response may return from
 * withServerSentryIsolation before the body is consumed; async ReadableStream
 * work must retain its isolation markers across overlapping requests.
 *
 * PH-SENTRY-1B3A-R1: must run under Vitest Node (not repository default jsdom)
 * so @sentry/node ACS / AsyncLocalStorage isolation is the real production path.
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

/** Deterministic barrier (preferred over sleep-only coordination). */
function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

function assertMarkerOnly(events: Captured[], marker: string, label: string): void {
  expect(events.length, `${label}: expected events`).toBeGreaterThanOrEqual(1);
  for (const e of events) {
    expect(e.tags?.iso_marker, `${label}: marker`).toBe(marker);
    expect(e.extra?.iso_extra, `${label}: extra`).toBe(`extra-${marker}`);
    expect(e.tags?.iso_marker).not.toBe(marker === "A" ? "B" : "A");
  }
}

beforeEach(() => {
  // PH-SENTRY-1B3A-R1 — fail hard if this suite is not under Vitest Node
  expect(typeof window).toBe("undefined");
  expect(process.release.name).toBe("node");

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

/**
 * PH-SENTRY-1B3A — stream-lifetime isolation.
 *
 * Models production: withServerSentryIsolation returns a Response while the
 * ReadableStream body is still unconsumed. Async stream work must keep the
 * request's isolation markers when a second request overlaps.
 *
 * Synchronization uses deferred barriers (not sleep-only).
 */
describe("withServerSentryIsolation stream lifetime ACS", () => {
  it("retains A markers for post-return stream work while B overlaps (A captures then B; ×10)", async () => {
    for (let iter = 0; iter < 10; iter++) {
      captured.length = 0;

      const aIsolationReturned = createDeferred<void>();
      const bActive = createDeferred<void>();
      const aStreamCaptured = createDeferred<void>();
      const bDone = createDeferred<void>();

      let bodyReadStarted = false;

      const aResponsePromise = withServerSentryIsolation(async () => {
        Sentry.getIsolationScope().setTag("iso_marker", "A");
        Sentry.getIsolationScope().setExtra("iso_extra", "extra-A");

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            // start is scheduled from inside A's isolation scope; work resumes after
            // the isolation callback has returned and B is active.
            await aIsolationReturned.promise;
            await bActive.promise;

            captureServerException(new Error(`err-stream-A-${iter}`), {
              source: "probe-stream-a",
            });
            await Sentry.flush(2000);
            aStreamCaptured.resolve();

            controller.enqueue(new TextEncoder().encode(`a-${iter}`));
            controller.close();
          },
        });

        // Return Response without consuming body — isolation ends after this return.
        return new Response(stream, {
          headers: { "content-type": "text/plain" },
        });
      });

      const aResponse = await aResponsePromise;
      // HARD GATE: isolation callback settled; body not yet read.
      aIsolationReturned.resolve();
      expect(aResponse, `iter ${iter}: Response returned`).toBeInstanceOf(Response);
      expect(bodyReadStarted, `iter ${iter}: body must not be consumed yet`).toBe(false);
      expect(aResponse.bodyUsed, `iter ${iter}: bodyUsed before consumption`).toBe(false);

      await withServerSentryIsolation(async () => {
        Sentry.getIsolationScope().setTag("iso_marker", "B");
        Sentry.getIsolationScope().setExtra("iso_extra", "extra-B");
        bActive.resolve();

        // A stream work runs while B isolation is still active.
        await aStreamCaptured.promise;

        captureServerException(new Error(`err-stream-B-${iter}`), {
          source: "probe-stream-b",
        });
        await Sentry.flush(2000);
        bDone.resolve();
      });

      await bDone.promise;
      await Sentry.flush(2000);

      // Consume body only after both captures — proves post-return stream path.
      bodyReadStarted = true;
      const text = await aResponse.text();
      expect(text).toBe(`a-${iter}`);
      expect(aResponse.bodyUsed).toBe(true);

      const aEvents = captured.filter((e) => e.message?.includes(`err-stream-A-${iter}`));
      const bEvents = captured.filter((e) => e.message?.includes(`err-stream-B-${iter}`));

      assertMarkerOnly(aEvents, "A", `iter ${iter}: A stream`);
      assertMarkerOnly(bEvents, "B", `iter ${iter}: B`);
    }
  });

  it("retains isolation when B captures first then A stream resumes (reverse timing; ×10)", async () => {
    for (let iter = 0; iter < 10; iter++) {
      captured.length = 0;

      const aIsolationReturned = createDeferred<void>();
      const bEntered = createDeferred<void>();
      const bCaptured = createDeferred<void>();
      const aStreamDone = createDeferred<void>();

      let bodyReadStarted = false;

      const aResponsePromise = withServerSentryIsolation(async () => {
        Sentry.getIsolationScope().setTag("iso_marker", "A");
        Sentry.getIsolationScope().setExtra("iso_extra", "extra-A");

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            await aIsolationReturned.promise;
            await bEntered.promise;
            // Reverse: wait until B has already captured, then A captures.
            await bCaptured.promise;

            captureServerException(new Error(`err-stream-rev-A-${iter}`), {
              source: "probe-stream-rev-a",
            });
            await Sentry.flush(2000);
            aStreamDone.resolve();

            controller.enqueue(new TextEncoder().encode(`rev-a-${iter}`));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { "content-type": "text/plain" },
        });
      });

      const aResponse = await aResponsePromise;
      aIsolationReturned.resolve();
      expect(aResponse).toBeInstanceOf(Response);
      expect(bodyReadStarted).toBe(false);
      expect(aResponse.bodyUsed).toBe(false);

      await withServerSentryIsolation(async () => {
        Sentry.getIsolationScope().setTag("iso_marker", "B");
        Sentry.getIsolationScope().setExtra("iso_extra", "extra-B");
        bEntered.resolve();

        captureServerException(new Error(`err-stream-rev-B-${iter}`), {
          source: "probe-stream-rev-b",
        });
        await Sentry.flush(2000);
        bCaptured.resolve();

        // Stay inside B until A stream has captured (true overlap).
        await aStreamDone.promise;
      });

      await aStreamDone.promise;
      await Sentry.flush(2000);

      bodyReadStarted = true;
      await aResponse.text();

      const aEvents = captured.filter((e) => e.message?.includes(`err-stream-rev-A-${iter}`));
      const bEvents = captured.filter((e) => e.message?.includes(`err-stream-rev-B-${iter}`));

      assertMarkerOnly(aEvents, "A", `iter ${iter}: reverse A stream`);
      assertMarkerOnly(bEvents, "B", `iter ${iter}: reverse B`);
    }
  });

  it("post-stream request C does not inherit A/B markers after stream work ends", async () => {
    captured.length = 0;

    const aIsolationReturned = createDeferred<void>();
    const streamDone = createDeferred<void>();

    const aResponse = await withServerSentryIsolation(async () => {
      Sentry.getIsolationScope().setTag("iso_marker", "A");
      Sentry.getIsolationScope().setExtra("iso_extra", "extra-A");

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          await aIsolationReturned.promise;
          captureServerException(new Error("err-stream-cleanup-A"), {
            source: "probe-stream-cleanup-a",
          });
          await Sentry.flush(2000);
          controller.enqueue(new TextEncoder().encode("done"));
          controller.close();
          streamDone.resolve();
        },
      });

      return new Response(stream);
    });

    aIsolationReturned.resolve();
    expect(aResponse.bodyUsed).toBe(false);

    // Overlapping B while A stream still pending.
    await withServerSentryIsolation(async () => {
      Sentry.getIsolationScope().setTag("iso_marker", "B");
      Sentry.getIsolationScope().setExtra("iso_extra", "extra-B");
      await streamDone.promise;
      captureServerException(new Error("err-stream-cleanup-B"), {
        source: "probe-stream-cleanup-b",
      });
      await Sentry.flush(2000);
    });

    await streamDone.promise;
    await aResponse.text();
    await Sentry.flush(2000);

    // Fresh request C after A/B stream lifecycle complete.
    await withServerSentryIsolation(async () => {
      Sentry.getIsolationScope().setTag("iso_marker", "C");
      Sentry.getIsolationScope().setExtra("iso_extra", "extra-C");
      captureServerException(new Error("err-stream-cleanup-C"), {
        source: "probe-stream-cleanup-c",
      });
      await Sentry.flush(2000);
    });

    await Sentry.flush(2000);

    const aEvents = captured.filter((e) => e.message?.includes("err-stream-cleanup-A"));
    const bEvents = captured.filter((e) => e.message?.includes("err-stream-cleanup-B"));
    const cEvents = captured.filter((e) => e.message?.includes("err-stream-cleanup-C"));

    assertMarkerOnly(aEvents, "A", "cleanup A");
    assertMarkerOnly(bEvents, "B", "cleanup B");
    expect(cEvents.length).toBeGreaterThanOrEqual(1);
    for (const e of cEvents) {
      expect(e.tags?.iso_marker).toBe("C");
      expect(e.extra?.iso_extra).toBe("extra-C");
      expect(e.tags?.iso_marker).not.toBe("A");
      expect(e.tags?.iso_marker).not.toBe("B");
    }
  });

  it("stream start rejection does not leak markers into a later request", async () => {
    captured.length = 0;

    const aIsolationReturned = createDeferred<void>();
    const streamSettled = createDeferred<void>();

    const aResponse = await withServerSentryIsolation(async () => {
      Sentry.getIsolationScope().setTag("iso_marker", "A");
      Sentry.getIsolationScope().setExtra("iso_extra", "extra-A");

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          await aIsolationReturned.promise;
          try {
            captureServerException(new Error("err-stream-throw-A"), {
              source: "probe-stream-throw-a",
            });
            await Sentry.flush(2000);
            controller.error(new Error("stream-fail"));
          } finally {
            streamSettled.resolve();
          }
        },
      });

      return new Response(stream);
    });

    aIsolationReturned.resolve();
    expect(aResponse.bodyUsed).toBe(false);

    await streamSettled.promise;
    // Consume path may reject; isolation of later request is what matters.
    try {
      await aResponse.text();
    } catch {
      // expected stream error path
    }
    await Sentry.flush(2000);

    await withServerSentryIsolation(async () => {
      Sentry.getIsolationScope().setTag("iso_marker", "C");
      Sentry.getIsolationScope().setExtra("iso_extra", "extra-C");
      captureServerException(new Error("err-stream-throw-C"), {
        source: "probe-stream-throw-c",
      });
      await Sentry.flush(2000);
    });

    await Sentry.flush(2000);

    const aEvents = captured.filter((e) => e.message?.includes("err-stream-throw-A"));
    const cEvents = captured.filter((e) => e.message?.includes("err-stream-throw-C"));

    assertMarkerOnly(aEvents, "A", "throw-path A");
    expect(cEvents.length).toBeGreaterThanOrEqual(1);
    for (const e of cEvents) {
      expect(e.tags?.iso_marker).toBe("C");
      expect(e.extra?.iso_extra).toBe("extra-C");
      expect(e.tags?.iso_marker).not.toBe("A");
    }
  });
});
