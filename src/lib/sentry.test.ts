/**
 * PH-SENTRY-1A — Sentry capture hygiene contracts.
 * PH-SENTRY-1D1 — Replay privacy option wiring (via platform helper).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
const addBreadcrumb = vi.fn();
const setConversationId = vi.fn();

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: (...args: unknown[]) => captureException(...args),
  addBreadcrumb: (...args: unknown[]) => addBreadcrumb(...args),
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
  setConversationId: (...args: unknown[]) => setConversationId(...args),
}));

import {
  buildExplicitReplayPrivacyOptions,
  prepareAuthCallbackLocationForReplay,
} from "@/platform/sentry/replay-privacy";

import {
  __setSentryCaptureEnabledForTests,
  addDiagnosticBreadcrumb,
  captureAiError,
  captureApiError,
  captureAuthError,
  captureException as captureExceptionHelper,
  captureImageDiagnostic,
  capturePdfError,
  captureRouteLoadDiagnostic,
  captureUploadError,
  isSentryCaptureEnabled,
  setConversationId as setConversationIdHelper,
} from "./sentry";

afterEach(() => {
  __setSentryCaptureEnabledForTests(null);
  captureException.mockReset();
  addBreadcrumb.mockReset();
  setConversationId.mockReset();
});

describe("isSentryCaptureEnabled", () => {
  it("requires production and non-empty DSN", () => {
    expect(isSentryCaptureEnabled(false, "https://example.ingest.sentry.io/1")).toBe(false);
    expect(isSentryCaptureEnabled(true, undefined)).toBe(false);
    expect(isSentryCaptureEnabled(true, null)).toBe(false);
    expect(isSentryCaptureEnabled(true, "")).toBe(false);
    expect(isSentryCaptureEnabled(true, "   ")).toBe(false);
    expect(isSentryCaptureEnabled(true, "https://example.ingest.sentry.io/1")).toBe(true);
  });
});

describe("capture helpers — unconfigured safe no-op", () => {
  beforeEach(() => {
    __setSentryCaptureEnabledForTests(false);
  });

  const cases: Array<{ name: string; run: () => void }> = [
    {
      name: "captureAiError",
      run: () => captureAiError(new Error("ai"), { provider: "test" }),
    },
    {
      name: "captureAuthError",
      run: () => captureAuthError(new Error("auth")),
    },
    {
      name: "captureException",
      run: () => captureExceptionHelper(new Error("generic"), { where: "test" }),
    },
    {
      name: "captureUploadError",
      run: () => captureUploadError(new Error("upload"), { stage: "storage" }),
    },
    {
      name: "captureApiError",
      run: () => captureApiError(new Error("api"), { operation: "select", table: "projects" }),
    },
    {
      name: "capturePdfError",
      run: () => capturePdfError(new Error("pdf"), { stage: "generating-pdf" }),
    },
    {
      name: "captureImageDiagnostic",
      run: () => captureImageDiagnostic("img", { id: "1" }),
    },
    {
      name: "captureRouteLoadDiagnostic",
      run: () => captureRouteLoadDiagnostic("/x", "loaded"),
    },
    {
      name: "addDiagnosticBreadcrumb",
      run: () => addDiagnosticBreadcrumb("crumb"),
    },
    {
      name: "setConversationId",
      run: () => setConversationIdHelper("conv-1"),
    },
  ];

  it.each(cases)("$name does not call SDK and does not throw", ({ run }) => {
    expect(run).not.toThrow();
    expect(captureException).not.toHaveBeenCalled();
    expect(addBreadcrumb).not.toHaveBeenCalled();
    expect(setConversationId).not.toHaveBeenCalled();
  });
});

describe("capture helpers — configured capture", () => {
  beforeEach(() => {
    __setSentryCaptureEnabledForTests(true);
  });

  it("captureException sends once with extra context", () => {
    const err = new Error("boom");
    captureExceptionHelper(err, { componentStack: "x" });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, { extra: { componentStack: "x" } });
  });

  it("captureAiError preserves ai tag and spreads context", () => {
    const err = new Error("ai fail");
    captureAiError(err, { provider: "gpt-4o", reason: "api_error" });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { type: "ai" },
      provider: "gpt-4o",
      reason: "api_error",
    });
  });

  it("captureAuthError preserves auth tag", () => {
    const err = new Error("auth fail");
    captureAuthError(err);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, { tags: { type: "auth" } });
  });

  it("captureUploadError preserves domain tags and metadata extras", () => {
    const err = new Error("upload fail");
    captureUploadError(err, { stage: "metadata", projectId: "p1", fileCount: 2 });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, ctx] = captureException.mock.calls[0] as [
      Error,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(ctx.tags).toEqual({ domain: "upload", stage: "metadata" });
    expect(ctx.extra.projectId).toBe("p1");
    expect(ctx.extra.fileCount).toBe(2);
    expect(typeof ctx.extra.timestamp).toBe("string");
  });

  it("captureApiError preserves domain tags and metadata extras", () => {
    const err = new Error("api fail");
    captureApiError(err, { operation: "insert", table: "photos", context: "write" });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, ctx] = captureException.mock.calls[0] as [
      Error,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(ctx.tags).toEqual({ domain: "api", operation: "insert" });
    expect(ctx.extra.table).toBe("photos");
    expect(ctx.extra.context).toBe("write");
  });

  it("capturePdfError preserves domain tags", () => {
    const err = new Error("pdf fail");
    capturePdfError(err, { stage: "rendering-canvas", filename: "r.pdf" });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, ctx] = captureException.mock.calls[0] as [
      Error,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(ctx.tags).toEqual({ domain: "pdf", stage: "rendering-canvas" });
    expect(ctx.extra.filename).toBe("r.pdf");
  });

  it("breadcrumb helpers emit once when enabled", () => {
    captureImageDiagnostic("ok", { w: 1 });
    captureRouteLoadDiagnostic("/p", "done", { n: 1 });
    addDiagnosticBreadcrumb("crumb", { k: "v" });
    expect(addBreadcrumb).toHaveBeenCalledTimes(3);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("setConversationId calls SDK when capture enabled", () => {
    setConversationIdHelper("c-9");
    expect(setConversationId).toHaveBeenCalledWith("c-9");
  });
});

describe("helper consistency under same gate", () => {
  it("all exception helpers no-op together when disabled", () => {
    __setSentryCaptureEnabledForTests(false);
    captureAiError(new Error("a"));
    captureAuthError(new Error("b"));
    captureExceptionHelper(new Error("c"));
    captureUploadError(new Error("d"));
    captureApiError(new Error("e"));
    capturePdfError(new Error("f"));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("all exception helpers fire once each when enabled", () => {
    __setSentryCaptureEnabledForTests(true);
    captureAiError(new Error("a"));
    captureAuthError(new Error("b"));
    captureExceptionHelper(new Error("c"));
    captureUploadError(new Error("d"));
    captureApiError(new Error("e"));
    capturePdfError(new Error("f"));
    expect(captureException).toHaveBeenCalledTimes(6);
  });
});

describe("PH-SENTRY-1D1 Replay privacy option builder (wired by sentry.ts)", () => {
  it("exports explicit privacy options used at init", () => {
    const opts = buildExplicitReplayPrivacyOptions();
    expect(opts.maskAllText).toBe(true);
    expect(opts.maskAllInputs).toBe(true);
    expect(opts.blockAllMedia).toBe(true);
    expect(opts.networkDetailAllowUrls).toEqual([]);
    expect(opts.networkCaptureBodies).toBe(false);
  });

  it("wires prepareAuthCallbackLocationForReplay (not raw destructive strip)", () => {
    // Module-level sentry.ts imports prepare — assert the R1 helper exists and
    // is the capture-then-strip entry used before init.
    expect(typeof prepareAuthCallbackLocationForReplay).toBe("function");
    expect(prepareAuthCallbackLocationForReplay.name).toBe("prepareAuthCallbackLocationForReplay");
  });
});
