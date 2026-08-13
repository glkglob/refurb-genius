import { describe, it, expect, vi, beforeEach } from "vitest";

const isNativePlatform = vi.fn();
const getNativeSupabase = vi.fn(() => ({ kind: "native-client" }));
const browserClient = { kind: "browser-client" };

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("./native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

vi.mock("./_client", () => ({
  supabase: browserClient,
}));

describe("getPlatformSupabase", () => {
  beforeEach(() => {
    vi.resetModules();
    isNativePlatform.mockReset();
    getNativeSupabase.mockClear();
  });

  it("returns browser cookie client on web", async () => {
    isNativePlatform.mockReturnValue(false);
    const { getPlatformSupabase, isNativeSupabaseAuthority } = await import("./client");
    expect(isNativeSupabaseAuthority()).toBe(false);
    expect(getPlatformSupabase()).toBe(browserClient);
    expect(getNativeSupabase).not.toHaveBeenCalled();
  });

  it("returns native Keychain client on Capacitor", async () => {
    isNativePlatform.mockReturnValue(true);
    const { getPlatformSupabase, isNativeSupabaseAuthority } = await import("./client");
    expect(isNativeSupabaseAuthority()).toBe(true);
    expect(getPlatformSupabase()).toEqual({ kind: "native-client" });
    expect(getNativeSupabase).toHaveBeenCalledTimes(1);
  });
});
