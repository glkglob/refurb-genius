import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/platform/sentry/server-capture", () => ({
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

describe("runSecurePhotoAnalysis signed retrieval + provenance", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("sends signed retrieval URL to the provider and persists durable photo.url", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              room_type: "Kitchen",
              condition_level: "Average",
              refurbishment_level: "Medium",
              visible_issues: ["Dated units"],
              recommended_works: ["Replace units"],
              ai_summary: "Dated kitchen needing a mid-range refresh.",
              confidence_score: 0.8,
            }),
          },
        },
      ],
    });
    const { getOpenAIClient } = await import("@/platform/openai/server");
    vi.mocked(getOpenAIClient).mockReturnValue({
      chat: { completions: { create } },
    } as never);

    const { runSecurePhotoAnalysis } = await import("./ai-vision.adapter.server");
    const { assertAnalysisProvenance } = await import("../../domain");

    const durable = "https://cdn.example/object/public/project-photos/u/p/a.jpg";
    const signed = "https://cdn.example/object/sign/project-photos/u/p/a.jpg?token=ai";
    const photos = [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        url: durable,
        name: "kitchen.jpg",
        retrievalUrl: signed,
      },
    ];

    const results = await runSecurePhotoAnalysis({ projectId: "proj-1", photos });

    expect(create).toHaveBeenCalled();
    const payload = create.mock.calls[0]?.[0] as {
      messages: Array<{ content: unknown }>;
    };
    expect(JSON.stringify(payload)).toContain(signed);
    expect(JSON.stringify(payload)).not.toContain(durable);
    expect(results[0]?.photo_url).toBe(durable);
    expect(results[0]?.photo_url).not.toBe(signed);
    expect(() => assertAnalysisProvenance(photos, results)).not.toThrow();
  });
});

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
