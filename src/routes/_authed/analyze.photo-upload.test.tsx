/**
 * P0-PHOTO-1 — /analyze photo selection and upload gating.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const navigate = vi.fn();
const useSearch = vi.fn();
const useProjectCatalog = vi.fn();
const usePhotos = vi.fn();
const useUploadPhotos = vi.fn();
const mutate = vi.fn();
const checkUploadHealth = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: { component: unknown }) => ({
    options: opts,
    path,
    useSearch: () => useSearch(),
  }),
  useNavigate: () => navigate,
}));

vi.mock("@/features/feasibility", () => ({
  useProjectCatalog: (...args: unknown[]) => useProjectCatalog(...args),
  useQueueFeasibilityExport: () => ({ mutate: vi.fn(), isPending: false }),
  useFeasibilityOrchestrator: () => ({
    stage: "upload",
    study: null,
    isRunning: false,
    error: null,
    autosavedAt: null,
    redesignConcepts: [],
    setStage: vi.fn(),
    runFullAnalysis: vi.fn(),
    retryFromLastSuccessful: vi.fn(),
    continueFromCurrentStage: vi.fn(),
  }),
  FeasibilityStage: {
    Upload: "upload",
    Analysis: "analysis",
    Scope: "scope",
    Redesign: "redesign",
    Estimate: "estimate",
    Roi: "roi",
    Export: "export",
  },
}));

vi.mock("@/features/export", () => ({
  useExportFeasibilityReport: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/features/ai-upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai-upload")>();
  return {
    ...actual,
    usePhotos: (...args: unknown[]) => usePhotos(...args),
    useUploadPhotos: (...args: unknown[]) => useUploadPhotos(...args),
    checkUploadHealth: (...args: unknown[]) => checkUploadHealth(...args),
  };
});

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
  }) => createElement("div", { "data-testid": "app-layout", "data-title": title }, children),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { PhotoUploadBatchError, PhotoWriteError, type ProjectPhoto } from "@/features/ai-upload";
import { Route } from "./analyze";

const PROJECT_A = {
  id: "proj-aaa",
  name: "Alpha House",
  address: "1 High Street",
} as const;

function makeImage(name: string): File {
  return new File([new Uint8Array(32)], name, { type: "image/jpeg" });
}

function makePhoto(id: string): ProjectPhoto {
  return {
    id,
    projectId: PROJECT_A.id,
    url: `https://example.com/${id}.jpg`,
    name: `${id}.jpg`,
    size: 32,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    storagePath: `user/${PROJECT_A.id}/${id}.jpg`,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function renderAnalyze() {
  const Component = Route.options.component as () => ReactNode;
  return render(createElement(Wrapper, null, createElement(Component)));
}

function fireLibraryFiles(files: File[]) {
  const input = screen.getByTestId("property-photo-library-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { configurable: true, value: files });
  fireEvent.change(input);
}

beforeEach(() => {
  navigate.mockReset();
  mutate.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  useSearch.mockReturnValue({});
  useProjectCatalog.mockReturnValue({ data: [PROJECT_A], isLoading: false });
  usePhotos.mockReturnValue({ data: [] });
  useUploadPhotos.mockReturnValue({ mutate, isPending: false });
  checkUploadHealth.mockResolvedValue({ ok: true, status: "ok", message: "ok" });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

describe("analyze photo upload flow", () => {
  it("allows file selection with no project selected", async () => {
    renderAnalyze();
    const take = screen.getByRole("button", { name: /take photo/i });
    const library = screen.getByRole("button", { name: /upload from library/i });
    expect(take).not.toBeDisabled();
    expect(library).not.toBeDisabled();

    fireLibraryFiles([makeImage("room.jpg")]);
    expect(await screen.findByText(/Selected \(1\/20\)/i)).toBeTruthy();
    expect(
      screen.getAllByText(/Select a project before uploading the selected photos/i).length,
    ).toBeGreaterThan(0);
  });

  it("disables persistence with an explicit project-required message", async () => {
    renderAnalyze();
    fireLibraryFiles([makeImage("room.jpg")]);
    const uploadBtn = await screen.findByRole("button", { name: /upload selected/i });
    expect(uploadBtn).toBeDisabled();
    expect(
      screen.getAllByText(/Select a project before uploading the selected photos/i).length,
    ).toBeGreaterThan(0);
  });

  it("enables persistence after a real project is selected", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    renderAnalyze();
    fireLibraryFiles([makeImage("room.jpg")]);
    const uploadBtn = await screen.findByRole("button", { name: /upload selected \(1\)/i });
    expect(uploadBtn).not.toBeDisabled();
  });

  it("project selector stores the exact project id via navigation", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    renderAnalyze();
    // Select value is bound to the exact project id (no free-text).
    expect(screen.getByLabelText(/select project for photo upload/i)).toBeTruthy();
    fireLibraryFiles([makeImage("a.jpg")]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(1\)/i }));
    expect(mutate).toHaveBeenCalled();
    expect(useUploadPhotos).toHaveBeenCalledWith(PROJECT_A.id);
  });

  it("clears selected files on full upload success", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    mutate.mockImplementation(
      (_files: File[], opts: { onSuccess?: (p: ProjectPhoto[]) => void }) => {
        opts.onSuccess?.([makePhoto("p1")]);
      },
    );
    renderAnalyze();
    fireLibraryFiles([makeImage("a.jpg")]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(1\)/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Selected \(1\/20\)/i)).toBeNull();
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("retains files and shows error on full upload failure", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    mutate.mockImplementation((_files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoWriteError("network down", { stage: "storage-upload", cause: new Error("net") }),
      );
    });
    renderAnalyze();
    fireLibraryFiles([makeImage("a.jpg")]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(1\)/i }));
    await waitFor(() => {
      expect(screen.getByText(/Selected \(1\/20\)/i)).toBeTruthy();
    });
    expect(toastError).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /retry upload/i })).toBeTruthy();
  });

  it("partial upload keeps failed files only", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    const ok = makeImage("ok.jpg");
    const bad = makeImage("bad.jpg");
    mutate.mockImplementation((files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoUploadBatchError({
          successes: [makePhoto("ok")],
          failures: [
            {
              index: 1,
              file: files[1] ?? bad,
              stage: "storage-upload",
              cause: new Error("fail"),
            },
          ],
          attemptedCount: 2,
        }),
      );
    });
    renderAnalyze();
    fireLibraryFiles([ok, bad]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(2\)/i }));
    await waitFor(() => {
      expect(screen.getByText(/Selected \(1\/20\)/i)).toBeTruthy();
    });
    expect(screen.getByText(/1 uploaded, 1 failed/i)).toBeTruthy();
  });
});

describe("analyze photo upload source contract", () => {
  it("does not gate PhotoUploadZone isLoading on missing project", () => {
    const source = readFileSync(join(process.cwd(), "src/routes/_authed/analyze.tsx"), "utf8");
    expect(source).not.toMatch(/isLoading=\{\s*!selectedProject/);
    expect(source).toMatch(/isLoading=\{uploadPending\}/);
    expect(source).toMatch(/Select a project before uploading the selected photos/);
    expect(source).toMatch(/SelectTrigger/);
    expect(source).not.toMatch(/list="analyze-projects"/);
  });
});

describe("projects upload route camera contract (regression)", () => {
  it("keeps camera single-file and library multi-file", () => {
    const source = readFileSync(
      join(process.cwd(), "src/routes/_authed/projects.$id.upload.tsx"),
      "utf8",
    );
    // Camera input block: capture environment without multiple
    expect(source).toMatch(/capture="environment"/);
    const cameraBlock = source.slice(
      source.indexOf("ref={cameraInputRef}"),
      source.indexOf("ref={libraryInputRef}"),
    );
    expect(cameraBlock).not.toMatch(/\bmultiple\b/);
    const libraryBlock = source.slice(source.indexOf("ref={libraryInputRef}"));
    expect(libraryBlock).toMatch(/\bmultiple\b/);
  });
});
