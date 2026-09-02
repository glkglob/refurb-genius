import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDeletionContractError } from "../domain/accountDeletionContract";
import { NativeHttpError } from "@/platform/http/errors";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "deleteAccountForClient.ts"),
  "utf8",
);

const { isNativePlatform, deleteAccountNative, deleteAccountServerFn } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  deleteAccountNative: vi.fn(),
  deleteAccountServerFn: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/http/mobile-account-delete", () => ({
  deleteAccountNative: (...args: unknown[]) => deleteAccountNative(...args),
}));

vi.mock("@/serverFns/auth", () => ({
  deleteAccountServerFn: (...args: unknown[]) => deleteAccountServerFn(...args),
}));

import { deleteAccountForClient } from "./deleteAccountForClient";

describe("deleteAccountForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    deleteAccountNative.mockReset();
    deleteAccountServerFn.mockReset();
  });

  it("source uses Capacitor split and does not statically import the cookie serverFn", () => {
    expect(SRC).toMatch(/Capacitor\.isNativePlatform\(\)/);
    expect(SRC).toMatch(/deleteAccountNative/);
    expect(SRC).toMatch(/deleteAccountServerFn/);
    expect(SRC).not.toMatch(/^import .*deleteAccountServerFn/m);
    expect(SRC).not.toMatch(/createServerFn/);
  });

  it("web uses cookie deleteAccountServerFn and never the mobile helper", async () => {
    deleteAccountServerFn.mockResolvedValue({ success: true });
    await expect(deleteAccountForClient()).resolves.toEqual({ success: true });
    expect(deleteAccountServerFn).toHaveBeenCalledWith({});
    expect(deleteAccountNative).not.toHaveBeenCalled();
  });

  it("native uses Bearer helper and never calls deleteAccountServerFn", async () => {
    isNativePlatform.mockReturnValue(true);
    deleteAccountNative.mockResolvedValue({ success: true });
    await expect(deleteAccountForClient()).resolves.toEqual({ success: true });
    expect(deleteAccountNative).toHaveBeenCalledTimes(1);
    expect(deleteAccountServerFn).not.toHaveBeenCalled();
  });

  it("native rejects wrong JSON shapes after transport resolves", async () => {
    isNativePlatform.mockReturnValue(true);
    deleteAccountNative.mockResolvedValueOnce({ ok: true });
    await expect(deleteAccountForClient()).rejects.toBeInstanceOf(AccountDeletionContractError);
    deleteAccountNative.mockResolvedValueOnce({ success: "true" });
    await expect(deleteAccountForClient()).rejects.toBeInstanceOf(AccountDeletionContractError);
    deleteAccountNative.mockResolvedValueOnce({ success: true, extra: 1 });
    await expect(deleteAccountForClient()).rejects.toBeInstanceOf(AccountDeletionContractError);
    deleteAccountNative.mockResolvedValueOnce(null);
    await expect(deleteAccountForClient()).rejects.toBeInstanceOf(AccountDeletionContractError);
  });

  it("web rejects a resolved HTML Response as success", async () => {
    deleteAccountServerFn.mockResolvedValue(new Response("<html></html>", { status: 200 }));
    await expect(deleteAccountForClient()).rejects.toBeInstanceOf(AccountDeletionContractError);
  });

  it("web rejects { ok: true } as success", async () => {
    deleteAccountServerFn.mockResolvedValue({ ok: true });
    await expect(deleteAccountForClient()).rejects.toBeInstanceOf(AccountDeletionContractError);
  });

  it("does not swallow native 401 as success", async () => {
    isNativePlatform.mockReturnValue(true);
    deleteAccountNative.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(deleteAccountForClient()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
  });
});
