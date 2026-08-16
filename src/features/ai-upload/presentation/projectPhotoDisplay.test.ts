import { describe, it, expect, vi, beforeEach } from "vitest";

const { isNativePlatform, getNativeSupabaseMock, nativeCreateSignedUrl, browserCreateSignedUrl } =
  vi.hoisted(() => ({
    isNativePlatform: vi.fn(() => false),
    getNativeSupabaseMock: vi.fn(),
    nativeCreateSignedUrl: vi.fn(),
    browserCreateSignedUrl: vi.fn(),
  }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    storage: {
      from: vi.fn(() => ({ createSignedUrl: browserCreateSignedUrl })),
    },
    rpc: vi.fn(),
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabaseMock(),
}));

import { PROJECT_PHOTOS_BUCKET, getPhotoStorageClient } from "@/lib/photos-write";
import {
  SIGNED_URL_TTL_SECONDS,
  SIGNED_URL_REFRESH_MARGIN_SECONDS,
  SIGNED_URL_STALE_TIME_MS,
  ProjectPhotoDisplayError,
  createProjectPhotoSignedUrl,
  isProjectPhotoDisplayFresh,
} from "./projectPhotoDisplay";

const createSignedUrl = vi.fn();

function makeClient() {
  return {
    storage: {
      from: vi.fn(() => ({ createSignedUrl })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isNativePlatform.mockReturnValue(false);
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.example/object?token=abc" },
    error: null,
  });
  browserCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.web/object?token=web" },
    error: null,
  });
  nativeCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed.native/object?token=native" },
    error: null,
  });
  getNativeSupabaseMock.mockReturnValue({
    storage: { from: vi.fn(() => ({ createSignedUrl: nativeCreateSignedUrl })) },
  });
});

describe("createProjectPhotoSignedUrl", () => {
  it("signs storagePath on the project-photos bucket with UI TTL 900", async () => {
    const client = makeClient();
    const before = Date.now();
    const result = await createProjectPhotoSignedUrl(client, "user-1/proj-1/photo-1.jpg");

    expect(client.storage.from).toHaveBeenCalledWith(PROJECT_PHOTOS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/proj-1/photo-1.jpg", 900);
    expect(SIGNED_URL_TTL_SECONDS).toBe(900);
    expect(result.signedUrl).toBe("https://signed.example/object?token=abc");
    expect(result.expiresIn).toBe(900);
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 900_000);
    expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 900_000);
  });

  it("never reads ProjectPhoto.url — only storagePath is retrieval authority", async () => {
    const client = makeClient();
    const photo = {
      url: "https://public.example/object/public/project-photos/user-1/proj-1/photo-1.jpg",
      storagePath: "user-1/proj-1/photo-1.jpg",
    };
    await createProjectPhotoSignedUrl(client, photo.storagePath);
    expect(createSignedUrl).toHaveBeenCalledWith(photo.storagePath, 900);
    expect(createSignedUrl.mock.calls[0]?.[0]).not.toBe(photo.url);
    expect(JSON.stringify(createSignedUrl.mock.calls)).not.toContain(photo.url);
  });

  it("rejects empty storagePath without calling Storage", async () => {
    const client = makeClient();
    await expect(createProjectPhotoSignedUrl(client, "")).rejects.toMatchObject({
      name: "ProjectPhotoDisplayError",
      code: "missing_storage_path",
    });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects invalid TTL", async () => {
    const client = makeClient();
    await expect(createProjectPhotoSignedUrl(client, "a/b/c.jpg", 0)).rejects.toBeInstanceOf(
      ProjectPhotoDisplayError,
    );
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("maps Storage failures to a typed error and does not persist anything", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "denied" } });
    const client = makeClient();
    await expect(
      createProjectPhotoSignedUrl(client, "user-1/proj-1/photo-1.jpg"),
    ).rejects.toMatchObject({
      code: "sign_failed",
    });
  });

  it("source does not log signed URLs or write localStorage/database", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/ai-upload/presentation/projectPhotoDisplay.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/localStorage/);
    expect(src).not.toMatch(/logger\./);
    expect(src).not.toMatch(/console\./);
    expect(src).not.toMatch(/service_role/);
    expect(src).toMatch(/createSignedUrl/);
    expect(src).not.toMatch(/getPublicUrl/);
    expect(src).not.toMatch(/photo\.url/);
  });
});

describe("display freshness", () => {
  it("treats URLs more than 60s from expiry as fresh", () => {
    const now = 1_000_000;
    expect(isProjectPhotoDisplayFresh(now + 61_000, now)).toBe(true);
    expect(isProjectPhotoDisplayFresh(now + 60_000, now)).toBe(false);
    expect(isProjectPhotoDisplayFresh(now + 1_000, now)).toBe(false);
  });

  it("staleTime is TTL minus refresh margin (R1B refinement, not 60s)", () => {
    expect(SIGNED_URL_REFRESH_MARGIN_SECONDS).toBe(60);
    expect(SIGNED_URL_STALE_TIME_MS).toBe(840_000);
    expect(SIGNED_URL_STALE_TIME_MS).not.toBe(60_000);
  });
});

describe("native display signing authority", () => {
  it("uses getNativeSupabase and never the browser client", async () => {
    isNativePlatform.mockReturnValue(true);
    const client = await getPhotoStorageClient();
    const result = await createProjectPhotoSignedUrl(client, "native-user/proj-1/p.jpg");

    expect(getNativeSupabaseMock).toHaveBeenCalledTimes(1);
    expect(nativeCreateSignedUrl).toHaveBeenCalledWith("native-user/proj-1/p.jpg", 900);
    expect(browserCreateSignedUrl).not.toHaveBeenCalled();
    expect(result.signedUrl).toBe("https://signed.native/object?token=native");
  });

  it("web uses browser Supabase and does not load native", async () => {
    const client = await getPhotoStorageClient();
    const result = await createProjectPhotoSignedUrl(client, "user-1/proj-1/p.jpg");

    expect(getNativeSupabaseMock).not.toHaveBeenCalled();
    expect(browserCreateSignedUrl).toHaveBeenCalledWith("user-1/proj-1/p.jpg", 900);
    expect(nativeCreateSignedUrl).not.toHaveBeenCalled();
    expect(result.signedUrl).toBe("https://signed.web/object?token=web");
  });
});
