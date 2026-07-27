/**
 * AO-1C1 — PhotoAnalysisViewer uses canonical analysis write hook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectPhoto } from "@/lib/photos-types";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";

const mutate = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
const useUpdatePhotoAnalysisResult = vi.fn();

let mockIsPending = false;

vi.mock("@/features/ai-upload", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/ai-upload")>("@/features/ai-upload");
  return {
    ...actual,
    useUpdatePhotoAnalysisResult: (...args: unknown[]) => useUpdatePhotoAnalysisResult(...args),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

import { PhotoAnalysisViewer } from "./PhotoAnalysisViewer";

const PROJECT = "proj-1";

const PHOTO: ProjectPhoto = {
  id: "photo-1",
  projectId: PROJECT,
  name: "Kitchen.jpg",
  url: "https://example.com/kitchen.jpg",
  storagePath: "p/kitchen.jpg",
  size: 1000,
  uploadedAt: "2026-01-01T00:00:00.000Z",
};

const ANALYSIS: PhotoAnalysisResultRow = {
  id: "analysis-1",
  project_id: PROJECT,
  photo_id: "photo-1",
  category: "Kitchen",
  condition_report: "Fair condition",
  detected_defects: [{ description: "Crack", severity: "low" }],
  material_estimates: [],
  cost_suggestions: { mid: 150 },
  confidence_score: 0.8,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  created_by: null,
  editable_notes: null,
  room_id: null,
  severity: null,
  synced_to_estimate: false,
} as PhotoAnalysisResultRow;

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderViewer(
  overrides: Partial<{
    projectId: string;
    photos: ProjectPhoto[];
    analyses: PhotoAnalysisResultRow[];
  }> = {},
) {
  const qc = createQc();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return render(
    createElement(PhotoAnalysisViewer, {
      projectId: overrides.projectId ?? PROJECT,
      photos: overrides.photos ?? [PHOTO],
      analyses: overrides.analyses ?? [ANALYSIS],
    }),
    { wrapper },
  );
}

beforeEach(() => {
  mutate.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  toastInfo.mockReset();
  mockIsPending = false;
  useUpdatePhotoAnalysisResult.mockReset();
  useUpdatePhotoAnalysisResult.mockImplementation(() => ({
    mutate,
    isPending: mockIsPending,
  }));
  mutate.mockImplementation(
    (
      _vars: unknown,
      opts?: {
        onSuccess?: () => void;
        onError?: () => void;
        onSettled?: () => void;
      },
    ) => {
      opts?.onSuccess?.();
      opts?.onSettled?.();
    },
  );
});

describe("PhotoAnalysisViewer presentation", () => {
  it("calls useUpdatePhotoAnalysisResult with projectId", () => {
    renderViewer();
    expect(useUpdatePhotoAnalysisResult).toHaveBeenCalledWith(PROJECT);
  });

  it("renders with required props and photo card content", () => {
    renderViewer();
    expect(screen.getByText("Kitchen.jpg")).toBeTruthy();
  });

  async function openEditDialog() {
    fireEvent.click(screen.getByRole("button", { name: /View Details/i }));
    await waitFor(() => {
      expect(screen.getByText(/Analysis for Kitchen.jpg/i)).toBeTruthy();
    });
  }

  it("Save calls mutation with analysis id and editForm newData", async () => {
    renderViewer();
    await openEditDialog();

    fireEvent.click(screen.getByRole("button", { name: /Save Edits \(Optimistic\)/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars, opts] = mutate.mock.calls[0]!;
    expect(vars).toMatchObject({
      id: "analysis-1",
      newData: expect.objectContaining({
        // room and category both seeded from analysis.category (rowToParsed)
        room: "Kitchen",
        category: "Kitchen",
        condition_report: "Fair condition",
      }),
    });
    expect(opts).toEqual(
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
        onSettled: expect.any(Function),
      }),
    );
  });

  it("room edit does not change submitted category (quirk preserved)", async () => {
    renderViewer();
    await openEditDialog();

    // Labels are not htmlFor-associated; Room field is the first text input with Kitchen value.
    const roomInput = screen.getByDisplayValue("Kitchen");
    fireEvent.change(roomInput, { target: { value: "Utility" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Edits \(Optimistic\)/i }));

    const vars = mutate.mock.calls[0]![0] as {
      id: string;
      newData: { room?: string; category?: string };
    };
    expect(vars.newData.room).toBe("Utility");
    expect(vars.newData.category).toBe("Kitchen");
  });

  it("success toast and dialog close on settled success path", async () => {
    renderViewer();
    await openEditDialog();
    fireEvent.click(screen.getByRole("button", { name: /Save Edits \(Optimistic\)/i }));

    expect(toastSuccess).toHaveBeenCalledWith("Analysis updated");
    await waitFor(() => {
      expect(screen.queryByText(/Analysis for Kitchen.jpg/i)).toBeNull();
    });
  });

  it("error toast still closes dialog on settled", async () => {
    mutate.mockImplementation(
      (
        _vars: unknown,
        opts?: {
          onSuccess?: () => void;
          onError?: () => void;
          onSettled?: () => void;
        },
      ) => {
        opts?.onError?.();
        opts?.onSettled?.();
      },
    );

    renderViewer();
    await openEditDialog();
    fireEvent.click(screen.getByRole("button", { name: /Save Edits \(Optimistic\)/i }));

    expect(toastError).toHaveBeenCalledWith("Failed to save edits");
    expect(toastSuccess).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText(/Analysis for Kitchen.jpg/i)).toBeNull();
    });
  });

  it("pending state disables Save and shows Saving...", async () => {
    mockIsPending = true;
    useUpdatePhotoAnalysisResult.mockImplementation(() => ({
      mutate,
      isPending: true,
    }));

    renderViewer();
    await openEditDialog();
    await waitFor(() => expect(screen.getByRole("button", { name: /Saving\.\.\./i })).toBeTruthy());
    const save = screen.getByRole("button", { name: /Saving\.\.\./i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("idle save label is Save Edits (Optimistic)", async () => {
    renderViewer();
    await openEditDialog();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save Edits \(Optimistic\)/i })).toBeTruthy();
    });
  });

  it("source has no platform Supabase, useMutation, or direct photo_analysis_results write", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/photos/PhotoAnalysisViewer.tsx"),
      "utf8",
    );
    expect(src).toMatch(/useUpdatePhotoAnalysisResult\s*\(/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/useMutation/);
    expect(src).not.toMatch(/photo_analysis_results/);
    expect(src).toMatch(/useQueryClient/);
    expect(src).toMatch(/estimateQueryOptions/);
  });

  it("unanalyzed photo shows info toast and does not open edit dialog", () => {
    renderViewer({
      analyses: [],
      photos: [PHOTO],
    });
    fireEvent.click(screen.getByRole("button", { name: /View Details/i }));
    expect(toastInfo).toHaveBeenCalledWith("No analysis data for this photo yet.");
    expect(screen.queryByText(/Analysis for Kitchen.jpg/i)).toBeNull();
  });
});
