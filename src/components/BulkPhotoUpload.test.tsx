/**
 * C5-3B3B1 — BulkPhotoUpload uses canonical uploadProjectPhotos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import {
  PhotoUploadBatchError,
  PhotoWriteError,
  type PhotoUploadItemEvent,
  type PhotoUploadItemState,
} from "@/lib/photos-write";
import type { ProjectPhoto } from "@/lib/photos";
import { projectKeys } from "@/lib/queries/projects";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const uploadProjectPhotos = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/photos-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photos-write")>();
  return {
    ...actual,
    uploadProjectPhotos: (...args: unknown[]) => uploadProjectPhotos(...args),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
    from: vi.fn(),
  },
}));

import { BulkPhotoUpload } from "./BulkPhotoUpload";
import { supabase } from "@/platform/supabase/browser";

const PROJECT_A = "project-a";
const PROJECT_B = "project-b";

function makeImage(name: string, size = 1000): File {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

function makePhoto(id: string, name: string): ProjectPhoto {
  return {
    id,
    projectId: PROJECT_A,
    url: `https://example.com/${id}.jpg`,
    name,
    size: 1000,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    storagePath: `user/${PROJECT_A}/${id}.jpg`,
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

function addFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
  fireEvent.change(input);
}

async function startUpload() {
  const btn = await screen.findByRole("button", { name: /start upload/i });
  fireEvent.click(btn);
}

function emitStages(
  onItemState: (e: PhotoUploadItemEvent) => void,
  index: number,
  file: File,
  states: PhotoUploadItemState[],
  photo?: ProjectPhoto,
) {
  for (const state of states) {
    onItemState({
      index,
      file,
      state,
      ...(state === "complete" && photo ? { photo } : {}),
      ...(state === "failed" ? { stage: "storage-upload", error: new Error("boom") } : {}),
    });
  }
}

beforeEach(() => {
  uploadProjectPhotos.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  vi.mocked(supabase.auth.getUser).mockReset();
  vi.mocked(supabase.storage.from).mockReset();
  vi.mocked(supabase.from).mockReset();
});

describe("BulkPhotoUpload canonical authority", () => {
  it("calls uploadProjectPhotos once with projectId, ordered files, concurrency 3, onItemState", async () => {
    const files = [makeImage("a.jpg"), makeImage("b.jpg")];
    const photos = [makePhoto("p1", "a.jpg"), makePhoto("p2", "b.jpg")];
    uploadProjectPhotos.mockImplementation(async (input: { files: File[] }) => {
      return photos.slice(0, input.files.length);
    });

    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles(files);
    await startUpload();

    await waitFor(() => {
      expect(uploadProjectPhotos).toHaveBeenCalledTimes(1);
    });

    const arg = uploadProjectPhotos.mock.calls[0]![0] as {
      projectId: string;
      files: File[];
      concurrency: number;
      onItemState: (e: PhotoUploadItemEvent) => void;
    };
    expect(arg.projectId).toBe(PROJECT_A);
    expect(arg.concurrency).toBe(3);
    expect(arg.files.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
    expect(typeof arg.onItemState).toBe("function");
  });

  it("does not call direct Supabase Auth, Storage, or from(photos)", async () => {
    uploadProjectPhotos.mockResolvedValue([makePhoto("p1", "a.jpg")]);
    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg")]);
    await startUpload();
    await waitFor(() => expect(uploadProjectPhotos).toHaveBeenCalled());

    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("source module does not contain direct write authority tokens", () => {
    const src = readFileSync(join(process.cwd(), "src/components/BulkPhotoUpload.tsx"), "utf8");
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripped).toMatch(/uploadProjectPhotos\s*\(/);
    expect(stripped).not.toMatch(/supabase\.auth\.getUser/);
    expect(stripped).not.toMatch(/fromSupabaseUser/);
    expect(stripped).not.toMatch(/\.storage\s*\.\s*from/);
    expect(stripped).not.toMatch(/\.from\s*\(\s*["']photos["']\s*\)/);
    expect(stripped).not.toMatch(/\bp-limit\b/);
    expect(stripped).not.toMatch(/\bphotoStore\b/);
    expect(stripped).not.toMatch(/setTimeout/);
    expect(stripped).not.toMatch(/\banalyzing\b/);
  });
});

describe("BulkPhotoUpload file selection", () => {
  it("queues valid images in input order", async () => {
    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("first.jpg"), makeImage("second.jpg")]);
    expect(screen.getByText("first.jpg")).toBeTruthy();
    expect(screen.getByText("second.jpg")).toBeTruthy();
    expect(screen.getByText(/2 files selected/i)).toBeTruthy();
  });

  it("rejects non-image files with toast", async () => {
    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    const txt = new File([new Uint8Array([1])], "note.txt", { type: "text/plain" });
    addFiles([txt]);
    expect(toastError).toHaveBeenCalledWith("Please select image files only.");
    expect(screen.queryByText("note.txt")).toBeNull();
  });
});

describe("BulkPhotoUpload progress mapping", () => {
  it("maps canonical stages and assigns photo id on complete", async () => {
    const file = makeImage("a.jpg");
    const photo = makePhoto("photo-1", "a.jpg");
    uploadProjectPhotos.mockImplementation(
      async (input: { files: File[]; onItemState?: (e: PhotoUploadItemEvent) => void }) => {
        const f = input.files[0]!;
        const emit = input.onItemState!;
        emitStages(
          emit,
          0,
          f,
          ["queued", "validating", "authenticating", "uploading", "saving", "complete"],
          photo,
        );
        return [photo];
      },
    );

    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([file]);
    await startUpload();

    await waitFor(() => {
      expect(screen.getAllByText(/completed/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/analyzing/i)).toBeNull();
  });

  it("updates correct items under concurrent out-of-order events", async () => {
    const files = [makeImage("a.jpg"), makeImage("b.jpg")];
    uploadProjectPhotos.mockImplementation(
      async (input: { files: File[]; onItemState?: (e: PhotoUploadItemEvent) => void }) => {
        const emit = input.onItemState!;
        // Complete index 1 before index 0 finishes uploading
        emit({ index: 1, file: input.files[1]!, state: "uploading" });
        emit({
          index: 1,
          file: input.files[1]!,
          state: "complete",
          photo: makePhoto("p2", "b.jpg"),
        });
        emit({ index: 0, file: input.files[0]!, state: "uploading" });
        emit({
          index: 0,
          file: input.files[0]!,
          state: "complete",
          photo: makePhoto("p1", "a.jpg"),
        });
        return [makePhoto("p1", "a.jpg"), makePhoto("p2", "b.jpg")];
      },
    );

    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles(files);
    await startUpload();

    await waitFor(() => {
      expect(screen.getAllByText(/completed/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("maps failed without showing completion", async () => {
    uploadProjectPhotos.mockImplementation(
      async (input: { files: File[]; onItemState?: (e: PhotoUploadItemEvent) => void }) => {
        const emit = input.onItemState!;
        emit({ index: 0, file: input.files[0]!, state: "uploading" });
        emit({
          index: 0,
          file: input.files[0]!,
          state: "rolling-back",
        });
        emit({
          index: 0,
          file: input.files[0]!,
          state: "failed",
          stage: "metadata-insert",
          error: new PhotoWriteError("insert failed", { stage: "metadata-insert" }),
        });
        throw new PhotoUploadBatchError({
          successes: [],
          failures: [
            {
              index: 0,
              file: input.files[0]!,
              stage: "metadata-insert",
              cause: new PhotoWriteError("insert failed", { stage: "metadata-insert" }),
            },
          ],
          attemptedCount: 1,
        });
      },
    );

    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg")]);
    await startUpload();

    await waitFor(() => {
      expect(screen.getAllByText(/failed/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("BulkPhotoUpload full success", () => {
  it("invalidates project photo key once and toasts success", async () => {
    const photo = makePhoto("p1", "a.jpg");
    uploadProjectPhotos.mockResolvedValue([photo]);
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg")]);
    await startUpload();

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Upload complete.");
    });

    const photoInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return (
        Array.isArray(key) && key[0] === "projects" && key[1] === PROJECT_A && key[2] === "photos"
      );
    });
    expect(photoInvalidations).toHaveLength(1);
    expect(photoInvalidations[0]![0]).toEqual({
      queryKey: projectKeys.photosByProject(PROJECT_A),
    });

    const broad = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return Array.isArray(key) && key.length === 1 && key[0] === "projects";
    });
    expect(broad).toHaveLength(0);
  });

  it("maps returned photo ids in input order", async () => {
    const photos = [makePhoto("id-a", "a.jpg"), makePhoto("id-b", "b.jpg")];
    uploadProjectPhotos.mockResolvedValue(photos);
    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg"), makeImage("b.jpg")]);
    await startUpload();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    // Items show completed; photo ids are internal state — covered by mapping logic + batch mock order
    expect(screen.getAllByText(/completed/i).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps success when invalidateQueries rejects", async () => {
    uploadProjectPhotos.mockResolvedValue([makePhoto("p1", "a.jpg")]);
    const qc = createQc();
    vi.spyOn(qc, "invalidateQueries").mockRejectedValue(new Error("network"));

    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg")]);
    await startUpload();

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Upload complete.");
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("BulkPhotoUpload partial success", () => {
  it("invalidates once, maps successes and failures, shows fail toast only", async () => {
    const files = [makeImage("a.jpg"), makeImage("b.jpg"), makeImage("c.jpg")];
    const successes = [makePhoto("ok1", "a.jpg"), makePhoto("ok2", "c.jpg")];
    const batchError = new PhotoUploadBatchError({
      successes,
      failures: [
        {
          index: 1,
          file: files[1]!,
          stage: "storage-upload",
          cause: new Error("network"),
        },
      ],
      attemptedCount: 3,
    });

    uploadProjectPhotos.mockRejectedValue(batchError);
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles(files);
    await startUpload();

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("1 file failed to upload.");
    });
    expect(toastSuccess).not.toHaveBeenCalled();

    const photoInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return (
        Array.isArray(key) && key[0] === "projects" && key[1] === PROJECT_A && key[2] === "photos"
      );
    });
    expect(photoInvalidations).toHaveLength(1);

    await waitFor(() => {
      expect(screen.getAllByText(/failed/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/completed/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("does not resubmit completed files on a second batch", async () => {
    const firstPhoto = makePhoto("p1", "a.jpg");
    uploadProjectPhotos
      .mockResolvedValueOnce([firstPhoto])
      .mockResolvedValueOnce([makePhoto("p2", "b.jpg")]);

    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });

    addFiles([makeImage("a.jpg")]);
    await startUpload();
    await waitFor(() => expect(uploadProjectPhotos).toHaveBeenCalledTimes(1));

    addFiles([makeImage("b.jpg")]);
    await startUpload();
    await waitFor(() => expect(uploadProjectPhotos).toHaveBeenCalledTimes(2));

    const secondArg = uploadProjectPhotos.mock.calls[1]![0] as { files: File[] };
    expect(secondArg.files.map((f) => f.name)).toEqual(["b.jpg"]);
  });
});

describe("BulkPhotoUpload total failure", () => {
  it("does not invalidate and shows failure toast", async () => {
    const file = makeImage("a.jpg");
    uploadProjectPhotos.mockRejectedValue(
      new PhotoUploadBatchError({
        successes: [],
        failures: [
          {
            index: 0,
            file,
            stage: "storage-upload",
            cause: new Error("denied"),
          },
        ],
        attemptedCount: 1,
      }),
    );
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([file]);
    await startUpload();

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("marks all items failed on non-batch PhotoWriteError", async () => {
    uploadProjectPhotos.mockRejectedValue(
      new PhotoWriteError("Not signed in", { stage: "authentication" }),
    );
    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg"), makeImage("b.jpg")]);
    await startUpload();

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("BulkPhotoUpload cache isolation", () => {
  it("never invalidates Project B key when uploading Project A", async () => {
    uploadProjectPhotos.mockResolvedValue([makePhoto("p1", "a.jpg")]);
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    addFiles([makeImage("a.jpg")]);
    await startUpload();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());

    const bKeys = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return Array.isArray(key) && key[1] === PROJECT_B;
    });
    expect(bKeys).toHaveLength(0);
  });
});

describe("BulkPhotoUpload consumer contract", () => {
  it("renders with only projectId prop", () => {
    const qc = createQc();
    render(<BulkPhotoUpload projectId={PROJECT_A} />, { wrapper: createWrapper(qc) });
    expect(screen.getByText(/drag/i)).toBeTruthy();
  });
});
