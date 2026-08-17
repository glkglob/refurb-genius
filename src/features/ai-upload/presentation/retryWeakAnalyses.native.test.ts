import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "retryWeakAnalyses.ts"),
  "utf8",
);

const { isNativePlatform, generatePhotoAnalysisNative } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  generatePhotoAnalysisNative: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/http/mobile-photo-analysis-generate", () => ({
  generatePhotoAnalysisNative: (...args: unknown[]) => generatePhotoAnalysisNative(...args),
}));

vi.mock("../application", () => ({
  makeRetryWeakAnalyses: () => async () => [{ id: "web" }],
}));

vi.mock("../infrastructure/repositories/room-analysis.repository", () => ({
  supabaseRoomAnalysisRepository: {},
}));

vi.mock("../infrastructure/repositories/photo-catalog.repository", () => ({
  browserPhotoCatalogRepository: {},
}));

vi.mock("./serverFns", () => ({
  runPhotoAnalysisServerFn: vi.fn(),
}));

import { retryWeakPhotoAnalyses } from "./retryWeakAnalyses";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

describe("retryWeakPhotoAnalyses native transport", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    generatePhotoAnalysisNative.mockReset();
  });

  it("web does not call the mobile endpoint", async () => {
    const out = await retryWeakPhotoAnalyses({ projectId: PROJECT });
    expect(generatePhotoAnalysisNative).not.toHaveBeenCalled();
    expect(out).toEqual([{ id: "web" }]);
  });

  it("native uses the same Bearer analysis authority with retry-weak", async () => {
    isNativePlatform.mockReturnValue(true);
    generatePhotoAnalysisNative.mockResolvedValue([{ id: "n1", photo_id: "p1" }]);
    const out = await retryWeakPhotoAnalyses({ projectId: PROJECT });
    expect(generatePhotoAnalysisNative).toHaveBeenCalledWith({
      projectId: PROJECT,
      mode: "retry-weak",
    });
    expect(out).toEqual([{ id: "n1", photo_id: "p1" }]);
  });
});

describe("retryWeakPhotoAnalyses source containment", () => {
  it("native path dynamically imports the mobile helper", () => {
    expect(SRC).toMatch(
      /import\(\s*["']@\/platform\/http\/mobile-photo-analysis-generate["']\s*\)/,
    );
    expect(SRC).toMatch(/retry-weak/);
    expect(SRC).not.toMatch(/OPENAI_API_KEY/);
  });
});
