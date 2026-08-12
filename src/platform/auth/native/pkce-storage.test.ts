/**
 * Native PKCE SecureStorage adapter contracts (IOS-READINESS-2B-2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const getItem = vi.fn();
const setItem = vi.fn();
const removeItem = vi.fn();
const get = vi.fn();
const set = vi.fn();
const remove = vi.fn();

vi.mock("@aparajita/capacitor-secure-storage", () => ({
  SecureStorage: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args),
    removeItem: (...args: unknown[]) => removeItem(...args),
    get: (...args: unknown[]) => get(...args),
    set: (...args: unknown[]) => set(...args),
    remove: (...args: unknown[]) => remove(...args),
  },
}));

import { createNativeAuthSecureStorage } from "./pkce-storage";

const SRC = join(__dirname, "pkce-storage.ts");

beforeEach(() => {
  getItem.mockReset();
  setItem.mockReset();
  removeItem.mockReset();
  get.mockReset();
  set.mockReset();
  remove.mockReset();
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
  removeItem.mockResolvedValue(undefined);
});

describe("createNativeAuthSecureStorage", () => {
  it("maps getItem to SecureStorage.getItem", async () => {
    getItem.mockResolvedValue("stored-value");
    const storage = createNativeAuthSecureStorage();

    await expect(storage.getItem("rg-native-auth-code-verifier")).resolves.toBe("stored-value");
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith("rg-native-auth-code-verifier");
    expect(get).not.toHaveBeenCalled();
  });

  it("maps setItem to SecureStorage.setItem with raw strings", async () => {
    const storage = createNativeAuthSecureStorage();
    await storage.setItem("rg-native-auth-code-verifier", "verifier-payload");

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith("rg-native-auth-code-verifier", "verifier-payload");
    expect(set).not.toHaveBeenCalled();
  });

  it("maps removeItem to SecureStorage.removeItem", async () => {
    const storage = createNativeAuthSecureStorage();
    await storage.removeItem("rg-native-auth-code-verifier");

    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith("rg-native-auth-code-verifier");
    expect(remove).not.toHaveBeenCalled();
  });

  it("returns null when SecureStorage has no value for the key", async () => {
    getItem.mockResolvedValue(null);
    const storage = createNativeAuthSecureStorage();
    await expect(storage.getItem("missing-key")).resolves.toBeNull();
  });

  it("does not use localStorage, Preferences, cookies, or JSON helpers", () => {
    const src = readFileSync(SRC, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/SecureStorage\.getItem/);
    expect(src).toMatch(/SecureStorage\.setItem/);
    expect(src).toMatch(/SecureStorage\.removeItem/);
    expect(src).not.toMatch(/localStorage|Preferences|cookie|document\.cookie/i);
    expect(src).not.toMatch(/SecureStorage\.get\b|SecureStorage\.set\b|SecureStorage\.remove\b/);
    expect(src).not.toMatch(/\blogger\b|console\.(log|debug|info|warn|error)/);
  });
});
