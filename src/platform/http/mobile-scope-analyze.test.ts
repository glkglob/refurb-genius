import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "./errors";

const nativeAuthenticatedJson = vi.fn();

vi.mock("./native-authenticated-fetch", () => ({
  nativeAuthenticatedJson: (...args: unknown[]) => nativeAuthenticatedJson(...args),
}));

import { MOBILE_SCOPE_ANALYZE_PATH, runScopeAnalysisNative } from "./mobile-scope-analyze";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

describe("runScopeAnalysisNative", () => {
  beforeEach(() => {
    nativeAuthenticatedJson.mockReset();
  });

  it("POSTs scope fields without userId or retrieval authority", async () => {
    nativeAuthenticatedJson.mockResolvedValue({ rooms: [] });

    await runScopeAnalysisNative({
      projectId: PROJECT,
      photos: [{ id: PHOTO, url: "https://evil.example/stolen.jpg", name: "room.jpg" }],
      roomTags: ["Kitchen"],
      propertyType: "Terraced",
      bedrooms: 3,
      region: "London",
    });

    expect(nativeAuthenticatedJson).toHaveBeenCalledWith(MOBILE_SCOPE_ANALYZE_PATH, {
      method: "POST",
      json: {
        projectId: PROJECT,
        photos: [{ id: PHOTO, url: "https://evil.example/stolen.jpg", name: "room.jpg" }],
        roomTags: ["Kitchen"],
        propertyType: "Terraced",
        bedrooms: 3,
        region: "London",
      },
    });
    expect(MOBILE_SCOPE_ANALYZE_PATH).toBe("/api/mobile/v1/scope/analyze");
    const payload = nativeAuthenticatedJson.mock.calls[0]?.[1] as { json: Record<string, unknown> };
    expect(payload.json).not.toHaveProperty("userId");
    expect(payload.json).not.toHaveProperty("retrievalUrl");
    expect(payload.json).not.toHaveProperty("storage_path");
    expect(payload.json).not.toHaveProperty("access_token");
  });

  it("surfaces 401 from the canonical transport", async () => {
    nativeAuthenticatedJson.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(
      runScopeAnalysisNative({
        projectId: PROJECT,
        photos: [{ id: PHOTO, url: "x", name: "a.jpg" }],
        roomTags: [],
        propertyType: "Terraced",
        bedrooms: 2,
        region: "London",
      }),
    ).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });
});
