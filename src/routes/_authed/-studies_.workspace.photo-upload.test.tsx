/**
 * P0-PHOTO-1 — /studies/workspace photo selection and upload gating.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

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
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string; [key: string]: unknown }) =>
    createElement("a", { href: typeof to === "string" ? to : "#", ...rest }, children),
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
import { Route } from "./studies_.workspace";

const PROJECT_A = {
  id: "proj-aaa",
  name: "Alpha House",
  address: "1 High Street",
} as const;

const PROJECT_B = {
  id: "proj-bbb",
  name: "Beta Villa",
  address: "2 Low Road",
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
  checkUploadHealth.mockReset();
  useSearch.mockReturnValue({});
  useProjectCatalog.mockReturnValue({ data: [PROJECT_A, PROJECT_B], isLoading: false });
  usePhotos.mockReturnValue({ data: [] });
  useUploadPhotos.mockReturnValue({ mutate, isPending: false });
  checkUploadHealth.mockResolvedValue({ ok: true, status: "ok", message: "ok", checkedAt: "t" });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

  // Radix Select requires pointer-capture / scrollIntoView APIs absent from jsdom.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
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
    useSearch.mockReturnValue({ studyId: "study-123" });
    renderAnalyze();

    const trigger = screen.getByLabelText(/select project for photo upload/i);
    // Open via keyboard (supported Radix path in jsdom).
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const option = await screen.findByRole("option", { name: /alpha house/i });
    fireEvent.click(option);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/studies/workspace",
        search: {
          projectId: "proj-aaa",
          studyId: "study-123",
        },
        replace: true,
      });
    });
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
    const original = makeImage("a.jpg");
    mutate.mockImplementation((_files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoWriteError("network down", { stage: "storage-upload", cause: new Error("net") }),
      );
    });
    renderAnalyze();
    fireLibraryFiles([original]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(1\)/i }));
    await waitFor(() => {
      expect(screen.getByText(/Selected \(1\/20\)/i)).toBeTruthy();
    });
    expect(toastError).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /retry upload/i })).toBeTruthy();

    mutate.mockClear();
    mutate.mockImplementation((_files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoWriteError("network down", { stage: "storage-upload", cause: new Error("net") }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /retry upload/i }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
    const secondFiles = mutate.mock.calls[0]![0] as File[];
    expect(secondFiles).toHaveLength(1);
    expect(secondFiles[0]).toBe(original);
    expect(useUploadPhotos).toHaveBeenCalledWith(PROJECT_A.id);
  });

  it("partial upload keeps failed files only and shows one canonical message", async () => {
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
    // Canonical formatted batch error is visible once.
    const canonical = await screen.findByText(/1 uploaded, 1 failed/i);
    expect(canonical).toBeTruthy();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/1 uploaded, 1 failed/i));
    // No separate full-success banner and no old competing partial-success copy.
    expect(screen.queryByText(/Photo uploaded successfully/i)).toBeNull();
    expect(screen.queryByText(/\d+ photos uploaded successfully/i)).toBeNull();
    expect(screen.queryByText(/Retry the remaining files/i)).toBeNull();
  });
});

describe("analyze upload health probe timing", () => {
  it("does not probe upload health on initial mount", async () => {
    renderAnalyze();
    await screen.findByRole("button", { name: /take photo/i });
    expect(checkUploadHealth).not.toHaveBeenCalled();
  });

  it("does not probe upload health after a successful upload", async () => {
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
      expect(toastSuccess).toHaveBeenCalled();
    });
    expect(checkUploadHealth).not.toHaveBeenCalled();
  });

  it("probes once on first full failure and not again on retry failure", async () => {
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
      expect(checkUploadHealth).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /retry upload/i }));
    await waitFor(() => {
      expect(mutate.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(checkUploadHealth).toHaveBeenCalledTimes(1);
  });

  it("probes once on first partial failure", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    mutate.mockImplementation((files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoUploadBatchError({
          successes: [makePhoto("ok")],
          failures: [
            {
              index: 1,
              file: files[1] ?? makeImage("bad.jpg"),
              stage: "storage-upload",
              cause: new Error("fail"),
            },
          ],
          attemptedCount: 2,
        }),
      );
    });
    renderAnalyze();
    fireLibraryFiles([makeImage("ok.jpg"), makeImage("bad.jpg")]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(2\)/i }));
    await waitFor(() => {
      expect(checkUploadHealth).toHaveBeenCalledTimes(1);
    });
  });

  it("renders storage-health warning when probe reports unhealthy", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    checkUploadHealth.mockResolvedValue({
      ok: false,
      status: "storage",
      message: "Photo storage is not writable.",
      checkedAt: "t",
    });
    mutate.mockImplementation((_files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoWriteError("network down", { stage: "storage-upload", cause: new Error("net") }),
      );
    });
    renderAnalyze();
    fireLibraryFiles([makeImage("a.jpg")]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(1\)/i }));
    expect(await screen.findByText(/Upload may not work right now/i)).toBeTruthy();
    expect(screen.getByText(/Photo storage is not writable/i)).toBeTruthy();
  });

  it("ignores late health probe results after unmount", async () => {
    useSearch.mockReturnValue({ projectId: PROJECT_A.id });
    let resolveHealth:
      | ((value: { ok: boolean; status: string; message: string; checkedAt: string }) => void)
      | undefined;
    checkUploadHealth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );
    mutate.mockImplementation((_files: File[], opts: { onError?: (e: unknown) => void }) => {
      opts.onError?.(
        new PhotoWriteError("network down", { stage: "storage-upload", cause: new Error("net") }),
      );
    });

    const { unmount } = renderAnalyze();
    fireLibraryFiles([makeImage("a.jpg")]);
    fireEvent.click(await screen.findByRole("button", { name: /upload selected \(1\)/i }));
    await waitFor(() => {
      expect(checkUploadHealth).toHaveBeenCalledTimes(1);
    });

    unmount();
    resolveHealth?.({
      ok: false,
      status: "storage",
      message: "late unhealthy",
      checkedAt: "t",
    });
    // Allow microtasks; no throw / no re-render of unmounted tree warning content.
    await waitFor(() => {
      expect(checkUploadHealth).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/late unhealthy/i)).toBeNull();
  });
});
