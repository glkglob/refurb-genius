/**
 * AO-1M4 — projectStageRepository.setProjectStageDone table contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  fromMock,
  updateMock,
  eqMock,
  isNativePlatform,
  nativeFromMock,
  getNativeSupabase,
  getSession,
  refreshSession,
} = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn((..._args: unknown[]) => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  const nativeFromMock = vi.fn(() => ({ update: updateMock }));
  const getSession = vi.fn();
  const refreshSession = vi.fn();
  return {
    fromMock,
    updateMock,
    eqMock,
    isNativePlatform: vi.fn(() => false),
    nativeFromMock,
    getSession,
    refreshSession,
    getNativeSupabase: vi.fn(() => ({
      from: nativeFromMock,
      auth: { getSession, refreshSession },
    })),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import { setProjectStageDone, projectStageRepository } from "./projectStageRepository";

const PROJECT = "proj-stage-1";

function secondsFromNow(delta: number): number {
  return Math.floor(Date.now() / 1000) + delta;
}

function usableSession(expiresInSeconds = 3600) {
  return {
    access_token: "tok-valid",
    expires_at: secondsFromNow(expiresInSeconds),
  };
}

describe("setProjectStageDone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePlatform.mockReturnValue(false);
    updateMock.mockImplementation(() => ({ eq: eqMock }));
    eqMock.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({
      data: { session: usableSession() },
      error: null,
    });
    refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok-refreshed",
          expires_at: secondsFromNow(3600),
        },
      },
      error: null,
    });
  });

  it("maps photos to photos_done", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "photos", value: true });
    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(updateMock).toHaveBeenCalledWith({ photos_done: true });
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
    expect(getNativeSupabase).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("maps analysis to analysis_done", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "analysis", value: true });
    expect(updateMock).toHaveBeenCalledWith({ analysis_done: true });
  });

  it("maps estimate to estimate_done", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "estimate", value: true });
    expect(updateMock).toHaveBeenCalledWith({ estimate_done: true });
  });

  it("maps report to report_done", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "report", value: true });
    expect(updateMock).toHaveBeenCalledWith({ report_done: true });
  });

  it("preserves value: false for a stage flag", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "photos", value: false });
    expect(updateMock).toHaveBeenCalledWith({ photos_done: false });
  });

  it("uses projects update filtered by id without select", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "estimate", value: true });
    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
    const updateResult = updateMock.mock.results[0]?.value as Record<string, unknown>;
    expect(updateResult).not.toHaveProperty("select");
  });

  it("resolves void on success", async () => {
    const result = await setProjectStageDone({
      projectId: PROJECT,
      stage: "analysis",
      value: true,
    });
    expect(result).toBeUndefined();
  });

  it("throws Error(error.message) on Supabase failure", async () => {
    eqMock.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(
      setProjectStageDone({ projectId: PROJECT, stage: "report", value: true }),
    ).rejects.toThrow("RLS denied");
  });

  it("projectStageRepository exposes setProjectStageDone", async () => {
    await projectStageRepository.setProjectStageDone({
      projectId: PROJECT,
      stage: "photos",
      value: true,
    });
    expect(fromMock).toHaveBeenCalledWith("projects");
  });

  it("native uses getNativeSupabase and not the browser client", async () => {
    isNativePlatform.mockReturnValue(true);
    await setProjectStageDone({ projectId: PROJECT, stage: "photos", value: true });
    expect(getNativeSupabase).toHaveBeenCalledTimes(1);
    expect(nativeFromMock).toHaveBeenCalledWith("projects");
    expect(fromMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ photos_done: true });
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
  });

  it("native usable session proceeds to UPDATE without refresh", async () => {
    isNativePlatform.mockReturnValue(true);
    await setProjectStageDone({ projectId: PROJECT, stage: "analysis", value: true });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(nativeFromMock).toHaveBeenCalledWith("projects");
    expect(updateMock).toHaveBeenCalledWith({ analysis_done: true });
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("native expired session refreshes then UPDATEs", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok-old",
          expires_at: secondsFromNow(-30),
        },
      },
      error: null,
    });
    await setProjectStageDone({ projectId: PROJECT, stage: "photos", value: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ photos_done: true });
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("native near-expiry session refreshes then UPDATEs", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok-old",
          expires_at: secondsFromNow(30),
        },
      },
      error: null,
    });
    await setProjectStageDone({ projectId: PROJECT, stage: "estimate", value: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ estimate_done: true });
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
  });

  it("native refresh failure does not UPDATE", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok-old",
          expires_at: secondsFromNow(-30),
        },
      },
      error: null,
    });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid refresh tok-old" },
    });
    await expect(
      setProjectStageDone({ projectId: PROJECT, stage: "photos", value: true }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/session expired/i);
      expect(message).not.toContain("tok-old");
      return true;
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(nativeFromMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("native signed-out session does not UPDATE", async () => {
    isNativePlatform.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(
      setProjectStageDone({ projectId: PROJECT, stage: "report", value: true }),
    ).rejects.toThrow(/signed in/i);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(nativeFromMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
