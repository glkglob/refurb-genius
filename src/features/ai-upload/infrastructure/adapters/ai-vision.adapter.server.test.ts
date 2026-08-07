import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/sentry", () => ({
  captureAiError: vi.fn(),
  addDiagnosticBreadcrumb: vi.fn(),
  setConversationId: vi.fn(),
}));
vi.mock("@/platform/openai/server", () => ({
  getOpenAIClient: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/provider-diagnostics", () => ({
  incrementCounter: vi.fn(),
}));
vi.mock("@/lib/timeout", () => ({
  timeoutPromise: vi.fn(async (p: Promise<unknown>) => p),
  isTimeoutError: () => false,
}));
vi.mock("@/core/ai/platform/retry", () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/concurrency", () => ({
  ConcurrencyLimiter: class {
    run<T>(fn: () => Promise<T>) {
      return fn();
    }
  },
}));

describe("runSecurePhotoAnalysis empty-photo production contract", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("C: empty photos throw PHOTO_ANALYSIS_NO_SOURCE_PHOTOS and never build mock demos", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const { runSecurePhotoAnalysis } = await import("./ai-vision.adapter.server");
    const { PHOTO_ANALYSIS_NO_SOURCE_PHOTOS } = await import("../../domain");

    await expect(runSecurePhotoAnalysis({ projectId: "proj-1", photos: [] })).rejects.toMatchObject(
      { code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS },
    );
  });

  it("C: empty photos fail even in development (no FALLBACK_PHOTOS)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPENAI_API_KEY", "");

    const { runSecurePhotoAnalysis } = await import("./ai-vision.adapter.server");
    const { PHOTO_ANALYSIS_NO_SOURCE_PHOTOS } = await import("../../domain");

    await expect(runSecurePhotoAnalysis({ projectId: "proj-1", photos: [] })).rejects.toMatchObject(
      { code: PHOTO_ANALYSIS_NO_SOURCE_PHOTOS },
    );
  });
});
