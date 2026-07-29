/**
 * AO-1M4 — projectStageRepository.setProjectStageDone table contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, updateMock, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const updateMock = vi.fn((..._args: unknown[]) => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));
  return { fromMock, updateMock, eqMock };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { setProjectStageDone, projectStageRepository } from "./projectStageRepository";

const PROJECT = "proj-stage-1";

describe("setProjectStageDone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockImplementation(() => ({ eq: eqMock }));
    eqMock.mockResolvedValue({ error: null });
  });

  it("maps photos to photos_done", async () => {
    await setProjectStageDone({ projectId: PROJECT, stage: "photos", value: true });
    expect(fromMock).toHaveBeenCalledWith("projects");
    expect(updateMock).toHaveBeenCalledWith({ photos_done: true });
    expect(eqMock).toHaveBeenCalledWith("id", PROJECT);
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
});
