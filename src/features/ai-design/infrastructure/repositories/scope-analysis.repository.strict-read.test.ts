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
  getLatestScopeAuthorityHeader,
  getLatestScopeAuthorityHeaderStrict,
} from "./scope-analysis.repository";

function mockHeaderChain(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const eqUser = vi.fn().mockReturnValue({ order });
  const eqProject = vi.fn().mockReturnValue({ eq: eqUser });
  const select = vi.fn().mockReturnValue({ eq: eqProject });
  fromMock.mockReturnValue({ select });
  return { select, eqProject, eqUser, order };
}

describe("getLatestScopeAuthorityHeaderStrict", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    getUser.mockReset();
    getNativeUser.mockReset();
    fromMock.mockReset();
    getUser.mockReturnValue({ id: "web-user" });
    getNativeUser.mockResolvedValue({ data: { user: { id: "native-user" } }, error: null });
  });

  it("returns null when no scope row exists", async () => {
    mockHeaderChain({ data: null, error: null });
    await expect(getLatestScopeAuthorityHeaderStrict("proj-1")).resolves.toBeNull();
  });

  it("throws when the web session is missing", async () => {
    getUser.mockReturnValue(null);
    await expect(getLatestScopeAuthorityHeaderStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("legacy header read still returns null when the web session is missing", async () => {
    getUser.mockReturnValue(null);
    await expect(getLatestScopeAuthorityHeader("proj-1")).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("throws on PostgREST error", async () => {
    mockHeaderChain({ data: null, error: { message: "scope read failed" } });
    await expect(getLatestScopeAuthorityHeaderStrict("proj-1")).rejects.toThrow(
      "scope read failed",
    );
  });

  it("maps identity fields from a durable header", async () => {
    mockHeaderChain({
      data: {
        id: "scope-1",
        analysis_identity: "a",
        redesign_identity: "r",
        redesign_concept_id: "c1",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });
    await expect(getLatestScopeAuthorityHeaderStrict("proj-1")).resolves.toEqual({
      id: "scope-1",
      analysisIdentity: "a",
      redesignIdentity: "r",
      redesignConceptId: "c1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("native throws when the session is missing", async () => {
    isNativePlatform.mockReturnValue(true);
    getNativeUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getLatestScopeAuthorityHeaderStrict("proj-1")).rejects.toThrow(/signed in/i);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
