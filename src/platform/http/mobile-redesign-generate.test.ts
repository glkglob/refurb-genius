import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "./errors";

const nativeAuthenticatedJson = vi.fn();

vi.mock("./native-authenticated-fetch", () => ({
  nativeAuthenticatedJson: (...args: unknown[]) => nativeAuthenticatedJson(...args),
}));

import {
  generateRedesignConceptsNative,
  MOBILE_REDESIGN_GENERATE_PATH,
} from "./mobile-redesign-generate";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

describe("generateRedesignConceptsNative", () => {
  beforeEach(() => {
    nativeAuthenticatedJson.mockReset();
  });

  it("POSTs only projectId/styles to the production mobile generate path", async () => {
    nativeAuthenticatedJson.mockResolvedValue([]);

    await generateRedesignConceptsNative({ projectId: PROJECT, styles: ["Modern"] });

    expect(nativeAuthenticatedJson).toHaveBeenCalledWith(MOBILE_REDESIGN_GENERATE_PATH, {
      method: "POST",
      json: { projectId: PROJECT, styles: ["Modern"] },
    });
    expect(MOBILE_REDESIGN_GENERATE_PATH).toBe("/api/mobile/v1/redesign/generate");
    const payload = nativeAuthenticatedJson.mock.calls[0]?.[1] as { json: Record<string, unknown> };
    expect(payload.json).not.toHaveProperty("userId");
    expect(payload.json).not.toHaveProperty("analyses");
    expect(payload.json).not.toHaveProperty("access_token");
  });

  it("validates an array response and rejects malformed envelopes", async () => {
    nativeAuthenticatedJson.mockResolvedValueOnce([{ id: "c1", isSelected: false }]);
    await expect(generateRedesignConceptsNative({ projectId: PROJECT })).resolves.toEqual([
      { id: "c1", isSelected: false },
    ]);

    nativeAuthenticatedJson.mockResolvedValueOnce({ data: [] });
    await expect(generateRedesignConceptsNative({ projectId: PROJECT })).resolves.toEqual({
      data: [],
    });
  });

  it("surfaces 401 from the canonical transport", async () => {
    nativeAuthenticatedJson.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(generateRedesignConceptsNative({ projectId: PROJECT })).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });
});
