import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/platform/sentry/server-capture", () => ({
  captureAiError: vi.fn(),
  addDiagnosticBreadcrumb: vi.fn(),
  setConversationId: vi.fn(),
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

const hfVisionChatCompletion = vi.fn();

vi.mock("@/platform/huggingface/server", () => ({
  getHuggingFaceConfig: () => ({ defaultVisionModel: "hf-test" }),
  isHuggingFaceConfigured: () => true,
  hfVisionChatCompletion: (...args: unknown[]) => hfVisionChatCompletion(...args),
  VISION_MODELS: {},
}));

describe("HF vision signed retrieval + provenance", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sends signed retrieval URL and keeps durable photo.url as provenance", async () => {
    hfVisionChatCompletion.mockResolvedValue(
      JSON.stringify({
        room_type: "Bathroom",
        condition_level: "Dated",
        refurbishment_level: "Medium",
        visible_issues: ["Mould"],
        recommended_works: ["Re-grout"],
        ai_summary: "Dated bathroom with visible mould.",
        confidence_score: 0.7,
      }),
    );

    const { runSecurePhotoAnalysisHuggingFace } = await import("./hf-vision.adapter.server");
    const durable = "https://cdn.example/object/public/project-photos/u/p/b.jpg";
    const signed = "https://cdn.example/object/sign/project-photos/u/p/b.jpg?token=hf";
    const results = await runSecurePhotoAnalysisHuggingFace({
      projectId: "proj-1",
      photos: [
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          url: durable,
          name: "bath.jpg",
          retrievalUrl: signed,
        },
      ],
    });

    expect(hfVisionChatCompletion).toHaveBeenCalled();
    expect(JSON.stringify(hfVisionChatCompletion.mock.calls)).toContain(signed);
    expect(JSON.stringify(hfVisionChatCompletion.mock.calls)).not.toContain(durable);
    expect(results[0]?.photo_url).toBe(durable);
    expect(results[0]?.photo_url).not.toBe(signed);
  });
});
