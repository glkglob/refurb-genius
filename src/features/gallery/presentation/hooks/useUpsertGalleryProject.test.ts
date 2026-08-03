/**
 * AO-1M3 — useUpsertGalleryProject: auth, optimistic cache, repository mapping, invalidation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { galleryKeys, type PublicGalleryProjectRow } from "@/lib/queries/gallery";

const getUser = vi.hoisted(() => vi.fn());
const upsertGalleryProject = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { useUpsertGalleryProject } from "./useUpsertGalleryProject";

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

    let row: PublicGalleryProjectRow | undefined;
    await act(async () => {
      row = await result.current.mutateAsync({ is_public: true });
    });
    expect(row).toEqual(serverRow);
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
    expect(loggerError).toHaveBeenCalledWith(
      "[gallery] upsert mutation error",
      expect.objectContaining({ projectId: PROJECT_A, error: "network" }),
    );
  });

  it("invalidates only the canonical by-project key on success", async () => {
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
    for (const call of invalidateSpy.mock.calls) {
      const arg = call[0] as { queryKey?: readonly unknown[] };
      expect(arg.queryKey).toEqual(key);
      expect(arg.queryKey).not.toEqual(galleryKeys.publicList());
      expect(arg.queryKey?.[0]).not.toBeUndefined();
      if (Array.isArray(arg.queryKey)) {
        expect(arg.queryKey).not.toContain("byId");
        expect(arg.queryKey).not.toContain("public");
        expect(arg.queryKey).not.toContain("leads");
      }
    }
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
