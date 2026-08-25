import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUser, isNativePlatform, listRoomAnalysesNative, getNativeUser, fromMock } = vi.hoisted(
  () => ({
    getUser: vi.fn(),
    isNativePlatform: vi.fn(() => false),
    listRoomAnalysesNative: vi.fn(),
    getNativeUser: vi.fn(),
    fromMock: vi.fn(),
  }),
);

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser: () => getUser(),
    onChange: vi.fn(() => () => undefined),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: vi.fn(),
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => ({
    auth: { getUser: () => getNativeUser() },
  }),
}));

vi.mock("@/platform/supabase/native-room-analyses", () => ({
  listRoomAnalysesNative: (...args: unknown[]) => listRoomAnalysesNative(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/queries/projects", () => ({
  fetchProjectPhotosList: vi.fn(),
}));

import { listRoomAnalysesStrict } from "./room-analysis.repository";

function mockWebChain(result: { data: unknown; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  fromMock.mockReturnValue({ select });
  return { select, eq, order };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ra-1",
    photo_id: "ph-1",
    photo_url: "https://example.com/a.jpg",
    photo_name: "a.jpg",
    room_type: "Kitchen",
    condition_level: "Average",
    refurbishment_level: "Medium",
    visible_issues: ["damp"],
    recommended_works: ["redecorate"],
    ai_summary: "ok",
    confidence_score: 0.9,
    source: "ai",
    ...overrides,
  };
}

describe("listRoomAnalysesStrict", () => {
  beforeEach(() => {
    getUser.mockReset();
    isNativePlatform.mockReset();
    listRoomAnalysesNative.mockReset();
    getNativeUser.mockReset();
    fromMock.mockReset();
    isNativePlatform.mockReturnValue(false);
    getUser.mockReturnValue({ id: "web-user" });
    getNativeUser.mockResolvedValue({ data: { user: { id: "native-user" } }, error: null });
  });

  it("returns [] when there are no rows", async () => {
    mockWebChain({ data: [], error: null });
    await expect(listRoomAnalysesStrict("proj-1")).resolves.toEqual([]);
  });

  it("returns [] when data is null", async () => {
    mockWebChain({ data: null, error: null });
    await expect(listRoomAnalysesStrict("proj-1")).resolves.toEqual([]);
  });

  it("throws on PostgREST error instead of returning []", async () => {
    mockWebChain({ data: null, error: { message: "permission denied" } });
    await expect(listRoomAnalysesStrict("proj-1")).rejects.toThrow("permission denied");
  });

  it("throws when the web session is missing", async () => {
    getUser.mockReturnValue(null);
    await expect(listRoomAnalysesStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("maps durable rows with existing rowToAnalysis", async () => {
    mockWebChain({ data: [makeRow()], error: null });
    const out = await listRoomAnalysesStrict("proj-1");
    expect(out).toEqual([
      expect.objectContaining({
        id: "ra-1",
        photo_id: "ph-1",
        source: "ai",
        visible_issues: ["damp"],
      }),
    ]);
  });

  it("native throws when the session is missing", async () => {
    isNativePlatform.mockReturnValue(true);
    getNativeUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listRoomAnalysesStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(listRoomAnalysesNative).not.toHaveBeenCalled();
  });

  it("native uses listRoomAnalysesNative and returns [] for no rows", async () => {
    isNativePlatform.mockReturnValue(true);
    listRoomAnalysesNative.mockResolvedValue([]);
    await expect(listRoomAnalysesStrict("proj-1")).resolves.toEqual([]);
    expect(listRoomAnalysesNative).toHaveBeenCalledWith("proj-1");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("native throws when the native list throws", async () => {
    isNativePlatform.mockReturnValue(true);
    listRoomAnalysesNative.mockRejectedValue(new Error("native boom"));
    await expect(listRoomAnalysesStrict("proj-1")).rejects.toThrow("native boom");
  });
});
