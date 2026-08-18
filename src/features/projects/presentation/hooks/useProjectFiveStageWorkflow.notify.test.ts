/**
 * P1 — five-stage hook reloads only for its own project Analysis notifications.
 * N3/N4/N7.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { loadPhotoAnalysis, subscribePhotoAnalysis, notifyAnalysis, resetAnalysisListeners } =
  vi.hoisted(() => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      loadPhotoAnalysis: vi.fn(async (_projectId: string) => []),
      subscribePhotoAnalysis: vi.fn((projectId: string, fn: () => void) => {
        let set = listeners.get(projectId);
        if (!set) {
          set = new Set();
          listeners.set(projectId, set);
        }
        set.add(fn);
        return () => {
          set?.delete(fn);
        };
      }),
      notifyAnalysis: (projectId: string) => {
        listeners.get(projectId)?.forEach((fn) => fn());
      },
      resetAnalysisListeners: () => {
        listeners.clear();
      },
    };
  });

vi.mock("@/features/ai-upload", () => ({
  getPhotoAnalysis: () => undefined,
  loadPhotoAnalysis,
  usePhotos: () => ({
    data: [{ id: "p1", url: "https://u/p1", name: "p1.jpg" }],
    isLoading: false,
  }),
  preferAnalysesForCurrentCatalogue: () => [],
  isProductionValidAnalysisSet: () => false,
  durablePhotoCatalogueIdentity: () => "catalogue-stable",
  subscribePhotoAnalysis,
}));

vi.mock("@/features/ai-design", () => ({
  listRedesignConceptsForClient: vi.fn(async () => []),
  currentSelectedRedesignId: () => null,
  resolveCurrentAnalysisIdentity: () => "",
}));

vi.mock("@/features/ai-design/infrastructure", () => ({
  getLatestScopeAuthorityHeader: vi.fn(async () => null),
}));

vi.mock("@/features/estimate", () => ({
  getLatestProjectEstimate: vi.fn(async () => null),
  estimateAuthorityEvidenceFromRow: (e: { id: string }) => ({
    id: e.id,
    inputScopeId: null,
    isDraft: true,
  }),
}));

vi.mock("@/features/export/infrastructure", () => ({
  getLatestExportSnapshot: vi.fn(async () => null),
}));

import { useProjectFiveStageWorkflow } from "./useProjectFiveStageWorkflow";
import { resetProjectWorkflowOperationRegistryForTests } from "../projectWorkflowOperationRegistry";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function loadCount(projectId: string): number {
  return loadPhotoAnalysis.mock.calls.filter((call) => call[0] === projectId).length;
}

const HOOK_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "useProjectFiveStageWorkflow.ts"),
  "utf8",
);

const REDESIGN_SRC = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../routes/_authed/projects.$id.redesign.tsx",
  ),
  "utf8",
);

beforeEach(() => {
  resetProjectWorkflowOperationRegistryForTests();
  resetAnalysisListeners();
  loadPhotoAnalysis.mockClear();
  subscribePhotoAnalysis.mockClear();
});

describe("useProjectFiveStageWorkflow Analysis notification isolation", () => {
  it("subscribes with its own projectId only", async () => {
    expect(HOOK_SRC).toMatch(/subscribePhotoAnalysis\(\s*projectId\s*,/);
    expect(REDESIGN_SRC).toMatch(/subscribePhotoAnalysis\(\s*id\s*,/);

    const { unmount } = renderHook(() => useProjectFiveStageWorkflow("hook-proj-a"), { wrapper });
    await waitFor(() => expect(subscribePhotoAnalysis).toHaveBeenCalled());
    expect(subscribePhotoAnalysis).toHaveBeenCalledWith("hook-proj-a", expect.any(Function));
    expect(subscribePhotoAnalysis.mock.calls.every((call) => call[0] === "hook-proj-a")).toBe(true);
    unmount();
  });

  it("N3: project A Analysis notify does not reload project B evidence", async () => {
    const a = renderHook(() => useProjectFiveStageWorkflow("hook-proj-a"), { wrapper });
    const b = renderHook(() => useProjectFiveStageWorkflow("hook-proj-b"), { wrapper });

    await waitFor(() => {
      expect(a.result.current.loading).toBe(false);
      expect(b.result.current.loading).toBe(false);
    });

    const aBefore = loadCount("hook-proj-a");
    const bBefore = loadCount("hook-proj-b");
    expect(aBefore).toBeGreaterThan(0);
    expect(bBefore).toBeGreaterThan(0);

    await act(async () => {
      notifyAnalysis("hook-proj-a");
    });

    await waitFor(() => {
      expect(loadCount("hook-proj-a")).toBe(aBefore + 1);
    });
    expect(loadCount("hook-proj-b")).toBe(bBefore);

    a.unmount();
    b.unmount();
  });

  it("N3: multiple same-project cards do not create cross-project N×K fan-out", async () => {
    const a1 = renderHook(() => useProjectFiveStageWorkflow("hook-multi-a"), { wrapper });
    const a2 = renderHook(() => useProjectFiveStageWorkflow("hook-multi-a"), { wrapper });
    const b1 = renderHook(() => useProjectFiveStageWorkflow("hook-multi-b"), { wrapper });
    const b2 = renderHook(() => useProjectFiveStageWorkflow("hook-multi-b"), { wrapper });

    await waitFor(() => {
      expect(a1.result.current.loading).toBe(false);
      expect(a2.result.current.loading).toBe(false);
      expect(b1.result.current.loading).toBe(false);
      expect(b2.result.current.loading).toBe(false);
    });

    const aBefore = loadCount("hook-multi-a");
    const bBefore = loadCount("hook-multi-b");

    await act(async () => {
      notifyAnalysis("hook-multi-a");
    });

    await waitFor(() => {
      expect(loadCount("hook-multi-a")).toBe(aBefore + 2);
    });
    expect(loadCount("hook-multi-b")).toBe(bBefore);

    a1.unmount();
    a2.unmount();
    b1.unmount();
    b2.unmount();
  });

  it("N4: same-project Analysis notify reloads when catalogue identity is unchanged", async () => {
    const { result, unmount } = renderHook(() => useProjectFiveStageWorkflow("hook-same"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = loadCount("hook-same");
    await act(async () => {
      notifyAnalysis("hook-same");
    });
    await waitFor(() => {
      expect(loadCount("hook-same")).toBe(before + 1);
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it("N7: one Analysis notify does not loop reloads", async () => {
    const { result, unmount } = renderHook(() => useProjectFiveStageWorkflow("hook-noloop"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = loadCount("hook-noloop");
    await act(async () => {
      notifyAnalysis("hook-noloop");
    });
    await waitFor(() => {
      expect(loadCount("hook-noloop")).toBe(before + 1);
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadCount("hook-noloop")).toBe(before + 1);
    unmount();
  });
});
