import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeHttpError } from "./errors";

const nativeAuthenticatedJson = vi.fn();

vi.mock("./native-authenticated-fetch", () => ({
  nativeAuthenticatedJson: (...args: unknown[]) => nativeAuthenticatedJson(...args),
}));

import { deleteAccountNative, MOBILE_ACCOUNT_DELETE_PATH } from "./mobile-account-delete";

describe("deleteAccountNative", () => {
  beforeEach(() => {
    nativeAuthenticatedJson.mockReset();
  });

  it("POSTs empty JSON to the Production mobile delete path without userId", async () => {
    nativeAuthenticatedJson.mockResolvedValue({ success: true });
    await expect(deleteAccountNative()).resolves.toEqual({ success: true });
    expect(MOBILE_ACCOUNT_DELETE_PATH).toBe("/api/mobile/v1/account/delete");
    expect(nativeAuthenticatedJson).toHaveBeenCalledWith(MOBILE_ACCOUNT_DELETE_PATH, {
      method: "POST",
      json: {},
    });
    const payload = nativeAuthenticatedJson.mock.calls[0]?.[1] as { json: Record<string, unknown> };
    expect(payload.json).not.toHaveProperty("userId");
  });

  it("returns parsed JSON without claiming deletion success itself", async () => {
    nativeAuthenticatedJson.mockResolvedValueOnce({ ok: true });
    await expect(deleteAccountNative()).resolves.toEqual({ ok: true });
  });

  it("surfaces 401 and network failures without treating them as success", async () => {
    nativeAuthenticatedJson.mockRejectedValueOnce(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(deleteAccountNative()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });

    nativeAuthenticatedJson.mockRejectedValueOnce(
      new NativeHttpError("Network request failed", { code: "network" }),
    );
    await expect(deleteAccountNative()).rejects.toMatchObject({ code: "network" });
  });
});
