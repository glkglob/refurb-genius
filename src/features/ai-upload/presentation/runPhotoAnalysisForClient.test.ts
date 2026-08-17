import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "@/platform/http/errors";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "runPhotoAnalysisForClient.ts"),
  "utf8",
);

const { isNativePlatform, generatePhotoAnalysisNative, providerRun } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  generatePhotoAnalysisNative: vi.fn(),
  providerRun: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/http/mobile-photo-analysis-generate", () => ({
  generatePhotoAnalysisNative: (...args: unknown[]) => generatePhotoAnalysisNative(...args),
}));

vi.mock("./photo-analysis.provider", () => ({
  serverPhotoAnalysisProvider: {
    run: (...args: unknown[]) => providerRun(...args),
  },
}));

import { runPhotoAnalysisForClient } from "./runPhotoAnalysisForClient";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

describe("runPhotoAnalysisForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    generatePhotoAnalysisNative.mockReset();
    providerRun.mockReset();
  });

  it("web uses the existing provider ServerFn path and not the mobile endpoint", async () => {
    const rows = [{ id: "a1", photo_id: "p1" }];
    providerRun.mockResolvedValue(rows);

    const out = await runPhotoAnalysisForClient({ projectId: PROJECT });

    expect(providerRun).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(generatePhotoAnalysisNative).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
  });

  it("native uses Bearer generate helper and not the cookie ServerFn path", async () => {
    isNativePlatform.mockReturnValue(true);
    const rows = [{ id: "n1", photo_id: "p1", source: "ai" }];
    generatePhotoAnalysisNative.mockResolvedValue(rows);

    const out = await runPhotoAnalysisForClient({ projectId: PROJECT });

    expect(generatePhotoAnalysisNative).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(providerRun).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
  });

  it("native rejects a non-array generate payload", async () => {
    isNativePlatform.mockReturnValue(true);
    generatePhotoAnalysisNative.mockResolvedValue({ data: [] });
    await expect(runPhotoAnalysisForClient({ projectId: PROJECT })).rejects.toThrow(/not an array/);
  });

  it("propagates native 401", async () => {
    isNativePlatform.mockReturnValue(true);
    generatePhotoAnalysisNative.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(runPhotoAnalysisForClient({ projectId: PROJECT })).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("runPhotoAnalysisForClient source containment", () => {
  it("dynamically imports the mobile generate helper and never OpenAI/service_role", () => {
    expect(SRC).toMatch(
      /import\(\s*["']@\/platform\/http\/mobile-photo-analysis-generate["']\s*\)/,
    );
    expect(SRC).not.toMatch(/OPENAI_API_KEY/);
    expect(SRC).not.toMatch(/SERVICE_ROLE/);
    expect(SRC).not.toMatch(/runPhotoAnalysisServerFn/);
    expect(SRC).not.toMatch(/ai-vision\.adapter\.server/);
  });
});
