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
  getLatestExportSnapshot,
  getLatestExportSnapshotStrict,
} from "./exportSnapshot.repository";

function mockSnapshotChain(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eqUser = vi.fn().mockReturnValue({ order });
  const eqProject = vi.fn().mockReturnValue({ eq: eqUser });
  const select = vi.fn().mockReturnValue({ eq: eqProject });
  fromMock.mockReturnValue({ select });
  return { select, eqProject, eqUser };
}

describe("getLatestExportSnapshotStrict", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    getUser.mockReset();
    getNativeUser.mockReset();
    fromMock.mockReset();
    getUser.mockReturnValue({ id: "web-user" });
    getNativeUser.mockResolvedValue({ data: { user: { id: "native-user" } }, error: null });
  });

  it("returns null when no snapshot exists", async () => {
    mockSnapshotChain({ data: null, error: null });
    await expect(getLatestExportSnapshotStrict("proj-1")).resolves.toBeNull();
  });

  it("throws when the web session is missing", async () => {
    getUser.mockReturnValue(null);
    await expect(getLatestExportSnapshotStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("legacy snapshot read still returns null when the web session is missing", async () => {
    getUser.mockReturnValue(null);
    await expect(getLatestExportSnapshot("proj-1")).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws on PostgREST error", async () => {
    mockSnapshotChain({ data: null, error: { message: "export read failed" } });
    await expect(getLatestExportSnapshotStrict("proj-1")).rejects.toThrow("export read failed");
  });

  it("maps a durable snapshot header", async () => {
    mockSnapshotChain({
      data: {
        id: "snap-1",
        estimate_id: "est-1",
        project_id: "proj-1",
        created_at: "2026-01-01T00:00:00.000Z",
        kind: "investor_report",
      },
      error: null,
    });
    await expect(getLatestExportSnapshotStrict("proj-1")).resolves.toEqual({
      id: "snap-1",
      estimateId: "est-1",
      projectId: "proj-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      kind: "investor_report",
    });
  });

  it("native throws when the session is missing", async () => {
    isNativePlatform.mockReturnValue(true);
    getNativeUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getLatestExportSnapshotStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
