/**
 * AO-1M3 — useUpsertGalleryProject: auth, optimistic cache, repository mapping, invalidation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { galleryKeys, type PublicGalleryProjectRow } from "@/lib/queries/gallery";

const getUser = vi.hoisted(() => vi.fn());
const upsertGalleryProject = vi.hoisted(() => vi.fn());
const revokeCoverMock = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser: (...args: unknown[]) => getUser(...args),
  },
}));

vi.mock("../../infrastructure/galleryRepository", () => ({
  galleryRepository: {
    upsertGalleryProject: (...args: unknown[]) => upsertGalleryProject(...args),
  },
  upsertGalleryProject: (...args: unknown[]) => upsertGalleryProject(...args),
}));

vi.mock("@/features/gallery/infrastructure", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/gallery/infrastructure")>();
  return {
    ...actual,
    revokeGalleryCover: (...args: unknown[]) => revokeCoverMock(...args),
    createGalleryCoverLifecycle: () => ({
      revokeCover: (...args: unknown[]) => revokeCoverMock(...args),
    }),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  gallerySaveFeedback,
  GalleryCoverCleanupBusyError,
  GalleryUnpublishPrivacyError,
  useUpsertGalleryProject,
  type UpsertGalleryProjectResult,
} from "./useUpsertGalleryProject";

const PROJECT_A = "proj-a";
const PROJECT_B = "proj-b";
const USER = { id: "user-1", email: "a@b.com" };

const previousRow: PublicGalleryProjectRow = {
  id: "gal-existing",
  project_id: PROJECT_A,
  is_public: false,
  featured: false,
  title: "Previous Title",
  description: "Previous desc",
  cover_image_url: "https://example.com/old.jpg",
  view_count: 5,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const serverRow: PublicGalleryProjectRow = {
  ...previousRow,
  is_public: true,
  featured: true,
  title: "Saved Title",
  view_count: 5,
  updated_at: "2026-01-03T00:00:00.000Z",
};

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

describe("useUpsertGalleryProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue(USER);
    upsertGalleryProject.mockResolvedValue(serverRow);
    revokeCoverMock.mockResolvedValue({ status: "already_absent" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects missing user without repository call", async () => {
    getUser.mockReturnValue(null);
    const qc = createQc();
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          is_public: true,
          featured: false,
          title: "T",
          description: null,
          cover_image_url: null,
        }),
      ).rejects.toThrow("You must be signed in");
    });

    expect(upsertGalleryProject).not.toHaveBeenCalled();
  });

  it("maps projectId, userId and all fields to the repository", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        is_public: true,
        featured: true,
        title: "Victorian Terrace",
        description: "Full refurb",
        cover_image_url: "https://example.com/cover.jpg",
      });
    });

    expect(upsertGalleryProject).toHaveBeenCalledWith({
      projectId: PROJECT_A,
      userId: USER.id,
      is_public: true,
      featured: true,
      title: "Victorian Terrace",
      description: "Full refurb",
      cover_image_url: "https://example.com/cover.jpg",
    });
  });

  it("returns the repository row", async () => {
    const qc = createQc();
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    let payload: UpsertGalleryProjectResult | undefined;
    await act(async () => {
      payload = await result.current.mutateAsync({ is_public: true });
    });
    expect(payload).toEqual({
      gallery: serverRow,
      obsoleteCoverCleanup: null,
      pendingCoverCleanup: null,
    });
  });

  it("optimistically merges into previous cache and cancels the canonical key", async () => {
    const qc = createQc();
    const key = galleryKeys.byProject(PROJECT_A);
    qc.setQueryData(key, previousRow);

    const cancelSpy = vi.spyOn(qc, "cancelQueries");
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    let resolveUpsert: (v: PublicGalleryProjectRow) => void = () => undefined;
    upsertGalleryProject.mockImplementation(
      () =>
        new Promise<PublicGalleryProjectRow>((resolve) => {
          resolveUpsert = resolve;
        }),
    );

    act(() => {
      result.current.mutate({
        is_public: true,
        featured: true,
        title: null,
        description: null,
        cover_image_url: null,
      });
    });

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith({ queryKey: key });
    });

    const optimistic = qc.getQueryData<PublicGalleryProjectRow>(key);
    expect(optimistic).toMatchObject({
      id: "gal-existing",
      project_id: PROJECT_A,
      is_public: true,
      featured: true,
      title: "Previous Title",
      description: null,
      cover_image_url: null,
      view_count: 5,
    });
    expect(optimistic?.updated_at).not.toBe(previousRow.updated_at);

    await act(async () => {
      resolveUpsert(serverRow);
    });
  });

  it("uses fallback row when previous cache is absent", async () => {
    const qc = createQc();
    const key = galleryKeys.byProject(PROJECT_A);

    let resolveUpsert: (v: PublicGalleryProjectRow) => void = () => undefined;
    upsertGalleryProject.mockImplementation(
      () =>
        new Promise<PublicGalleryProjectRow>((resolve) => {
          resolveUpsert = resolve;
        }),
    );

    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({
        is_public: true,
        featured: false,
      });
    });

    await waitFor(() => {
      const optimistic = qc.getQueryData<PublicGalleryProjectRow>(key);
      expect(optimistic).toBeTruthy();
      expect(optimistic).toMatchObject({
        id: "",
        project_id: PROJECT_A,
        is_public: true,
        featured: false,
        title: "Untitled Project",
        description: null,
        cover_image_url: null,
        view_count: 0,
      });
      expect(optimistic).not.toHaveProperty("created_by");
      expect(optimistic).not.toHaveProperty("slug");
    });

    await act(async () => {
      resolveUpsert(serverRow);
    });
  });

  it("rolls back to previous row on error and still invalidates", async () => {
    const qc = createQc();
    const key = galleryKeys.byProject(PROJECT_A);
    qc.setQueryData(key, previousRow);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    upsertGalleryProject.mockRejectedValue(new Error("RLS denied"));

    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ is_public: true, featured: true });
      } catch {
        // expected
      }
    });

    expect(qc.getQueryData(key)).toEqual(previousRow);
    expect(loggerError).toHaveBeenCalledWith(
      "[gallery] upsert mutation error",
      expect.objectContaining({ projectId: PROJECT_A, error: "RLS denied" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: galleryKeys.publicList() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...galleryKeys.all, "byId"] });
  });

  it("on error with no prior row: restores previous snapshot and still invalidates", async () => {
    // Baseline: previous is undefined; setQueryData(key, undefined) is a no-op in
    // TanStack Query (updater/data undefined skips write). onSettled invalidation
    // remains the reconciliation path — same as pre-extraction useGallery.
    const qc = createQc();
    const key = galleryKeys.byProject(PROJECT_A);
    const setSpy = vi.spyOn(qc, "setQueryData");
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    upsertGalleryProject.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ is_public: true });
      } catch {
        // expected
      }
    });

    expect(setSpy).toHaveBeenCalledWith(key, undefined);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: galleryKeys.publicList() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...galleryKeys.all, "byId"] });
    expect(loggerError).toHaveBeenCalledWith(
      "[gallery] upsert mutation error",
      expect.objectContaining({ projectId: PROJECT_A, error: "network" }),
    );
  });

  it("invalidates owner, public list, and public detail keys on success", async () => {
    const qc = createQc();
    const key = galleryKeys.byProject(PROJECT_A);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ is_public: true });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: galleryKeys.publicList() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [...galleryKeys.all, "byId"] });
    expect(
      invalidateSpy.mock.calls.some((call) => {
        const arg = call[0] as { queryKey?: readonly unknown[] };
        return Array.isArray(arg.queryKey) && arg.queryKey.includes("leads");
      }),
    ).toBe(false);
  });

  it("exposes pending state while mutation is in flight", async () => {
    const qc = createQc();
    let resolveUpsert: (v: PublicGalleryProjectRow) => void = () => undefined;
    upsertGalleryProject.mockImplementation(
      () =>
        new Promise<PublicGalleryProjectRow>((resolve) => {
          resolveUpsert = resolve;
        }),
    );

    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      result.current.mutate({ is_public: true });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveUpsert(serverRow);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("isolates cache keys by projectId across hook instances", async () => {
    const qc = createQc();
    const keyA = galleryKeys.byProject(PROJECT_A);
    const keyB = galleryKeys.byProject(PROJECT_B);
    expect(keyA).toEqual(["projects", PROJECT_A, "gallery"]);
    expect(keyB).toEqual(["projects", PROJECT_B, "gallery"]);
    expect(keyA).not.toEqual(keyB);

    qc.setQueryData(keyA, previousRow);
    qc.setQueryData(keyB, { ...previousRow, project_id: PROJECT_B, id: "gal-b" });

    let resolveA: (v: PublicGalleryProjectRow) => void = () => undefined;
    upsertGalleryProject.mockImplementation(
      () =>
        new Promise<PublicGalleryProjectRow>((resolve) => {
          resolveA = resolve;
        }),
    );

    const hookA = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });
    const hookB = renderHook(() => useUpsertGalleryProject(PROJECT_B), {
      wrapper: createWrapper(qc),
    });

    act(() => {
      hookA.result.current.mutate({ is_public: true });
    });

    await waitFor(() => {
      expect(qc.getQueryData<PublicGalleryProjectRow>(keyA)?.is_public).toBe(true);
    });
    // B unchanged while A is in-flight
    expect(qc.getQueryData<PublicGalleryProjectRow>(keyB)?.is_public).toBe(false);

    await act(async () => {
      resolveA(serverRow);
    });

    expect(hookB.result.current).toBeTruthy();
  });
});

const publicRow: PublicGalleryProjectRow = {
  ...previousRow,
  is_public: true,
  cover_image_url: "https://example.supabase.co/storage/v1/object/public/gallery/u/p/old.jpg",
};

const NEW_COVER = "https://example.supabase.co/storage/v1/object/public/gallery/u/p/new.jpg";

describe("useUpsertGalleryProject cover lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue(USER);
    upsertGalleryProject.mockResolvedValue({
      ...publicRow,
      is_public: false,
      cover_image_url: null,
    });
    revokeCoverMock.mockResolvedValue({ status: "deleted" });
  });

  it("revokes the listing cover then persists private + null cover on unpublish", async () => {
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        is_public: false,
        featured: false,
        title: publicRow.title,
        description: publicRow.description,
        cover_image_url: publicRow.cover_image_url,
      });
    });

    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: publicRow.cover_image_url });
    expect(upsertGalleryProject).toHaveBeenCalledWith(
      expect.objectContaining({
        is_public: false,
        cover_image_url: null,
      }),
    );
    expect(revokeCoverMock.mock.invocationCallOrder[0]!).toBeLessThan(
      upsertGalleryProject.mock.invocationCallOrder[0]!,
    );
  });

  it("unpublishes when the cover is already absent", async () => {
    revokeCoverMock.mockResolvedValue({ status: "already_absent" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), { ...publicRow, cover_image_url: null });
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ is_public: false, cover_image_url: null });
    });

    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: null });
    expect(upsertGalleryProject).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: false, cover_image_url: null }),
    );
  });

  it("does not persist unpublish when cover revoke fails", async () => {
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "storage remove denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          is_public: false,
          cover_image_url: publicRow.cover_image_url,
        }),
      ).rejects.toBeInstanceOf(GalleryUnpublishPrivacyError);
    });

    expect(upsertGalleryProject).not.toHaveBeenCalled();
    expect(qc.getQueryData(galleryKeys.byProject(PROJECT_A))).toEqual(publicRow);
  });

  it("revokes the previous cover after a successful replacement persist", async () => {
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    const payload = await result.current.mutateAsync({
      is_public: true,
      cover_image_url: NEW_COVER,
    });

    expect(upsertGalleryProject).toHaveBeenCalled();
    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: publicRow.cover_image_url });
    expect(payload.obsoleteCoverCleanup).toEqual({ status: "deleted" });
    expect(upsertGalleryProject.mock.invocationCallOrder[0]!).toBeLessThan(
      revokeCoverMock.mock.invocationCallOrder[0]!,
    );
  });

  it("keeps the new cover and surfaces failed old-cover cleanup", async () => {
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "cleanup denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    let payload: UpsertGalleryProjectResult | undefined;
    await act(async () => {
      payload = await result.current.mutateAsync({
        is_public: true,
        cover_image_url: NEW_COVER,
      });
    });

    if (!payload) throw new Error("expected mutation payload");
    expect(payload.gallery.cover_image_url).toBe(NEW_COVER);
    expect(payload.obsoleteCoverCleanup).toEqual({ status: "failed", error: "cleanup denied" });
    expect(payload.pendingCoverCleanup).toEqual({
      projectId: PROJECT_A,
      coverImageUrl: publicRow.cover_image_url,
      error: "cleanup denied",
      kind: "obsolete",
    });
    expect(gallerySaveFeedback(payload, null).message).toMatch(
      /previous cover image could not be removed/,
    );
    expect(gallerySaveFeedback(payload, null).message).not.toMatch(/save again/i);
  });

  it("does not revoke when the new cover URL equals the current cover", async () => {
    upsertGalleryProject.mockResolvedValue(publicRow);
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        is_public: true,
        cover_image_url: publicRow.cover_image_url,
      });
    });

    expect(revokeCoverMock).not.toHaveBeenCalled();
  });

  it("attempts compensation revoke of a new cover when upsert fails", async () => {
    upsertGalleryProject.mockRejectedValue(new Error("RLS denied"));
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ is_public: true, cover_image_url: NEW_COVER }),
      ).rejects.toThrow("RLS denied");
    });

    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: NEW_COVER });
  });

  it("retains the exact new cover URL when compensation revoke fails", async () => {
    upsertGalleryProject.mockRejectedValue(new Error("RLS denied"));
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "compensation denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ is_public: true, cover_image_url: NEW_COVER }),
      ).rejects.toThrow("RLS denied");
    });

    await waitFor(() => {
      expect(result.current.pendingCoverCleanup).toEqual({
        projectId: PROJECT_A,
        coverImageUrl: NEW_COVER,
        error: "compensation denied",
        kind: "compensation",
      });
    });
  });

  it("retries revoke of retained A and never revokes current B", async () => {
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "cleanup denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        is_public: true,
        cover_image_url: NEW_COVER,
      });
    });

    await waitFor(() => {
      expect(result.current.pendingCoverCleanup?.coverImageUrl).toBe(publicRow.cover_image_url);
    });
    expect(
      qc.getQueryData<PublicGalleryProjectRow>(galleryKeys.byProject(PROJECT_A)),
    ).toMatchObject({ cover_image_url: NEW_COVER });

    revokeCoverMock.mockClear();
    revokeCoverMock.mockResolvedValue({ status: "deleted" });

    let retryResult: Awaited<ReturnType<typeof result.current.retryPendingCoverCleanup>>;
    await act(async () => {
      retryResult = await result.current.retryPendingCoverCleanup();
    });

    expect(retryResult!).toEqual({ status: "deleted" });
    expect(revokeCoverMock).toHaveBeenCalledTimes(1);
    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: publicRow.cover_image_url });
    expect(revokeCoverMock).not.toHaveBeenCalledWith({ coverImageUrl: NEW_COVER });
    expect(result.current.pendingCoverCleanup).toBeNull();
  });

  it("clears pending A when retry reports already_absent", async () => {
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "cleanup denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ is_public: true, cover_image_url: NEW_COVER });
    });
    await waitFor(() => {
      expect(result.current.pendingCoverCleanup?.coverImageUrl).toBe(publicRow.cover_image_url);
    });

    revokeCoverMock.mockResolvedValue({ status: "already_absent" });
    await act(async () => {
      await result.current.retryPendingCoverCleanup();
    });
    expect(result.current.pendingCoverCleanup).toBeNull();
  });

  it("keeps exact A when retry fails", async () => {
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "cleanup denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ is_public: true, cover_image_url: NEW_COVER });
    });

    revokeCoverMock.mockResolvedValue({ status: "failed", error: "still denied" });
    await act(async () => {
      await result.current.retryPendingCoverCleanup();
    });

    expect(result.current.pendingCoverCleanup).toEqual({
      projectId: PROJECT_A,
      coverImageUrl: publicRow.cover_image_url,
      error: "still denied",
      kind: "obsolete",
    });
  });

  it("does not treat a later save of B as cleanup of A", async () => {
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "cleanup denied" });
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result } = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ is_public: true, cover_image_url: NEW_COVER });
    });
    const retainedA = result.current.pendingCoverCleanup?.coverImageUrl;
    expect(retainedA).toBe(publicRow.cover_image_url);

    revokeCoverMock.mockClear();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: NEW_COVER });
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), {
      ...publicRow,
      cover_image_url: NEW_COVER,
    });

    await act(async () => {
      await result.current.mutateAsync({ is_public: true, cover_image_url: NEW_COVER });
    });

    expect(revokeCoverMock).not.toHaveBeenCalled();
    expect(result.current.pendingCoverCleanup?.coverImageUrl).toBe(retainedA);
  });
});

describe("gallerySaveFeedback", () => {
  it("distinguishes unpublish privacy failure from save failure and cleanup warning", () => {
    expect(gallerySaveFeedback(null, new GalleryUnpublishPrivacyError()).tone).toBe("error");
    expect(gallerySaveFeedback(null, new Error("RLS denied")).message).toBe("RLS denied");
    expect(
      gallerySaveFeedback(
        {
          gallery: serverRow,
          obsoleteCoverCleanup: { status: "failed", error: "x" },
          pendingCoverCleanup: {
            projectId: PROJECT_A,
            coverImageUrl: "https://example.com/old.jpg",
            error: "x",
            kind: "obsolete",
          },
        },
        null,
      ).tone,
    ).toBe("error");
    expect(
      gallerySaveFeedback(
        {
          gallery: serverRow,
          obsoleteCoverCleanup: { status: "deleted" },
          pendingCoverCleanup: null,
        },
        null,
      ),
    ).toEqual({ tone: "success", message: "Gallery settings saved" });
  });
});

describe("PublishToGallery cleanup retry wiring", () => {
  it("exposes Retry cleanup and does not tell the owner to save again", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/gallery/PublishToGallery.tsx"),
      "utf8",
    );
    expect(source).toMatch(/retryPendingCoverCleanup/);
    expect(source).toMatch(/Retry cleanup/);
    expect(source).toMatch(/pendingCoverCleanups/);
    expect(source).toMatch(/previous cover images still need cleanup/);
    expect(source).toMatch(/isRetryingCoverCleanup/);
    expect(source).not.toMatch(/Try saving again/);
    expect(source).not.toMatch(/save again/i);
  });
});

const COVER_A = publicRow.cover_image_url!;
const COVER_B = NEW_COVER;
const COVER_C = "https://example.supabase.co/storage/v1/object/public/gallery/u/p/C.jpg";
const COVER_D = "https://example.supabase.co/storage/v1/object/public/gallery/u/p/D.jpg";

function pendingUrls(result: { current: { pendingCoverCleanups: { coverImageUrl: string }[] } }) {
  return result.current.pendingCoverCleanups.map((entry) => entry.coverImageUrl);
}

describe("useUpsertGalleryProject multi-pending cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockReturnValue(USER);
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_B });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "cleanup denied" });
  });

  async function seedPendingA() {
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const hook = renderHook(() => useUpsertGalleryProject(PROJECT_A), {
      wrapper: createWrapper(qc),
    });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_B });
    });
    await waitFor(() => {
      expect(pendingUrls(hook.result)).toEqual([COVER_A]);
    });
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), { ...publicRow, cover_image_url: COVER_B });
    return { qc, hook };
  }

  it("accumulates B when A is already pending and revoke(B) fails", async () => {
    const { qc, hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B denied" });

    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_B]);
    expect(hook.result.current.pendingCoverCleanups[0]?.projectId).toBe(PROJECT_A);
    expect(
      qc.getQueryData<PublicGalleryProjectRow>(galleryKeys.byProject(PROJECT_A)),
    ).toMatchObject({ cover_image_url: COVER_C });
  });

  it("keeps only A when pending A and revoke(B) succeeds on B→C", async () => {
    const { hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "deleted" });

    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A]);
    expect(revokeCoverMock).toHaveBeenLastCalledWith({ coverImageUrl: COVER_B });
  });

  it("retries A and B independently and success removes only the target", async () => {
    const { hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B denied" });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });
    expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_B]);

    revokeCoverMock.mockClear();
    revokeCoverMock.mockResolvedValue({ status: "deleted" });
    await act(async () => {
      await hook.result.current.retryPendingCoverCleanup(COVER_A);
    });
    expect(revokeCoverMock).toHaveBeenCalledTimes(1);
    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: COVER_A });
    expect(revokeCoverMock).not.toHaveBeenCalledWith({ coverImageUrl: COVER_B });
    expect(revokeCoverMock).not.toHaveBeenCalledWith({ coverImageUrl: COVER_C });
    expect(pendingUrls(hook.result)).toEqual([COVER_B]);

    revokeCoverMock.mockClear();
    revokeCoverMock.mockResolvedValue({ status: "already_absent" });
    await act(async () => {
      await hook.result.current.retryPendingCoverCleanup({ coverImageUrl: COVER_B });
    });
    expect(revokeCoverMock).toHaveBeenCalledWith({ coverImageUrl: COVER_B });
    expect(pendingUrls(hook.result)).toEqual([]);
  });

  it("failed retry of A retains A and B", async () => {
    const { hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B denied" });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });

    revokeCoverMock.mockResolvedValue({ status: "failed", error: "A still denied" });
    await act(async () => {
      await hook.result.current.retryPendingCoverCleanup(COVER_A);
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_B]);
    expect(hook.result.current.pendingCoverCleanups[0]?.error).toBe("A still denied");
  });

  it("compensation failure appends C and keeps A", async () => {
    const { hook } = await seedPendingA();
    upsertGalleryProject.mockRejectedValue(new Error("RLS denied"));
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "C compensation denied" });

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C }),
      ).rejects.toThrow("RLS denied");
    });

    await waitFor(() => {
      expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_C]);
    });
    expect(hook.result.current.pendingCoverCleanups[1]).toMatchObject({
      projectId: PROJECT_A,
      coverImageUrl: COVER_C,
      kind: "compensation",
    });
  });

  it("successful compensation revoke keeps existing A", async () => {
    const { hook } = await seedPendingA();
    upsertGalleryProject.mockRejectedValue(new Error("RLS denied"));
    revokeCoverMock.mockResolvedValue({ status: "deleted" });

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C }),
      ).rejects.toThrow("RLS denied");
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A]);
    expect(revokeCoverMock).toHaveBeenLastCalledWith({ coverImageUrl: COVER_C });
  });

  it("accumulates a third failed obsolete cover", async () => {
    const { qc, hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B denied" });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), { ...publicRow, cover_image_url: COVER_C });

    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_D });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "C denied" });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_D });
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_B, COVER_C]);
  });

  it("deduplicates the same projectId+URL and does not drop siblings", async () => {
    const { hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B denied" });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });

    revokeCoverMock.mockResolvedValue({ status: "failed", error: "A again" });
    await act(async () => {
      await hook.result.current.retryPendingCoverCleanup(COVER_A);
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_B]);
    expect(
      hook.result.current.pendingCoverCleanups.filter((e) => e.coverImageUrl === COVER_A),
    ).toHaveLength(1);
    expect(hook.result.current.pendingCoverCleanups[0]?.error).toBe("A again");
  });

  it("keeps pending A after successful unpublish of current B", async () => {
    const { qc, hook } = await seedPendingA();
    revokeCoverMock.mockResolvedValue({ status: "deleted" });
    upsertGalleryProject.mockResolvedValue({
      ...publicRow,
      is_public: false,
      cover_image_url: null,
    });

    await act(async () => {
      await hook.result.current.mutateAsync({
        is_public: false,
        cover_image_url: COVER_B,
      });
    });

    expect(upsertGalleryProject).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: false, cover_image_url: null }),
    );
    expect(pendingUrls(hook.result)).toEqual([COVER_A]);
    expect(revokeCoverMock).toHaveBeenLastCalledWith({ coverImageUrl: COVER_B });
    expect(
      qc.getQueryData<PublicGalleryProjectRow>(galleryKeys.byProject(PROJECT_A)),
    ).toMatchObject({
      is_public: false,
      cover_image_url: null,
    });
  });

  it("keeps [A,B] after unpublish when those objects were not revoked", async () => {
    const { qc, hook } = await seedPendingA();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_C });
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B denied" });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C });
    });
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), { ...publicRow, cover_image_url: COVER_C });

    revokeCoverMock.mockResolvedValue({ status: "deleted" });
    upsertGalleryProject.mockResolvedValue({
      ...publicRow,
      is_public: false,
      cover_image_url: null,
    });
    await act(async () => {
      await hook.result.current.mutateAsync({ is_public: false, cover_image_url: COVER_C });
    });

    expect(pendingUrls(hook.result)).toEqual([COVER_A, COVER_B]);
  });

  it("failed unpublish revoke leaves listing public and pending unchanged", async () => {
    const { qc, hook } = await seedPendingA();
    revokeCoverMock.mockResolvedValue({ status: "failed", error: "B still public" });

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ is_public: false, cover_image_url: COVER_B }),
      ).rejects.toBeInstanceOf(GalleryUnpublishPrivacyError);
    });

    expect(upsertGalleryProject).toHaveBeenCalledTimes(1);
    expect(pendingUrls(hook.result)).toEqual([COVER_A]);
    expect(qc.getQueryData(galleryKeys.byProject(PROJECT_A))).toMatchObject({
      is_public: true,
      cover_image_url: COVER_B,
    });
  });

  it("metadata save of current B does not revoke B or clear A", async () => {
    const { hook } = await seedPendingA();
    revokeCoverMock.mockClear();
    upsertGalleryProject.mockResolvedValue({ ...publicRow, cover_image_url: COVER_B, title: "T2" });

    await act(async () => {
      await hook.result.current.mutateAsync({
        is_public: true,
        title: "T2",
        cover_image_url: COVER_B,
      });
    });

    expect(revokeCoverMock).not.toHaveBeenCalled();
    expect(pendingUrls(hook.result)).toEqual([COVER_A]);
  });

  it("rejects retry of a project X entry while project Y is active", async () => {
    const qc = createQc();
    qc.setQueryData(galleryKeys.byProject(PROJECT_A), publicRow);
    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) => useUpsertGalleryProject(projectId),
      { wrapper: createWrapper(qc), initialProps: { projectId: PROJECT_A } },
    );

    await act(async () => {
      await result.current.mutateAsync({ is_public: true, cover_image_url: COVER_B });
    });
    await waitFor(() => {
      expect(pendingUrls({ current: result.current })).toEqual([COVER_A]);
    });

    rerender({ projectId: PROJECT_B });
    expect(result.current.pendingCoverCleanups).toEqual([]);

    revokeCoverMock.mockClear();
    let mismatch: Awaited<ReturnType<typeof result.current.retryPendingCoverCleanup>>;
    await act(async () => {
      mismatch = await result.current.retryPendingCoverCleanup(COVER_A);
    });
    expect(mismatch!).toEqual({
      status: "failed",
      error: "Cover cleanup is not available for this project",
    });
    expect(revokeCoverMock).not.toHaveBeenCalled();

    rerender({ projectId: PROJECT_A });
    expect(pendingUrls({ current: result.current })).toEqual([COVER_A]);
  });

  it("does not start a second concurrent retry of the same entry", async () => {
    const { hook } = await seedPendingA();
    let release: (value: { status: "deleted" }) => void = () => undefined;
    revokeCoverMock.mockReset();
    revokeCoverMock.mockImplementation(
      () =>
        new Promise<{ status: "deleted" }>((resolve) => {
          release = resolve;
        }),
    );

    let first: Promise<unknown> | undefined;
    act(() => {
      first = hook.result.current.retryPendingCoverCleanup(COVER_A);
    });
    await waitFor(() => {
      expect(hook.result.current.isRetryingCoverCleanup).toBe(true);
    });

    let second: Awaited<ReturnType<typeof hook.result.current.retryPendingCoverCleanup>>;
    await act(async () => {
      second = await hook.result.current.retryPendingCoverCleanup(COVER_A);
    });
    expect(second!).toEqual({
      status: "failed",
      error: "Cover cleanup retry is already in progress",
    });
    expect(revokeCoverMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ status: "deleted" });
      await first;
    });
    expect(pendingUrls(hook.result)).toEqual([]);
  });

  it("refuses retry while a save mutation is in flight", async () => {
    const { hook } = await seedPendingA();
    let releaseUpsert: (value: PublicGalleryProjectRow) => void = () => undefined;
    upsertGalleryProject.mockImplementation(
      () =>
        new Promise<PublicGalleryProjectRow>((resolve) => {
          releaseUpsert = resolve;
        }),
    );

    act(() => {
      hook.result.current.mutate({ is_public: true, cover_image_url: COVER_B, title: "in-flight" });
    });
    await waitFor(() => {
      expect(hook.result.current.isPending).toBe(true);
    });

    revokeCoverMock.mockClear();
    let retryResult: Awaited<ReturnType<typeof hook.result.current.retryPendingCoverCleanup>>;
    await act(async () => {
      retryResult = await hook.result.current.retryPendingCoverCleanup(COVER_A);
    });
    expect(retryResult!).toEqual({
      status: "failed",
      error: "Cover cleanup retry is already in progress",
    });
    expect(revokeCoverMock).not.toHaveBeenCalled();

    await act(async () => {
      releaseUpsert({ ...publicRow, cover_image_url: COVER_B });
    });
  });

  it("refuses save while a cleanup retry is mutating pending state", async () => {
    const { hook } = await seedPendingA();
    let releaseRevoke: (value: { status: "deleted" }) => void = () => undefined;
    revokeCoverMock.mockImplementation(
      () =>
        new Promise<{ status: "deleted" }>((resolve) => {
          releaseRevoke = resolve;
        }),
    );

    act(() => {
      void hook.result.current.retryPendingCoverCleanup(COVER_A);
    });
    await waitFor(() => {
      expect(hook.result.current.isRetryingCoverCleanup).toBe(true);
    });

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ is_public: true, cover_image_url: COVER_C }),
      ).rejects.toBeInstanceOf(GalleryCoverCleanupBusyError);
    });
    expect(upsertGalleryProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseRevoke({ status: "deleted" });
    });
  });
});
