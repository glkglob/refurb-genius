import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "./errors";

const nativeAuthenticatedJson = vi.fn();

vi.mock("./native-authenticated-fetch", () => ({
  nativeAuthenticatedJson: (...args: unknown[]) => nativeAuthenticatedJson(...args),
}));

import {
  generatePhotoAnalysisNative,
  MOBILE_ANALYSIS_GENERATE_PATH,
} from "./mobile-photo-analysis-generate";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

describe("generatePhotoAnalysisNative", () => {
  beforeEach(() => {
    nativeAuthenticatedJson.mockReset();
  });

  it("POSTs only projectId to the production mobile generate path", async () => {
    nativeAuthenticatedJson.mockResolvedValue([]);

    await generatePhotoAnalysisNative({ projectId: PROJECT });

    expect(nativeAuthenticatedJson).toHaveBeenCalledWith(MOBILE_ANALYSIS_GENERATE_PATH, {
      method: "POST",
      json: { projectId: PROJECT },
    });
    expect(MOBILE_ANALYSIS_GENERATE_PATH).toBe("/api/mobile/v1/analysis/generate");
    const payload = nativeAuthenticatedJson.mock.calls[0]?.[1] as { json: Record<string, unknown> };
    expect(payload.json).not.toHaveProperty("userId");
    expect(payload.json).not.toHaveProperty("photoIds");
    expect(payload.json).not.toHaveProperty("access_token");
  });

  it("includes retry-weak mode when requested", async () => {
    nativeAuthenticatedJson.mockResolvedValue([]);
    await generatePhotoAnalysisNative({ projectId: PROJECT, mode: "retry-weak" });
    expect(nativeAuthenticatedJson).toHaveBeenCalledWith(MOBILE_ANALYSIS_GENERATE_PATH, {
      method: "POST",
      json: { projectId: PROJECT, mode: "retry-weak" },
    });
  });

  it("surfaces 401 from the canonical transport", async () => {
    nativeAuthenticatedJson.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(generatePhotoAnalysisNative({ projectId: PROJECT })).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });
});
