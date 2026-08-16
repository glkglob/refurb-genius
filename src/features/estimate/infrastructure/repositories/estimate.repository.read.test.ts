import { describe, it, expect, vi, beforeEach } from "vitest";

const { isNativePlatform, getUser, getNativeUser, fromMock } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getUser: vi.fn(),
  getNativeUser: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser: () => getUser(),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => ({
    auth: { getUser: () => getNativeUser() },
    from: (...args: unknown[]) => fromMock(...args),
  }),
}));

import { getLatestRoomEstimate, getLatestProjectEstimate } from "./estimate.repository";

function mockEmptyEstimateChain() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order2 = vi.fn().mockReturnValue({ limit });
  const order1 = vi.fn().mockReturnValue({ order: order2, limit });
  const eq3 = vi.fn().mockReturnValue({ order: order1 });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3, order: order1 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  fromMock.mockReturnValue({ select });
}

describe("estimate read platform split", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    getUser.mockReset();
    getNativeUser.mockReset();
    fromMock.mockReset();
    getUser.mockReturnValue({ id: "web-user" });
    getNativeUser.mockResolvedValue({ data: { user: { id: "native-user" } }, error: null });
    mockEmptyEstimateChain();
  });

  it("web getLatestRoomEstimate uses cookie auth.getUser", async () => {
    await getLatestRoomEstimate("proj-1");
    expect(getUser).toHaveBeenCalled();
    expect(getNativeUser).not.toHaveBeenCalled();
  });

  it("native getLatestRoomEstimate uses Keychain getUser and not cookie auth", async () => {
    isNativePlatform.mockReturnValue(true);
    await getLatestRoomEstimate("proj-1");
    expect(getNativeUser).toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("native signed-out getLatestProjectEstimate returns null without querying", async () => {
    isNativePlatform.mockReturnValue(true);
    getNativeUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getLatestProjectEstimate("proj-1")).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
