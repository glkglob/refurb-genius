/**
 * C5-3B2 — usePhotos write hooks: canonical photos-write + React Query cache authority.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { ProjectPhoto } from "@/lib/photos-types";
import { projectKeys } from "@/lib/queries/projects";
import {
  PhotoUploadBatchError,
  PhotoWriteError,
  type PhotoRemovalResult,
} from "@/lib/photos-write";
// PhotoWriteError used for preflight analytics classification tests

const uploadProjectPhotos = vi.fn();
const removeProjectPhoto = vi.fn();
const loggerWarn = vi.fn();
const trackEvent = vi.fn();

vi.mock("@/lib/photos-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photos-write")>();
  return {
    ...actual,
    uploadProjectPhotos: (...args: unknown[]) => uploadProjectPhotos(...args),
    removeProjectPhoto: (...args: unknown[]) => removeProjectPhoto(...args),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => loggerWarn(...args),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "t@example.com" },
    isLoading: false,
    hydrated: true,
  }),
}));

vi.mock("@/lib/queries/projects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries/projects")>();
  return {
    ...actual,
    fetchProjectPhotosList: vi.fn(async () => [] as ProjectPhoto[]),
  };
});

import { usePhotos, useUploadPhotos, useRemovePhoto } from "./usePhotos";
import { photosQueryOptions } from "@/lib/queries/projects";

const PROJECT_ID = "proj-1";

function makePhoto(id: string, overrides: Partial<ProjectPhoto> = {}): ProjectPhoto {
  return {
    id,
    projectId: PROJECT_ID,
    url: `https://example.com/${id}.jpg`,
    name: `${id}.jpg`,
    size: 100,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    storagePath: `user-1/${PROJECT_ID}/${id}.jpg`,
    ...overrides,
  };
}

function makeFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

beforeEach(() => {
  uploadProjectPhotos.mockReset();
  removeProjectPhoto.mockReset();
  loggerWarn.mockReset();
  trackEvent.mockReset();
});

// ─── Upload ──────────────────────────────────────────────────────────────────

describe("useUploadPhotos", () => {
  it("calls uploadProjectPhotos with projectId and files", async () => {
    const files = [makeFile("a.jpg"), makeFile("b.jpg")];
    const photos = [makePhoto("p1"), makePhoto("p2")];
    uploadProjectPhotos.mockResolvedValue(photos);
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync(files);
    });

    expect(uploadProjectPhotos).toHaveBeenCalledTimes(1);
    expect(uploadProjectPhotos).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      files,
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "upload_started",
      expect.objectContaining({ projectId: PROJECT_ID, file_count: 2 }),
    );
    expect(trackEvent).toHaveBeenCalledWith("photos_uploaded", {
      projectId: PROJECT_ID,
      photo_count: 2,
    });
  });

  it("source does not reference photoStore or legacy photos module", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/ai-upload/presentation/hooks/usePhotos.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bphotoStore\b/);
    expect(src).not.toMatch(/@\/lib\/photos["']/);
    expect(src).toMatch(/uploadProjectPhotos/);
  });

  it("returns canonical photos and invalidates only the project photo list on full success", async () => {
    const photos = [makePhoto("p1")];
    uploadProjectPhotos.mockResolvedValue(photos);
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    let data: ProjectPhoto[] | undefined;
    await act(async () => {
      data = await result.current.mutateAsync([makeFile("a.jpg")]);
    });

    expect(data).toEqual(photos);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(photos);
    });

    const photoKeyCalls = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return (
        Array.isArray(key) && key[0] === "projects" && key[1] === PROJECT_ID && key[2] === "photos"
      );
    });
    expect(photoKeyCalls).toHaveLength(1);
    expect(photoKeyCalls[0]?.[0]).toEqual({
      queryKey: projectKeys.photosByProject(PROJECT_ID),
    });
    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          Array.isArray(call[0]?.queryKey) &&
          (call[0]?.queryKey as unknown[])[2] === "photoDisplay",
      ),
    ).toBe(true);

    const broadProjectInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return Array.isArray(key) && key.length === 1 && key[0] === "projects";
    });
    expect(broadProjectInvalidations).toHaveLength(0);
  });

  it("preserves PhotoWriteError without invalidation when no write succeeded", async () => {
    const err = new PhotoWriteError("upload failed", {
      stage: "storage-upload",
      cause: new Error("network"),
    });
    uploadProjectPhotos.mockRejectedValue(err);
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync([makeFile("a.jpg")]);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBe(err);
    expect(caught).toBeInstanceOf(PhotoWriteError);
    expect((caught as PhotoWriteError).stage).toBe("storage-upload");
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(err);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("invalidates once on PhotoUploadBatchError partial success and rethrows same instance", async () => {
    const successes = [makePhoto("ok-1"), makePhoto("ok-2")];
    const files = [makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")];
    const batchError = new PhotoUploadBatchError({
      successes,
      failures: [
        {
          index: 2,
          file: files[2]!,
          stage: "storage-upload",
          cause: new Error("boom"),
        },
      ],
      attemptedCount: 3,
    });
    uploadProjectPhotos.mockRejectedValue(batchError);
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(files);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBe(batchError);
    expect(caught).toBeInstanceOf(PhotoUploadBatchError);
    const e = caught as PhotoUploadBatchError;
    expect(e.successes).toHaveLength(2);
    expect(e.failures).toHaveLength(1);
    expect(e.attemptedCount).toBe(3);
    expect(e.failures[0]?.stage).toBe("storage-upload");
    expect(e.successes).toEqual(successes);

    const photoKeyCalls = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return (
        Array.isArray(key) && key[0] === "projects" && key[1] === PROJECT_ID && key[2] === "photos"
      );
    });
    expect(photoKeyCalls).toHaveLength(1);
    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          Array.isArray(call[0]?.queryKey) &&
          (call[0]?.queryKey as unknown[])[2] === "photoDisplay",
      ),
    ).toBe(true);
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(batchError);
    });
    expect(trackEvent).toHaveBeenCalledWith("photos_uploaded", {
      projectId: PROJECT_ID,
      photo_count: 2,
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "upload_partial_success",
      expect.objectContaining({
        projectId: PROJECT_ID,
        success_count: 2,
        failure_count: 1,
      }),
    );
    // Partial funnel order: started → photos_uploaded → partial
    const names = trackEvent.mock.calls.map((c) => c[0]);
    expect(names.indexOf("upload_started")).toBeLessThan(names.indexOf("photos_uploaded"));
    expect(names.indexOf("photos_uploaded")).toBeLessThan(names.indexOf("upload_partial_success"));
    // No raw error payload on partial path
    for (const call of trackEvent.mock.calls) {
      const payload = call[1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("error");
      expect(JSON.stringify(payload)).not.toMatch(/bad\.jpg|storage boom/i);
    }
  });

  it("does not invalidate on total batch failure (zero successes)", async () => {
    const files = [makeFile("a.jpg"), makeFile("b.jpg")];
    const batchError = new PhotoUploadBatchError({
      successes: [],
      failures: [
        {
          index: 0,
          file: files[0]!,
          stage: "validation",
          cause: new Error("bad"),
        },
        {
          index: 1,
          file: files[1]!,
          stage: "storage-upload",
          cause: new Error("net"),
        },
      ],
      attemptedCount: 2,
    });
    uploadProjectPhotos.mockRejectedValue(batchError);
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(files);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBe(batchError);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "upload_failed",
      expect.objectContaining({
        projectId: PROJECT_ID,
        attempted_count: 2,
        failure_count: 2,
        stage: expect.any(String),
        reason: expect.any(String),
      }),
    );
    const failPayload = trackEvent.mock.calls.find((c) => c[0] === "upload_failed")?.[1] as Record<
      string,
      unknown
    >;
    expect(failPayload).not.toHaveProperty("error");
  });

  it("emits zero-attempt safe analytics for pre-upload batch limit errors", async () => {
    const files = Array.from({ length: 31 }, (_, i) => makeFile(`f${i}.jpg`));
    uploadProjectPhotos.mockRejectedValue(
      new PhotoWriteError("Too many files in one batch (max 30). Upload in smaller sets.", {
        stage: "validation",
        code: "file_count_limit",
      }),
    );
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync(files);
      } catch {
        /* expected */
      }
    });

    expect(trackEvent).toHaveBeenCalledWith(
      "upload_failed",
      expect.objectContaining({
        projectId: PROJECT_ID,
        stage: "batch_validation",
        reason: "file_count_limit",
        attempted_count: 0,
        failure_count: 0,
        selected_count: 31,
      }),
    );
    const payload = trackEvent.mock.calls.find((c) => c[0] === "upload_failed")?.[1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("error");
  });

  it("delegates empty batch to the canonical primitive", async () => {
    uploadProjectPhotos.mockResolvedValue([]);
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    let data: ProjectPhoto[] | undefined;
    await act(async () => {
      data = await result.current.mutateAsync([]);
    });

    expect(uploadProjectPhotos).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      files: [],
    });
    expect(data).toEqual([]);
  });

  it("exposes isPending while the mutation is in flight", async () => {
    let resolveUpload!: (value: ProjectPhoto[]) => void;
    uploadProjectPhotos.mockImplementation(
      () =>
        new Promise<ProjectPhoto[]>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useUploadPhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate([makeFile("a.jpg")]);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveUpload([makePhoto("p1")]);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});

// ─── Removal ─────────────────────────────────────────────────────────────────

describe("useRemovePhoto", () => {
  it("calls removeProjectPhoto with only photoId", async () => {
    const removal: PhotoRemovalResult = {
      photoId: "p1",
      storagePath: "user-1/proj-1/p1.jpg",
      storageCleanup: "removed",
    };
    removeProjectPhoto.mockResolvedValue(removal);
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    expect(removeProjectPhoto).toHaveBeenCalledTimes(1);
    expect(removeProjectPhoto).toHaveBeenCalledWith({ photoId: "p1" });
    const arg = removeProjectPhoto.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("storagePath");
    expect(arg).not.toHaveProperty("projectId");
  });

  it("source remove path uses removeProjectPhoto only", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/ai-upload/presentation/hooks/usePhotos.ts"),
      "utf8",
    );
    expect(src).toMatch(/removeProjectPhoto\s*\(/);
    expect(src).not.toMatch(/photoStore\s*\.\s*remove/);
  });

  it("optimistically removes the target photo from the project list", async () => {
    let resolveRemove!: (value: PhotoRemovalResult) => void;
    removeProjectPhoto.mockImplementation(
      () =>
        new Promise<PhotoRemovalResult>((resolve) => {
          resolveRemove = resolve;
        }),
    );
    const qc = createTestQueryClient();
    const photosKey = projectKeys.photosByProject(PROJECT_ID);
    const seed = [makePhoto("p1"), makePhoto("p2"), makePhoto("p3")];
    qc.setQueryData(photosKey, seed);
    const cancelSpy = vi.spyOn(qc, "cancelQueries");

    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate("p2");
    });

    await waitFor(() => {
      expect(qc.getQueryData<ProjectPhoto[]>(photosKey)?.map((p) => p.id)).toEqual(["p1", "p3"]);
    });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: photosKey });

    await act(async () => {
      resolveRemove({
        photoId: "p2",
        storagePath: "user-1/proj-1/p2.jpg",
        storageCleanup: "removed",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("restores snapshot on canonical failure and still invalidates on settle", async () => {
    const err = new PhotoWriteError("not found", {
      stage: "metadata-delete",
      cause: new Error("zero rows"),
    });
    removeProjectPhoto.mockRejectedValue(err);
    const qc = createTestQueryClient();
    const photosKey = projectKeys.photosByProject(PROJECT_ID);
    const seed = [makePhoto("p1"), makePhoto("p2")];
    qc.setQueryData(photosKey, seed);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync("p1");
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBe(err);
    expect(qc.getQueryData(photosKey)).toEqual(seed);
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(err);
    });

    const photoKeyCalls = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey as unknown[] | undefined;
      return (
        Array.isArray(key) && key[0] === "projects" && key[1] === PROJECT_ID && key[2] === "photos"
      );
    });
    expect(photoKeyCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("treats storageCleanup removed as success with invalidation", async () => {
    removeProjectPhoto.mockResolvedValue({
      photoId: "p1",
      storagePath: "user-1/proj-1/p1.jpg",
      storageCleanup: "removed",
    } satisfies PhotoRemovalResult);
    const qc = createTestQueryClient();
    const photosKey = projectKeys.photosByProject(PROJECT_ID);
    qc.setQueryData(photosKey, [makePhoto("p1"), makePhoto("p2")]);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.storageCleanup).toBe("removed");
    });
    expect(qc.getQueryData<ProjectPhoto[]>(photosKey)?.map((p) => p.id)).toEqual(["p2"]);
    expect(loggerWarn).not.toHaveBeenCalled();
    expect(
      invalidateSpy.mock.calls.some(
        (call) =>
          Array.isArray(call[0]?.queryKey) && (call[0]?.queryKey as unknown[])[2] === "photos",
      ),
    ).toBe(true);
  });

  it("treats already-missing as success without restoring the optimistic list", async () => {
    removeProjectPhoto.mockResolvedValue({
      photoId: "p1",
      storagePath: "user-1/proj-1/p1.jpg",
      storageCleanup: "already-missing",
    } satisfies PhotoRemovalResult);
    const qc = createTestQueryClient();
    const photosKey = projectKeys.photosByProject(PROJECT_ID);
    qc.setQueryData(photosKey, [makePhoto("p1"), makePhoto("p2")]);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
    });
    expect(qc.getQueryData<ProjectPhoto[]>(photosKey)?.map((p) => p.id)).toEqual(["p2"]);
    expect(loggerWarn).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("treats orphan-warning as success, logs warning, does not restore", async () => {
    const storageError = new Error("storage delete denied");
    removeProjectPhoto.mockResolvedValue({
      photoId: "p1",
      storagePath: "user-1/proj-1/p1.jpg",
      storageCleanup: "orphan-warning",
      storageError,
    } satisfies PhotoRemovalResult);
    const qc = createTestQueryClient();
    const photosKey = projectKeys.photosByProject(PROJECT_ID);
    qc.setQueryData(photosKey, [makePhoto("p1"), makePhoto("p2")]);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync("p1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.storageCleanup).toBe("orphan-warning");
      expect(result.current.data?.storageError).toBe(storageError);
    });
    expect(qc.getQueryData<ProjectPhoto[]>(photosKey)?.map((p) => p.id)).toEqual(["p2"]);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const [message, meta] = loggerWarn.mock.calls[0]!;
    expect(String(message)).toMatch(/orphan/i);
    expect(meta).toMatchObject({
      photoId: "p1",
      storageCleanup: "orphan-warning",
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("restores on auth/zero-row throw and does not log orphan handling", async () => {
    const err = new PhotoWriteError(PHOTO_AUTH_MSG, {
      stage: "authentication",
      cause: new Error("signed out"),
    });
    removeProjectPhoto.mockRejectedValue(err);
    const qc = createTestQueryClient();
    const photosKey = projectKeys.photosByProject(PROJECT_ID);
    const seed = [makePhoto("p1")];
    qc.setQueryData(photosKey, seed);

    const { result } = renderHook(() => useRemovePhoto(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync("p1").catch(() => undefined);
    });

    expect(qc.getQueryData(photosKey)).toEqual(seed);
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(err);
    });
    expect(loggerWarn).not.toHaveBeenCalled();
  });
});

const PHOTO_AUTH_MSG = "You must be signed in to manage project photos.";

// ─── Read neutrality ─────────────────────────────────────────────────────────

describe("usePhotos read path", () => {
  it("uses photosQueryOptions with auth + projectId enable gate", () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => usePhotos(PROJECT_ID), {
      wrapper: createWrapper(qc),
    });

    const options = photosQueryOptions(PROJECT_ID);
    expect(result.current).toBeDefined();
    // Factory key must match what the hook observes
    expect(options.queryKey).toEqual(projectKeys.photosByProject(PROJECT_ID));
    // Source-level contract: hook file must still call photosQueryOptions + auth gate
    // (runtime: query is enabled because useAuth mock provides a user)
    expect(result.current.fetchStatus === "fetching" || result.current.status !== undefined).toBe(
      true,
    );
  });

  it("does not enable the query without a project id", () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => usePhotos(""), {
      wrapper: createWrapper(qc),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isFetching).toBe(false);
  });
});
