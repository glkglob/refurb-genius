import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { projectKeys } from "@/lib/queries/projects";
import { SIGNED_URL_STALE_TIME_MS, SIGNED_URL_TTL_SECONDS } from "../projectPhotoDisplay";

const getPhotoStorageClient = vi.fn();
const createSignedUrl = vi.fn();
const isNativePlatform = vi.fn(() => false);
const getNativeSupabase = vi.fn();

vi.mock("@/lib/photos-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photos-write")>();
  return {
    ...actual,
    getPhotoStorageClient: (...args: unknown[]) => getPhotoStorageClient(...args),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabase(),
}));

import {
  projectPhotoDisplayQueryOptions,
  retryProjectPhotoDisplayOnce,
  useProjectPhotoDisplayUrl,
  useProjectPhotoDisplayUrls,
} from "./useProjectPhotoDisplayUrl";

const PROJECT_ID = "proj-1";
const PHOTO_A = "photo-a";
const PATH_A = "user-1/proj-1/photo-a.jpg";

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isNativePlatform.mockReturnValue(false);
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.example/a?token=1" },
    error: null,
  });
  getPhotoStorageClient.mockResolvedValue({
    storage: { from: () => ({ createSignedUrl }) },
  });
  getNativeSupabase.mockReturnValue({
    storage: { from: () => ({ createSignedUrl }) },
  });
});

describe("projectPhotoDisplayQueryOptions", () => {
  it("uses the frozen display key and does not remint on a 60s staleTime", () => {
    const options = projectPhotoDisplayQueryOptions({
      projectId: PROJECT_ID,
      photoId: PHOTO_A,
      storagePath: PATH_A,
    });
    expect(options.queryKey).toEqual(projectKeys.photoDisplay(PROJECT_ID, PHOTO_A));
    expect(options.queryKey).toEqual(["projects", PROJECT_ID, "photoDisplay", PHOTO_A]);
    expect(options.staleTime).toBe(SIGNED_URL_STALE_TIME_MS);
    expect(options.staleTime).toBe(840_000);
    expect(options.refetchOnWindowFocus).toBe(true);
  });
});

describe("useProjectPhotoDisplayUrl", () => {
  it("mints a signed URL from storagePath via getPhotoStorageClient", async () => {
    const qc = createQc();
    const { result } = renderHook(
      () =>
        useProjectPhotoDisplayUrl({
          projectId: PROJECT_ID,
          photoId: PHOTO_A,
          storagePath: PATH_A,
        }),
      { wrapper: createWrapper(qc) },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getPhotoStorageClient).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith(PATH_A, SIGNED_URL_TTL_SECONDS);
    expect(result.current.data?.signedUrl).toBe("https://signed.example/a?token=1");
    expect(result.current.data?.expiresIn).toBe(900);
  });

  it("reuses the cached signed URL while still fresh — no second mint", async () => {
    const qc = createQc();
    const wrapper = createWrapper(qc);
    const { result, rerender } = renderHook(
      () =>
        useProjectPhotoDisplayUrl({
          projectId: PROJECT_ID,
          photoId: PHOTO_A,
          storagePath: PATH_A,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(createSignedUrl).toHaveBeenCalledTimes(1);

    rerender();
    expect(createSignedUrl).toHaveBeenCalledTimes(1);

    await qc.refetchQueries({
      queryKey: projectKeys.photoDisplay(PROJECT_ID, PHOTO_A),
      type: "active",
    });
    // Explicit refetch is allowed; the 60s staleTime path is not used.
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("does not fetch when storagePath is missing", async () => {
    const qc = createQc();
    const { result } = renderHook(
      () =>
        useProjectPhotoDisplayUrl({
          projectId: PROJECT_ID,
          photoId: PHOTO_A,
          storagePath: "",
        }),
      { wrapper: createWrapper(qc) },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("window focus does not remint a still-fresh signed URL", async () => {
    const qc = createQc();
    const { result } = renderHook(
      () =>
        useProjectPhotoDisplayUrl({
          projectId: PROJECT_ID,
          photoId: PHOTO_A,
          storagePath: PATH_A,
        }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(createSignedUrl).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    const state = qc.getQueryState(projectKeys.photoDisplay(PROJECT_ID, PHOTO_A));
    expect(state?.isInvalidated).toBe(false);
  });
});

describe("useProjectPhotoDisplayUrls", () => {
  it("returns a per-photo map and does not mutate ProjectPhoto", async () => {
    const photos = [
      { id: "p1", storagePath: "u/p/p1.jpg", url: "https://durable/p1.jpg" },
      { id: "p2", storagePath: "u/p/p2.jpg", url: "https://durable/p2.jpg" },
    ];
    createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://signed/p1" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://signed/p2" }, error: null });

    const qc = createQc();
    const { result } = renderHook(() => useProjectPhotoDisplayUrls(PROJECT_ID, photos), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => {
      expect(result.current.urlByPhotoId.get("p1")).toBe("https://signed/p1");
      expect(result.current.urlByPhotoId.get("p2")).toBe("https://signed/p2");
    });

    expect(photos[0]?.url).toBe("https://durable/p1.jpg");
    expect(photos[1]?.url).toBe("https://durable/p2.jpg");
  });
});

describe("retryProjectPhotoDisplayOnce", () => {
  it("invalidates the display key once", () => {
    const qc = createQc();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const retried = { current: false };
    retryProjectPhotoDisplayOnce(qc, PROJECT_ID, PHOTO_A, retried);
    retryProjectPhotoDisplayOnce(qc, PROJECT_ID, PHOTO_A, retried);
    expect(retried.current).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      queryKey: projectKeys.photoDisplay(PROJECT_ID, PHOTO_A),
    });
  });
});

describe("native display authority", () => {
  it("uses getPhotoStorageClient (native Keychain path) and not browser signing", async () => {
    const nativeCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.native/a" },
      error: null,
    });
    getPhotoStorageClient.mockImplementation(async () => {
      if (!isNativePlatform()) {
        return { storage: { from: () => ({ createSignedUrl }) } };
      }
      return getNativeSupabase();
    });
    isNativePlatform.mockReturnValue(true);
    getNativeSupabase.mockReturnValue({
      storage: { from: () => ({ createSignedUrl: nativeCreateSignedUrl }) },
    });
    getPhotoStorageClient.mockResolvedValue({
      storage: { from: () => ({ createSignedUrl: nativeCreateSignedUrl }) },
    });

    const qc = createQc();
    const { result } = renderHook(
      () =>
        useProjectPhotoDisplayUrl({
          projectId: PROJECT_ID,
          photoId: PHOTO_A,
          storagePath: PATH_A,
        }),
      { wrapper: createWrapper(qc) },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getPhotoStorageClient).toHaveBeenCalled();
    expect(nativeCreateSignedUrl).toHaveBeenCalledWith(PATH_A, 900);
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(result.current.data?.signedUrl).toBe("https://signed.native/a");
  });
});
