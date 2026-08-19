import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "./errors";

const nativeAuthenticatedJson = vi.fn();

vi.mock("./native-authenticated-fetch", () => ({
  nativeAuthenticatedJson: (...args: unknown[]) => nativeAuthenticatedJson(...args),
}));

import { MOBILE_ANALYSIS_RUN_PATH, runPhotoAnalysisNative } from "./mobile-analysis-run";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

describe("runPhotoAnalysisNative", () => {
  beforeEach(() => {
    nativeAuthenticatedJson.mockReset();
  });

  it("POSTs only projectId/photoIds to the production mobile analysis path", async () => {
    nativeAuthenticatedJson.mockResolvedValue([]);

    await runPhotoAnalysisNative({ projectId: PROJECT, photoIds: [PHOTO] });

    expect(nativeAuthenticatedJson).toHaveBeenCalledWith(MOBILE_ANALYSIS_RUN_PATH, {
      method: "POST",
      json: { projectId: PROJECT, photoIds: [PHOTO] },
    });
    expect(MOBILE_ANALYSIS_RUN_PATH).toBe("/api/mobile/v1/analysis/run");
    const payload = nativeAuthenticatedJson.mock.calls[0]?.[1] as { json: Record<string, unknown> };
    expect(Object.keys(payload.json)).toEqual(["projectId", "photoIds"]);
    expect(payload.json).not.toHaveProperty("userId");
    expect(payload.json).not.toHaveProperty("url");
    expect(payload.json).not.toHaveProperty("retrievalUrl");
    expect(payload.json).not.toHaveProperty("storage_path");
    expect(payload.json).not.toHaveProperty("provider");
    expect(payload.json).not.toHaveProperty("access_token");
  });

  it("surfaces 401 from the canonical transport", async () => {
    nativeAuthenticatedJson.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(
      runPhotoAnalysisNative({ projectId: PROJECT, photoIds: [PHOTO] }),
    ).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });
});
