/**
 * IA-6-R1 — five-stage hook forwards registry operation-running into compose.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/ai-upload", () => ({
  getPhotoAnalysis: () => null,
  loadPhotoAnalysis: vi.fn(async () => []),
  usePhotos: () => ({ data: [{ id: "p1" }], isLoading: false }),
}));

vi.mock("@/features/ai-design", () => ({
  listRedesignConceptsServerFn: vi.fn(async () => []),
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
import {
  resetProjectWorkflowOperationRegistryForTests,
  setProjectWorkflowOperationRunning,
} from "../projectWorkflowOperationRegistry";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  resetProjectWorkflowOperationRegistryForTests();
});

describe("useProjectFiveStageWorkflow operation running", () => {
  it("forwards analysis running → nextAction view_stage_progress", async () => {
    const { result } = renderHook(() => useProjectFiveStageWorkflow("proj-1"), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.nextAction).not.toBeNull();
    });

    // Without running: analyse_photos (photos present, no analyses)
    expect(result.current.nextAction?.actionKind).toBe("analyse_photos");

    act(() => {
      setProjectWorkflowOperationRunning("proj-1", "analysis", true);
    });

    await waitFor(() => {
      expect(result.current.nextAction?.actionKind).toBe("view_stage_progress");
      expect(result.current.nextAction?.stage).toBe("analysis");
      expect(result.current.nextAction?.route).toBe("/projects/proj-1/analysis");
    });

    act(() => {
      setProjectWorkflowOperationRunning("proj-1", "analysis", false);
    });

    await waitFor(() => {
      expect(result.current.nextAction?.actionKind).toBe("analyse_photos");
    });
  });

  it("loading evidence is not view_stage_progress (workflow null while hydrating)", async () => {
    // usePhotos isLoading false after mock; hook internal loading starts true then settles.
    const { result } = renderHook(() => useProjectFiveStageWorkflow("proj-load"), { wrapper });
    // Immediately after mount, loading may be true and nextAction null — never view_stage_progress.
    if (result.current.loading) {
      expect(result.current.nextAction).toBeNull();
    }
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.nextAction?.actionKind).not.toBe("view_stage_progress");
  });
});
