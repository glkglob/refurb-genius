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

import {
  getLatestRoomEstimate,
  getLatestProjectEstimate,
  getLatestProjectEstimateStrict,
} from "./estimate.repository";

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

  it("native signed-out getLatestProjectEstimateStrict throws instead of returning null", async () => {
    isNativePlatform.mockReturnValue(true);
    getNativeUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getLatestProjectEstimateStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

function mockEstimateRows(rows: Array<Record<string, unknown>>, items: unknown[] = []) {
  fromMock.mockImplementation((table: string) => {
    if (table === "estimates") {
      const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
      const orderId = vi.fn().mockReturnValue({ limit });
      const orderCreated = vi.fn().mockReturnValue({ order: orderId, limit });
      const eqUser = vi.fn().mockReturnValue({ order: orderCreated });
      const eqProject = vi.fn().mockReturnValue({ eq: eqUser });
      return { select: vi.fn().mockReturnValue({ eq: eqProject }) };
    }
    const order = vi.fn().mockResolvedValue({ data: items, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    return { select: vi.fn().mockReturnValue({ eq }) };
  });
}

describe("getLatestProjectEstimateStrict selection", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    getUser.mockReset();
    getNativeUser.mockReset();
    fromMock.mockReset();
    getUser.mockReturnValue({ id: "web-user" });
  });

  it("selects the authoritative estimate bound to the current scope", async () => {
    const stale = {
      id: "est-stale",
      pricing_authority: "category-engine",
      input_scope_id: "scope-old",
      created_at: "2026-02-01T00:00:00.000Z",
    };
    const current = {
      id: "est-current",
      pricing_authority: "category-engine",
      input_scope_id: "scope-new",
      created_at: "2026-01-01T00:00:00.000Z",
    };
    mockEstimateRows([stale, current]);
    const out = await getLatestProjectEstimateStrict("proj-1", "scope-new");
    expect(out?.estimate).toEqual(expect.objectContaining({ id: "est-current" }));
  });

  it("with no current scope still loads the latest eligible estimate", async () => {
    const latestAuth = {
      id: "est-latest",
      pricing_authority: "measured-boq-engine",
      input_scope_id: "scope-old",
      created_at: "2026-03-01T00:00:00.000Z",
    };
    const olderAuth = {
      id: "est-older",
      pricing_authority: "category-engine",
      input_scope_id: "scope-new",
      created_at: "2026-01-01T00:00:00.000Z",
    };
    mockEstimateRows([latestAuth, olderAuth]);
    const out = await getLatestProjectEstimateStrict("proj-1", null);
    expect(out?.estimate).toEqual(expect.objectContaining({ id: "est-latest" }));
  });

  it("returns null when no estimate rows exist", async () => {
    mockEstimateRows([]);
    await expect(getLatestProjectEstimateStrict("proj-1", "scope-1")).resolves.toBeNull();
  });
});
