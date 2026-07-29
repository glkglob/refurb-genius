/**
 * AO-1M2 — useGenerateAndSavePitchDeck: auth, multi-fetch, PDF, download, save, invalidate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectKeys } from "@/lib/queries/projects";
import { pitchDecksByProjectQueryOptions } from "@/lib/queries/pitch-decks";

const getUser = vi.hoisted(() => vi.fn());
const exportPitchDeck = vi.hoisted(() => vi.fn());
const savePitchDeckExport = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());
const loggerInfo = vi.hoisted(() => vi.fn());
const loggerWarn = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser: (...args: unknown[]) => getUser(...args),
  },
}));

vi.mock("../../infrastructure", () => ({
  legacyPdfExporter: {
    exportPitchDeck: (...args: unknown[]) => exportPitchDeck(...args),
  },
  supabaseExportRepository: {
    savePitchDeckExport: (...args: unknown[]) => savePitchDeckExport(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfo(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: (...args: unknown[]) => loggerError(...args),
  },
}));

import { useGenerateAndSavePitchDeck } from "./useGenerateAndSavePitchDeck";

const PROJECT = "proj-pitch-1";
const USER = { id: "user-1", email: "a@b.com" };

const mockProject = {
  id: PROJECT,
  name: "Test Project",
  address: "1 Test St",
  postcode: "SW1A 1AA",
  region: "London",
} as never;

const mockBlob = new Blob(["%PDF"], { type: "application/pdf" });
const mockFilename = "refurb-genius-pitch-proj-pit-2026-01-01T00-00-00.pdf";
const mockPageCount = 4;

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

function stubFetchQuery(qc: QueryClient) {
  return vi
    .spyOn(qc, "fetchQuery")
    .mockImplementation(async (opts: { queryKey?: readonly unknown[] }) => {
      const key = opts.queryKey ?? [];
      const tail = key[key.length - 1];
      if (tail === "estimate") return null;
      if (tail === "financials") return null;
      if (tail === "photos") return [];
      if (tail === "photo-analysis" || String(key).includes("photo")) return [];
      if (tail === "floorplans" || String(key).includes("floorplan")) return [];
      // project detail
      return mockProject;
    });
}

function stubDownload() {
  const createObjectURL = vi.fn(() => "blob:mock-url");
  const revokeObjectURL = vi.fn();
  const click = vi.fn();
  const a = { href: "", download: "", click } as unknown as HTMLAnchorElement;
  const originalCreate = document.createElement.bind(document);
  const originalAppend = document.body.appendChild.bind(document.body);
  const originalRemove = document.body.removeChild.bind(document.body);

  vi.stubGlobal("URL", {
    createObjectURL,
    revokeObjectURL,
  });
  vi.spyOn(document, "createElement").mockImplementation(((tag: string, options?: unknown) => {
    if (tag === "a") return a as unknown as HTMLElement;
    return originalCreate(tag, options as ElementCreationOptions);
  }) as typeof document.createElement);
  vi.spyOn(document.body, "appendChild").mockImplementation(((node: Node) => {
    if (node === (a as unknown as Node)) return node;
    return originalAppend(node);
  }) as typeof document.body.appendChild);
  vi.spyOn(document.body, "removeChild").mockImplementation(((node: Node) => {
    if (node === (a as unknown as Node)) return node;
    return originalRemove(node);
  }) as typeof document.body.removeChild);

  return { createObjectURL, revokeObjectURL, click, a };
}

beforeEach(() => {
  getUser.mockReset();
  exportPitchDeck.mockReset();
  savePitchDeckExport.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
  loggerInfo.mockReset();
  loggerWarn.mockReset();
  loggerError.mockReset();
  getUser.mockReturnValue(USER);
  exportPitchDeck.mockResolvedValue({
    type: "pitch-deck",
    filename: mockFilename,
    blob: mockBlob,
    pageCount: mockPageCount,
    metadata: {},
  });
  savePitchDeckExport.mockResolvedValue({ storagePath: "u/p/f.pdf", recordId: "rec-1" });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useGenerateAndSavePitchDeck", () => {
  it("missing user: exact toast and zero fetch/generate/save/invalidate", async () => {
    getUser.mockReturnValue(null);
    const qc = createQc();
    const fetchSpy = vi.spyOn(qc, "fetchQuery");
    const invSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useGenerateAndSavePitchDeck({ projectId: PROJECT }), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(toastError).toHaveBeenCalledWith("You must be signed in to generate a pitch deck.");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(exportPitchDeck).not.toHaveBeenCalled();
    expect(savePitchDeckExport).not.toHaveBeenCalled();
    expect(invSpy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it("without project prop: six fetchQuery calls in parallel orchestration", async () => {
    const qc = createQc();
    const fetchSpy = stubFetchQuery(qc);
    stubDownload();
    const { result } = renderHook(() => useGenerateAndSavePitchDeck({ projectId: PROJECT }), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it("with project prop: skips project fetch (5 fetches)", async () => {
    const qc = createQc();
    const fetchSpy = stubFetchQuery(qc);
    stubDownload();
    const { result } = renderHook(
      () => useGenerateAndSavePitchDeck({ projectId: PROJECT, project: mockProject }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it("missing resolved project: outer failure toast, no save", async () => {
    const qc = createQc();
    vi.spyOn(qc, "fetchQuery").mockResolvedValue(null as never);
    const { result } = renderHook(() => useGenerateAndSavePitchDeck({ projectId: PROJECT }), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(toastError).toHaveBeenCalledWith(
      "Failed to generate pitch deck",
      expect.objectContaining({ description: "Project data not available." }),
    );
    expect(exportPitchDeck).not.toHaveBeenCalled();
    expect(savePitchDeckExport).not.toHaveBeenCalled();
  });

  it("happy path: generate once, download before save, flags true, invalidate after save", async () => {
    const qc = createQc();
    stubFetchQuery(qc);
    const { createObjectURL, revokeObjectURL, click, a } = stubDownload();
    const invSpy = vi.spyOn(qc, "invalidateQueries");
    const callOrder: string[] = [];

    exportPitchDeck.mockImplementation(
      async (req: {
        options?: {
          includePhotos?: boolean;
          include3D?: boolean;
          includeSensitivity?: boolean;
          onProgress?: (s: string, p?: number) => void;
        };
        data: unknown;
      }) => {
        callOrder.push("generate");
        expect(req.options?.includePhotos).toBe(true);
        expect(req.options?.include3D).toBe(true);
        expect(req.options?.includeSensitivity).toBe(true);
        req.options?.onProgress?.("generating-pdf", 70);
        return {
          type: "pitch-deck",
          filename: mockFilename,
          blob: mockBlob,
          pageCount: mockPageCount,
          metadata: {},
        };
      },
    );
    savePitchDeckExport.mockImplementation(
      async (input: {
        projectId: string;
        userId: string;
        blob: Blob;
        filename: string;
        pageCount: number;
      }) => {
        callOrder.push("save");
        expect(input).toEqual({
          projectId: PROJECT,
          userId: USER.id,
          blob: mockBlob,
          filename: mockFilename,
          pageCount: mockPageCount,
        });
        return { storagePath: "path", recordId: "rec-1" };
      },
    );
    invSpy.mockImplementation(async () => {
      callOrder.push("invalidate");
      return undefined as never;
    });

    const { result } = renderHook(
      () => useGenerateAndSavePitchDeck({ projectId: PROJECT, project: mockProject }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(exportPitchDeck).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(a.download).toBe(mockFilename);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    // download (createObjectURL) before save
    const genIdx = callOrder.indexOf("generate");
    const saveIdx = callOrder.indexOf("save");
    const invIdx = callOrder.indexOf("invalidate");
    expect(genIdx).toBeLessThan(saveIdx);
    expect(saveIdx).toBeLessThan(invIdx);

    expect(toastSuccess).toHaveBeenNthCalledWith(1, "Pitch deck generated", {
      description: `${mockFilename} (${mockPageCount} pages) — downloaded.`,
    });
    expect(toastSuccess).toHaveBeenNthCalledWith(2, "Saved to your project", {
      description: "Pitch deck record added. View history in app settings or reports.",
    });

    expect(invSpy).toHaveBeenCalledTimes(1);
    expect(invSpy.mock.calls[0]![0]).toEqual({
      queryKey: pitchDecksByProjectQueryOptions(PROJECT).queryKey,
    });
    expect(pitchDecksByProjectQueryOptions(PROJECT).queryKey).toEqual([
      "projects",
      PROJECT,
      "pitchDecks",
    ]);
    // estimate key remains product key (AO-1K1) — factory not altered
    expect(projectKeys.estimateByProject(PROJECT)).toEqual(["projects", PROJECT, "estimate"]);
  });

  it("cloud save failure: info toast, no invalidate, not outer failure", async () => {
    const qc = createQc();
    stubFetchQuery(qc);
    stubDownload();
    const invSpy = vi.spyOn(qc, "invalidateQueries");
    savePitchDeckExport.mockRejectedValue(new Error("upload failed"));

    const { result } = renderHook(
      () => useGenerateAndSavePitchDeck({ projectId: PROJECT, project: mockProject }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      "Pitch deck generated",
      expect.objectContaining({ description: expect.stringContaining(mockFilename) }),
    );
    expect(toastInfo).toHaveBeenCalledWith(
      "PDF downloaded. Cloud save skipped (check permissions or try again).",
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(invSpy).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalled();
  });

  it("PDF generation failure: outer error toast, no save", async () => {
    const qc = createQc();
    stubFetchQuery(qc);
    exportPitchDeck.mockRejectedValue(new Error("pdf boom"));

    const { result } = renderHook(
      () => useGenerateAndSavePitchDeck({ projectId: PROJECT, project: mockProject }),
      { wrapper: createWrapper(qc) },
    );

    await act(async () => {
      await result.current.generatePitchDeck();
    });

    expect(toastError).toHaveBeenCalledWith(
      "Failed to generate pitch deck",
      expect.objectContaining({ description: "pdf boom" }),
    );
    expect(savePitchDeckExport).not.toHaveBeenCalled();
  });

  it("isPending true during pipeline then clears after delayed reset", async () => {
    const qc = createQc();
    stubFetchQuery(qc);
    stubDownload();
    let resolveSave: (v: unknown) => void = () => {};
    savePitchDeckExport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { result } = renderHook(
      () => useGenerateAndSavePitchDeck({ projectId: PROJECT, project: mockProject }),
      { wrapper: createWrapper(qc) },
    );

    let done: Promise<void> | undefined;
    act(() => {
      done = result.current.generatePitchDeck();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveSave({ storagePath: "p", recordId: "r" });
      await done;
    });

    expect(result.current.isPending).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("source does not import persistence primitive or platform supabase", () => {
    const src = readFileSync(join(__dirname, "useGenerateAndSavePitchDeck.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']@\/lib\/pitchDeck["']/);
    expect(src).not.toMatch(/@\/platform\/supabase/);
    expect(src).not.toMatch(/storage\.from/);
    expect(src).not.toMatch(/pitch_deck_exports/);
    expect(src).toMatch(/supabaseExportRepository/);
    expect(src).toMatch(/legacyPdfExporter/);
    expect(src).toMatch(/pitchDecksByProjectQueryOptions/);
    expect(src).not.toMatch(/room-estimate/);
  });
});
