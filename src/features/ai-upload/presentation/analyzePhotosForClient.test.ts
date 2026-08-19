import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "@/platform/http/errors";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "analyzePhotosForClient.ts"),
  "utf8",
);

const { isNativePlatform, runPhotoAnalysisNative, runPhotoAnalysisServerFn } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  runPhotoAnalysisNative: vi.fn(),
  runPhotoAnalysisServerFn: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/http/mobile-analysis-run", () => ({
  runPhotoAnalysisNative: (...args: unknown[]) => runPhotoAnalysisNative(...args),
}));

vi.mock("./serverFns", () => ({
  runPhotoAnalysisServerFn: (...args: unknown[]) => runPhotoAnalysisServerFn(...args),
}));

import { analyzePhotosForClient } from "./analyzePhotosForClient";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function analysis(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    photo_id: PHOTO,
    photo_url: "https://cdn.example/p.jpg",
    photo_name: "p.jpg",
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: [],
    recommended_works: [],
    ai_summary: "ok",
    confidence_score: 0.8,
    source: "ai",
    ...overrides,
  };
}

describe("analyzePhotosForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    runPhotoAnalysisNative.mockReset();
    runPhotoAnalysisServerFn.mockReset();
  });

  it("web uses cookie runPhotoAnalysisServerFn and does not call the mobile endpoint", async () => {
    const rows = [analysis()];
    runPhotoAnalysisServerFn.mockResolvedValue(rows);

    const out = await analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] });

    expect(runPhotoAnalysisServerFn).toHaveBeenCalledWith({
      data: { projectId: PROJECT, photoIds: [PHOTO] },
    });
    expect(runPhotoAnalysisNative).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
  });

  it("web throws when the serverFn resolves a non-array", async () => {
    runPhotoAnalysisServerFn.mockResolvedValue(new Response("<html></html>"));
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /not a complete RoomAnalysis list/,
    );
  });

  it("native uses Bearer analysis helper and never calls createServerFn", async () => {
    isNativePlatform.mockReturnValue(true);
    const rows = [analysis({ id: "n1" })];
    runPhotoAnalysisNative.mockResolvedValue(rows);

    const out = await analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] });

    expect(runPhotoAnalysisNative).toHaveBeenCalledWith({ projectId: PROJECT, photoIds: [PHOTO] });
    expect(runPhotoAnalysisServerFn).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
  });

  it("native rejects a wrapped { data } payload", async () => {
    isNativePlatform.mockReturnValue(true);
    runPhotoAnalysisNative.mockResolvedValue({ data: [analysis()] });
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /not a complete RoomAnalysis list/,
    );
  });

  it("native rejects mock results before persistence", async () => {
    isNativePlatform.mockReturnValue(true);
    runPhotoAnalysisNative.mockResolvedValue([analysis({ source: "mock" })]);
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /Mock analysis/,
    );
  });

  it("rejects invalid enums, confidence range, and missing durable photo_id", async () => {
    runPhotoAnalysisServerFn.mockResolvedValueOnce([analysis({ room_type: "Spaceship" })]);
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /not a complete RoomAnalysis list/,
    );

    runPhotoAnalysisServerFn.mockResolvedValueOnce([analysis({ confidence_score: 1.4 })]);
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /not a complete RoomAnalysis list/,
    );

    runPhotoAnalysisServerFn.mockResolvedValueOnce([analysis({ photo_id: null })]);
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /not a complete RoomAnalysis list/,
    );
  });

  it("native rejects retrievalUrl / credential fields", async () => {
    isNativePlatform.mockReturnValue(true);
    runPhotoAnalysisNative.mockResolvedValue([
      analysis({ retrievalUrl: "https://signed.example/x?token=abc" }),
    ]);
    await expect(analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] })).rejects.toThrow(
      /not a complete RoomAnalysis list/,
    );
  });

  it("propagates native 401 and 429", async () => {
    isNativePlatform.mockReturnValue(true);
    runPhotoAnalysisNative.mockRejectedValueOnce(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(
      analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] }),
    ).rejects.toMatchObject({
      status: 401,
    });

    runPhotoAnalysisNative.mockRejectedValueOnce(
      new NativeHttpError("Rate limit exceeded. Try again shortly.", {
        code: "http_error",
        status: 429,
      }),
    );
    await expect(
      analyzePhotosForClient({ projectId: PROJECT, photoIds: [PHOTO] }),
    ).rejects.toMatchObject({
      status: 429,
      message: expect.stringMatching(/Rate limit exceeded/),
    });
  });
});

describe("analyzePhotosForClient source containment", () => {
  it("dynamically imports the mobile helper and never statically imports serverFns", () => {
    expect(SRC).toMatch(/import\(\s*["']@\/platform\/http\/mobile-analysis-run["']\s*\)/);
    expect(SRC).toMatch(/import\(\s*["']\.\/serverFns["']\s*\)/);
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']\.\/serverFns["']/);
    expect(SRC).not.toMatch(/\bcreateServerFn\b/);
    expect(SRC).not.toMatch(/OPENAI_API_KEY/);
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']@\/platform\/supabase\/native["']/);
  });
});
