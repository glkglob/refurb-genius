/**
 * AO-1M4 — useSetProjectStage: repository mapping, dual-cache cancel/optimistic/rollback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { projectKeys } from "@/lib/queries/projects";
import type { ProjectWithProgress } from "@/lib/mappers";

const setProjectStageDone = vi.hoisted(() => vi.fn());

vi.mock("../../infrastructure/projectStageRepository", () => ({
  projectStageRepository: {
    setProjectStageDone: (...args: unknown[]) => setProjectStageDone(...args),
  },
  setProjectStageDone: (...args: unknown[]) => setProjectStageDone(...args),
}));

import { useSetProjectStage } from "./useSetProjectStage";

const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";

function makeProject(overrides: Partial<ProjectWithProgress> = {}): ProjectWithProgress {
  return {
    id: "p1",
    user_id: "u1",
    name: "Alpha",
    address: "1 High St",
    postcode: "E1 1AA",
    region: "London",
    property_type: "Terraced",
    bedrooms: 3,
    bathrooms: 1,
    size_sqm: 90,
    purchase_price: 300_000,
    estimated_gdv: 400_000,
    notes: "",
    created_at: "2026-01-01T00:00:00.000Z",
    status: "Draft",
    photos_done: false,
    analysis_done: false,
    estimate_done: false,
    report_done: false,
    ...overrides,
  };
}

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("useSetProjectStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setProjectStageDone.mockResolvedValue(undefined);
  });

  it("maps id/stage/value to repository projectId/stage/value", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "photos",
        value: true,
      });
    });

    expect(setProjectStageDone).toHaveBeenCalledWith({
      projectId: PROJECT_A,
      stage: "photos",
      value: true,
    });
  });

  it("passes value: false through to the repository", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "analysis",
        value: false,
      });
    });

    expect(setProjectStageDone).toHaveBeenCalledWith({
      projectId: PROJECT_A,
      stage: "analysis",
      value: false,
    });
  });

  it("does not resolve authentication before repository call", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "estimate",
        value: true,
      });
    });

    expect(setProjectStageDone).toHaveBeenCalledTimes(1);
  });

  it("surfaces repository errors through the mutation", async () => {
    setProjectStageDone.mockRejectedValue(new Error("RLS denied"));
    const qc = createQc();
    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: PROJECT_A,
          stage: "report",
          value: true,
        }),
      ).rejects.toThrow("RLS denied");
    });
  });

  it("cancels exact list and detail keys during onMutate", async () => {
    const qc = createQc();
    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const a = makeProject({ id: PROJECT_A, photos_done: false });
    qc.setQueryData(projectKeys.all, [a]);
    qc.setQueryData(projectKeys.byId(PROJECT_A), a);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "photos",
        value: true,
      });
    });

    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.all,
      exact: true,
    });
    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.byId(PROJECT_A),
      exact: true,
    });
    cancelSpy.mockRestore();
  });

  it("optimistically patches matching list project and existing detail only", async () => {
    const qc = createQc();
    const a = makeProject({ id: PROJECT_A, photos_done: false, name: "A" });
    const b = makeProject({ id: PROJECT_B, photos_done: false, name: "B" });
    qc.setQueryData(projectKeys.all, [a, b]);
    qc.setQueryData(projectKeys.byId(PROJECT_A), a);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "photos",
        value: true,
      });
    });

    const list = qc.getQueryData<ProjectWithProgress[]>(projectKeys.all);
    expect(list?.[0]?.photos_done).toBe(true);
    expect(list?.[0]?.name).toBe("A");
    expect(list?.[1]?.photos_done).toBe(false);
    expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_A))?.photos_done).toBe(
      true,
    );
    // Progress patch does not invent updated_at
    expect(
      (qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_A)) as { updated_at?: string })
        .updated_at,
    ).toBeUndefined();
  });

  it("does not seed absent list or null detail", async () => {
    const qc = createQc();
    qc.setQueryData(projectKeys.byId(PROJECT_A), null);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "photos",
        value: true,
      });
    });

    expect(qc.getQueryData(projectKeys.all)).toBeUndefined();
    expect(qc.getQueryData(projectKeys.byId(PROJECT_A))).toBeNull();
  });

  it("does not seed undefined detail cache", async () => {
    const qc = createQc();
    const a = makeProject({ id: PROJECT_A });
    qc.setQueryData(projectKeys.all, [a]);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "analysis",
        value: true,
      });
    });

    expect(qc.getQueryData(projectKeys.byId(PROJECT_A))).toBeUndefined();
    expect(qc.getQueryData<ProjectWithProgress[]>(projectKeys.all)?.[0]?.analysis_done).toBe(true);
  });

  it("rolls back list and detail on repository failure", async () => {
    setProjectStageDone.mockRejectedValue(new Error("network"));
    const qc = createQc();
    const a = makeProject({ id: PROJECT_A, estimate_done: false });
    const b = makeProject({ id: PROJECT_B, estimate_done: false });
    qc.setQueryData(projectKeys.all, [a, b]);
    qc.setQueryData(projectKeys.byId(PROJECT_A), a);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: PROJECT_A,
          stage: "estimate",
          value: true,
        }),
      ).rejects.toThrow("network");
    });

    await waitFor(() => {
      expect(qc.getQueryData<ProjectWithProgress[]>(projectKeys.all)?.[0]?.estimate_done).toBe(
        false,
      );
      expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_A))?.estimate_done).toBe(
        false,
      );
    });
  });

  it("does not seed undefined snapshots on rollback", async () => {
    setProjectStageDone.mockRejectedValue(new Error("fail"));
    const qc = createQc();

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: PROJECT_A,
          stage: "report",
          value: true,
        }),
      ).rejects.toThrow("fail");
    });

    expect(qc.getQueryData(projectKeys.all)).toBeUndefined();
    expect(qc.getQueryData(projectKeys.byId(PROJECT_A))).toBeUndefined();
  });

  it("restores null detail snapshot on failure", async () => {
    setProjectStageDone.mockRejectedValue(new Error("fail"));
    const qc = createQc();
    const a = makeProject({ id: PROJECT_A });
    qc.setQueryData(projectKeys.all, [a]);
    qc.setQueryData(projectKeys.byId(PROJECT_A), null);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: PROJECT_A,
          stage: "photos",
          value: true,
        }),
      ).rejects.toThrow("fail");
    });

    await waitFor(() => {
      expect(qc.getQueryData(projectKeys.byId(PROJECT_A))).toBeNull();
    });
  });

  it("does not invalidate on success or failure", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const a = makeProject({ id: PROJECT_A });
    qc.setQueryData(projectKeys.all, [a]);
    qc.setQueryData(projectKeys.byId(PROJECT_A), a);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "photos",
        value: true,
      });
    });
    expect(invalidateSpy).not.toHaveBeenCalled();

    setProjectStageDone.mockRejectedValue(new Error("boom"));
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: PROJECT_A,
          stage: "photos",
          value: true,
        }),
      ).rejects.toThrow("boom");
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });

  it("does not replace optimistic success data with a server row", async () => {
    const qc = createQc();
    const a = makeProject({ id: PROJECT_A, photos_done: false });
    qc.setQueryData(projectKeys.byId(PROJECT_A), a);
    qc.setQueryData(projectKeys.all, [a]);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "photos",
        value: true,
      });
    });

    expect(setProjectStageDone).toHaveBeenCalled();
    expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_A))?.photos_done).toBe(
      true,
    );
    expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_A))?.id).toBe(PROJECT_A);
  });

  it("isolates detail keys across projects while patching only matching list entry", async () => {
    const qc = createQc();
    const a = makeProject({ id: PROJECT_A, report_done: false });
    const b = makeProject({ id: PROJECT_B, report_done: false });
    qc.setQueryData(projectKeys.all, [a, b]);
    qc.setQueryData(projectKeys.byId(PROJECT_A), a);
    qc.setQueryData(projectKeys.byId(PROJECT_B), b);

    expect(projectKeys.byId(PROJECT_A)).toEqual(["projects", PROJECT_A]);
    expect(projectKeys.byId(PROJECT_B)).toEqual(["projects", PROJECT_B]);

    const { result } = renderHook(() => useSetProjectStage(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: PROJECT_A,
        stage: "report",
        value: true,
      });
    });

    expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_A))?.report_done).toBe(
      true,
    );
    expect(qc.getQueryData<ProjectWithProgress>(projectKeys.byId(PROJECT_B))?.report_done).toBe(
      false,
    );
    const list = qc.getQueryData<ProjectWithProgress[]>(projectKeys.all);
    expect(list?.find((p) => p.id === PROJECT_A)?.report_done).toBe(true);
    expect(list?.find((p) => p.id === PROJECT_B)?.report_done).toBe(false);
  });
});
