import { describe, it, expect, vi, beforeEach } from "vitest";
import { TimeoutError } from "@/lib/timeout";

const {
  getUserMock,
  authGetUserMock,
  storageFromMock,
  storageUploadMock,
  storageRemoveMock,
  getPublicUrlMock,
  fromMock,
  rpcMock,
  isNativePlatform,
  getNativeSupabaseMock,
  nativeGetUserMock,
  nativeStorageFromMock,
  nativeStorageUploadMock,
  nativeStorageRemoveMock,
  nativeGetPublicUrlMock,
  nativeFromMock,
  nativeRpcMock,
  loggerError,
  loggerWarn,
  captureUploadErrorMock,
  timeoutPromiseMock,
  randomUUIDMock,
} = vi.hoisted(() => {
  const storageUploadMock = vi.fn();
  const storageRemoveMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const storageFromMock = vi.fn(() => ({
    upload: storageUploadMock,
    remove: storageRemoveMock,
    getPublicUrl: getPublicUrlMock,
  }));
  const rpcMock = vi.fn();
  const fromMock = vi.fn(() => {
    throw new Error("direct photos table DML is sealed; use metadata RPCs");
  });
  const nativeStorageUploadMock = vi.fn();
  const nativeStorageRemoveMock = vi.fn();
  const nativeGetPublicUrlMock = vi.fn();
  const nativeStorageFromMock = vi.fn(() => ({
    upload: nativeStorageUploadMock,
    remove: nativeStorageRemoveMock,
    getPublicUrl: nativeGetPublicUrlMock,
  }));
  const nativeRpcMock = vi.fn();
  const nativeFromMock = vi.fn(() => {
    throw new Error("direct photos table DML is sealed; use metadata RPCs");
  });
  return {
    getUserMock: vi.fn(),
    authGetUserMock: vi.fn(),
    storageFromMock,
    storageUploadMock,
    storageRemoveMock,
    getPublicUrlMock,
    fromMock,
    rpcMock,
    isNativePlatform: vi.fn(() => false),
    getNativeSupabaseMock: vi.fn(),
    nativeGetUserMock: vi.fn(),
    nativeStorageFromMock,
    nativeStorageUploadMock,
    nativeStorageRemoveMock,
    nativeGetPublicUrlMock,
    nativeFromMock,
    nativeRpcMock,
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
    captureUploadErrorMock: vi.fn(),
    timeoutPromiseMock: vi.fn((p: Promise<unknown>) => p),
    randomUUIDMock: vi.fn(() => "uuid-fixed-0001"),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: { getUser: getUserMock },
    storage: { from: storageFromMock },
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock("@/platform/supabase/native", () => ({
  getNativeSupabase: () => getNativeSupabaseMock(),
}));

vi.mock("@/lib/auth", () => ({
  fromSupabaseUser: (u: { id: string; email?: string } | null) =>
    u ? { id: u.id, email: u.email ?? "", fullName: undefined } : null,
  auth: { getUser: authGetUserMock },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerError,
    warn: loggerWarn,
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/sentry", () => ({
  captureUploadError: captureUploadErrorMock,
  addDiagnosticBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/timeout", async () => {
  const actual = await vi.importActual<typeof import("@/lib/timeout")>("@/lib/timeout");
  return {
    ...actual,
    timeoutPromise: timeoutPromiseMock,
  };
});

import {
  PROJECT_PHOTOS_BUCKET,
  PROJECT_PHOTO_CACHE_CONTROL,
  PHOTO_WRITE_AUTH_ERROR,
  buildProjectPhotoStoragePath,
  assertSafePathSegment,
  getPhotoStorageClient,
  getPhotoWriteClient,
  uploadProjectPhoto,
  uploadProjectPhotos,
  MAX_CONCURRENT_PHOTO_UPLOADS,
  removeProjectPhoto,
  PhotoWriteError,
  PhotoUploadBatchError,
} from "./photos-write";

function makeImageFile(name = "room.jpg", type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "uuid-fixed-0001",
    project_id: "proj-1",
    user_id: "user-1",
    storage_path: "user-1/proj-1/uuid-fixed-0001.jpg",
    url: "https://cdn.example/user-1/proj-1/uuid-fixed-0001.jpg",
    name: "room.jpg",
    size: 3,
    uploaded_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockSuccessfulRpc(rpc: typeof rpcMock) {
  rpc.mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
    if (fn === "create_project_photo_metadata") {
      return {
        data: makeRow({
          id: args?.p_photo_id,
          name: args?.p_name,
          storage_path: args?.p_storage_path,
          url: args?.p_url,
          size: args?.p_size,
        }),
        error: null,
      };
    }
    if (fn === "delete_project_photo_metadata") {
      return {
        data: [
          {
            id: args?.p_photo_id,
            storage_path: "user-1/proj-1/uuid-fixed-0001.jpg",
            project_id: "proj-1",
          },
        ],
        error: null,
      };
    }
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  });
}

function mockSuccessfulInserts() {
  mockSuccessfulRpc(rpcMock);
  mockSuccessfulRpc(nativeRpcMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  timeoutPromiseMock.mockImplementation((p: Promise<unknown>) => p);
  randomUUIDMock.mockReturnValue("uuid-fixed-0001");
  vi.stubGlobal("crypto", { randomUUID: randomUUIDMock });

  isNativePlatform.mockReturnValue(false);
  getNativeSupabaseMock.mockReturnValue({
    auth: { getUser: nativeGetUserMock },
    storage: { from: nativeStorageFromMock },
    from: nativeFromMock,
    rpc: nativeRpcMock,
  });

  getUserMock.mockResolvedValue({
    data: { user: { id: "user-1", email: "a@b.co" } },
    error: null,
  });
  nativeGetUserMock.mockResolvedValue({
    data: { user: { id: "native-user-1", email: "n@b.co" } },
    error: null,
  });
  authGetUserMock.mockReturnValue(null);

  storageUploadMock.mockResolvedValue({ error: null });
  storageRemoveMock.mockResolvedValue({ data: [], error: null });
  getPublicUrlMock.mockReturnValue({
    data: { publicUrl: "https://cdn.example/user-1/proj-1/uuid-fixed-0001.jpg" },
  });
  nativeStorageUploadMock.mockResolvedValue({ error: null });
  nativeStorageRemoveMock.mockResolvedValue({ data: [], error: null });
  nativeGetPublicUrlMock.mockReturnValue({
    data: { publicUrl: "https://cdn.example/native-user-1/proj-1/uuid-fixed-0001.jpg" },
  });

  mockSuccessfulInserts();
});

// ── Path helper ───────────────────────────────────────────────────

describe("buildProjectPhotoStoragePath", () => {
  it("lowercases extension and composes user/project/photoId", () => {
    expect(
      buildProjectPhotoStoragePath({
        userId: "u",
        projectId: "p",
        photoId: "id",
        fileName: "photo.JPG",
      }),
    ).toBe("u/p/id.jpg");
  });

  it("uses final segment for multi-dot names", () => {
    expect(
      buildProjectPhotoStoragePath({
        userId: "u",
        projectId: "p",
        photoId: "id",
        fileName: "kitchen.final.PNG",
      }),
    ).toBe("u/p/id.png");
  });

  it("defaults to jpg when no extension", () => {
    expect(
      buildProjectPhotoStoragePath({
        userId: "u",
        projectId: "p",
        photoId: "id",
        fileName: "filename-without-extension",
      }),
    ).toBe("u/p/id.jpg");
  });

  it("falls back to jpg for unsafe extensions including path separators", () => {
    expect(
      buildProjectPhotoStoragePath({
        userId: "u",
        projectId: "p",
        photoId: "id",
        fileName: "evil.foo/bar",
      }),
    ).toBe("u/p/id.jpg");
  });

  it("does not embed the raw filename", () => {
    const path = buildProjectPhotoStoragePath({
      userId: "u",
      projectId: "p",
      photoId: "id",
      fileName: "secret-name.heic",
    });
    expect(path).not.toContain("secret-name");
    expect(path).toBe("u/p/id.heic");
  });

  it("rejects slash/traversal in path authority segments", () => {
    expect(() =>
      buildProjectPhotoStoragePath({
        userId: "u/../x",
        projectId: "p",
        photoId: "id",
        fileName: "a.jpg",
      }),
    ).toThrow(PhotoWriteError);
    expect(() =>
      buildProjectPhotoStoragePath({
        userId: "u",
        projectId: "p",
        photoId: "id/../x",
        fileName: "a.jpg",
      }),
    ).toThrow(/unsafe path/);
  });
});

describe("assertSafePathSegment", () => {
  it("rejects empty, whitespace, and traversal", () => {
    expect(() => assertSafePathSegment("", "projectId")).toThrow(PhotoWriteError);
    expect(() => assertSafePathSegment("  ", "projectId")).toThrow(PhotoWriteError);
    expect(() => assertSafePathSegment("a/b", "projectId")).toThrow(PhotoWriteError);
    expect(() => assertSafePathSegment("a\\b", "projectId")).toThrow(PhotoWriteError);
    expect(() => assertSafePathSegment("a..b", "projectId")).toThrow(PhotoWriteError);
  });
});

// ── Auth ──────────────────────────────────────────────────────────

describe("auth resolution", () => {
  it("uses Supabase session user", async () => {
    await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });
    expect(getUserMock).toHaveBeenCalled();
    expect(storageUploadMock).toHaveBeenCalled();
  });

  it("on web, falls back to legacy auth.getUser when session missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    authGetUserMock.mockReturnValue({ id: "legacy-user", email: "l@x.co" });

    await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });

    expect(authGetUserMock).toHaveBeenCalled();
    expect(storageUploadMock).toHaveBeenCalledWith(
      expect.stringContaining("legacy-user/proj-1/"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("throws when unauthenticated and does not touch Storage", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    authGetUserMock.mockReturnValue(null);

    await expect(
      uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() }),
    ).rejects.toMatchObject({
      message: PHOTO_WRITE_AUTH_ERROR,
      stage: "authentication",
    });

    expect(storageUploadMock).not.toHaveBeenCalled();
  });
});

// ── Single upload ─────────────────────────────────────────────────

describe("uploadProjectPhoto", () => {
  it("uploads with upsert:false, content type, shared UUID, and maps row", async () => {
    const file = makeImageFile("room.jpg");
    const photo = await uploadProjectPhoto({ projectId: "proj-1", file });

    expect(storageFromMock).toHaveBeenCalledWith(PROJECT_PHOTOS_BUCKET);
    expect(storageUploadMock).toHaveBeenCalledWith("user-1/proj-1/uuid-fixed-0001.jpg", file, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: PROJECT_PHOTO_CACHE_CONTROL,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "create_project_photo_metadata",
      expect.objectContaining({
        p_project_id: "proj-1",
        p_photo_id: "uuid-fixed-0001",
        p_storage_path: "user-1/proj-1/uuid-fixed-0001.jpg",
      }),
    );
    expect(fromMock).not.toHaveBeenCalled();
    expect(photo.id).toBe("uuid-fixed-0001");
  });

  it("rejects non-image files without Auth or Storage calls", async () => {
    const file = new File([new Uint8Array([1])], "notes.txt", { type: "text/plain" });
    await expect(uploadProjectPhoto({ projectId: "proj-1", file })).rejects.toMatchObject({
      stage: "validation",
    });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("rejects empty projectId before Auth", async () => {
    await expect(
      uploadProjectPhoto({ projectId: "", file: makeImageFile() }),
    ).rejects.toMatchObject({ stage: "validation" });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("propagates Storage errors as PhotoWriteError", async () => {
    storageUploadMock.mockResolvedValue({ error: { message: "quota exceeded" } });
    await expect(
      uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() }),
    ).rejects.toMatchObject({
      stage: "storage-upload",
      message: "quota exceeded",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rolls back Storage when metadata insert fails and preserves primary error with rollback context", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "rls denied", code: "42501" },
    });
    storageRemoveMock.mockResolvedValue({
      data: null,
      error: { message: "remove failed" },
    });

    try {
      await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PhotoWriteError);
      const e = err as PhotoWriteError;
      expect(e.stage).toBe("metadata-insert");
      expect(e.message).toContain("rls denied");
      expect(e.rollbackError).toEqual(expect.objectContaining({ message: "remove failed" }));
    }

    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/proj-1/uuid-fixed-0001.jpg"]);
  });

  it("propagates storage timeout without rollback", async () => {
    timeoutPromiseMock.mockImplementationOnce(async () => {
      throw new TimeoutError(
        "Upload room.jpg to storage exceeded 60000ms timeout",
        "Upload room.jpg to storage",
        60_000,
      );
    });

    await expect(
      uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() }),
    ).rejects.toMatchObject({ stage: "storage-upload" });

    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it("propagates metadata timeout and rolls back Storage", async () => {
    timeoutPromiseMock
      .mockImplementationOnce((p: Promise<unknown>) => p)
      .mockImplementationOnce(async () => {
        throw new TimeoutError(
          "Insert metadata for room.jpg exceeded 60000ms timeout",
          "Insert metadata for room.jpg",
          60_000,
        );
      });

    await expect(
      uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() }),
    ).rejects.toMatchObject({ stage: "metadata-insert" });

    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/proj-1/uuid-fixed-0001.jpg"]);
  });

  it("emits truthful stages: uploading only after validate/auth; saving after storage", async () => {
    const stages: string[] = [];
    let storageCalled = false;
    let insertCalled = false;

    storageUploadMock.mockImplementation(async () => {
      storageCalled = true;
      expect(stages).toContain("uploading");
      expect(stages).not.toContain("saving");
      return { error: null };
    });
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "create_project_photo_metadata") {
        insertCalled = true;
        expect(stages).toContain("saving");
        return { data: makeRow(), error: null };
      }
      return { data: null, error: { message: "unexpected" } };
    });

    await uploadProjectPhoto({
      projectId: "proj-1",
      file: makeImageFile(),
      onItemState: (e) => stages.push(e.state),
    });

    expect(storageCalled && insertCalled).toBe(true);
    expect(stages).toEqual(["validating", "authenticating", "uploading", "saving", "complete"]);
  });

  it("emits rolling-back on metadata failure", async () => {
    const stages: string[] = [];
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      uploadProjectPhoto({
        projectId: "proj-1",
        file: makeImageFile(),
        onItemState: (e) => stages.push(e.state),
      }),
    ).rejects.toBeInstanceOf(PhotoWriteError);

    expect(stages).toContain("rolling-back");
    expect(stages[stages.length - 1]).toBe("failed");
  });

  it("does not fail upload when onItemState throws", async () => {
    const photo = await uploadProjectPhoto({
      projectId: "proj-1",
      file: makeImageFile(),
      onItemState: () => {
        throw new Error("callback boom");
      },
    });
    expect(photo.id).toBe("uuid-fixed-0001");
    expect(storageRemoveMock).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalled();
  });
});

// ── Batch ─────────────────────────────────────────────────────────

describe("uploadProjectPhotos batch", () => {
  it("returns empty array for empty batch", async () => {
    await expect(uploadProjectPhotos({ projectId: "proj-1", files: [] })).resolves.toEqual([]);
  });

  it("rejects invalid concurrency", async () => {
    await expect(
      uploadProjectPhotos({
        projectId: "proj-1",
        files: [makeImageFile()],
        concurrency: 0,
      }),
    ).rejects.toMatchObject({ stage: "validation" });
    await expect(
      uploadProjectPhotos({
        projectId: "proj-1",
        files: [makeImageFile()],
        concurrency: 1.5,
      }),
    ).rejects.toMatchObject({ stage: "validation" });
  });

  it("uploads multi-file batch successfully with default concurrency 3", async () => {
    let n = 0;
    randomUUIDMock.mockImplementation(() => `id-${n++}`);
    mockSuccessfulInserts();
    const out = await uploadProjectPhotos({
      projectId: "proj-1",
      files: [makeImageFile("a.jpg"), makeImageFile("b.jpg")],
    });
    expect(out).toHaveLength(2);
  });

  it("bounds active concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    let n = 0;
    randomUUIDMock.mockImplementation(() => `c-${n++}`);
    storageUploadMock.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
      return { error: null };
    });
    mockSuccessfulInserts();

    const files = Array.from({ length: 6 }, (_, i) => makeImageFile(`f${i}.jpg`));
    await uploadProjectPhotos({ projectId: "proj-1", files, concurrency: 2 });
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBeGreaterThan(0);
  });

  it("throws PhotoUploadBatchError with structured partial successes and failures", async () => {
    let n = 0;
    randomUUIDMock.mockImplementation(() => `u-${n++}`);
    storageUploadMock.mockImplementation(async (_path: string, file: File) => {
      if (file.name === "bad.jpg") return { error: { message: "storage boom" } };
      return { error: null };
    });
    mockSuccessfulInserts();

    const files = [makeImageFile("ok1.jpg"), makeImageFile("bad.jpg"), makeImageFile("ok2.jpg")];

    try {
      await uploadProjectPhotos({ projectId: "proj-1", files });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PhotoUploadBatchError);
      const e = err as PhotoUploadBatchError;
      expect(e.attemptedCount).toBe(3);
      expect(e.successes).toHaveLength(2);
      expect(e.successes.map((p) => p.name).sort()).toEqual(["ok1.jpg", "ok2.jpg"]);
      expect(e.failures).toHaveLength(1);
      expect(e.failures[0]?.index).toBe(1);
      expect(e.failures[0]?.file.name).toBe("bad.jpg");
      expect(e.failures[0]?.stage).toBe("storage-upload");
      expect(e.failures[0]?.cause).toBeTruthy();
      // no message parsing needed
      expect(e.successes[0]?.id).toBeTruthy();
    }
  });

  it("preserves input order for successes even if second finishes first", async () => {
    let seq = 0;
    randomUUIDMock.mockImplementation(() => `ord-${seq++}`);
    storageUploadMock.mockImplementation(async (_path: string, file: File) => {
      if (file.name === "first.jpg") await new Promise((r) => setTimeout(r, 40));
      return { error: null };
    });
    mockSuccessfulInserts();

    const out = await uploadProjectPhotos({
      projectId: "proj-1",
      files: [makeImageFile("first.jpg"), makeImageFile("second.jpg")],
    });
    expect(out.map((p) => p.name)).toEqual(["first.jpg", "second.jpg"]);
  });

  it("does not emit saving before storage resolves in batch", async () => {
    const events: Array<{ index: number; state: string }> = [];
    let n = 0;
    randomUUIDMock.mockImplementation(() => `ev-${n++}`);
    storageUploadMock.mockImplementation(async () => {
      // at the moment storage runs, latest event for index 0 must be uploading not saving
      const for0 = events.filter((e) => e.index === 0).map((e) => e.state);
      expect(for0[for0.length - 1]).toBe("uploading");
      return { error: null };
    });
    mockSuccessfulInserts();

    await uploadProjectPhotos({
      projectId: "proj-1",
      files: [makeImageFile()],
      onItemState: (e) => events.push({ index: e.index, state: e.state }),
    });

    const states = events.filter((e) => e.index === 0).map((e) => e.state);
    const uploadingAt = states.indexOf("uploading");
    const savingAt = states.indexOf("saving");
    expect(uploadingAt).toBeGreaterThanOrEqual(0);
    expect(savingAt).toBeGreaterThan(uploadingAt);
  });

  it("callback exceptions do not fail batch uploads", async () => {
    let n = 0;
    randomUUIDMock.mockImplementation(() => `cb-${n++}`);
    mockSuccessfulInserts();
    const out = await uploadProjectPhotos({
      projectId: "proj-1",
      files: [makeImageFile("a.jpg")],
      onItemState: () => {
        throw new Error("ui callback");
      },
    });
    expect(out).toHaveLength(1);
  });

  it("assigns distinct UUIDs under concurrency with correct indexes", async () => {
    const ids = new Set<string>();
    let n = 0;
    randomUUIDMock.mockImplementation(() => {
      const id = `par-${n++}`;
      ids.add(id);
      return id;
    });
    mockSuccessfulInserts();
    const events: Array<{ index: number; state: string }> = [];

    await uploadProjectPhotos({
      projectId: "proj-1",
      files: [makeImageFile("a.jpg"), makeImageFile("b.jpg")],
      concurrency: 2,
      onItemState: (e) => events.push({ index: e.index, state: e.state }),
    });

    expect(ids.size).toBe(2);
    expect(events.some((e) => e.index === 0 && e.state === "complete")).toBe(true);
    expect(events.some((e) => e.index === 1 && e.state === "complete")).toBe(true);
  });
});

// ── Remove ────────────────────────────────────────────────────────

describe("uploadProjectPhoto size validation", () => {
  it("rejects files over MAX_PHOTO_BYTES", async () => {
    const { uploadProjectPhoto, PhotoWriteError, MAX_PHOTO_BYTES } = await import("./photos-write");
    const big = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "huge.jpg", { type: "image/jpeg" });
    // Ensure size is reported correctly in jsdom/node
    Object.defineProperty(big, "size", { value: MAX_PHOTO_BYTES + 1 });
    await expect(uploadProjectPhoto({ projectId: "proj-1", file: big })).rejects.toMatchObject({
      name: "PhotoWriteError",
      stage: "validation",
    });
  });
});

describe("removeProjectPhoto", () => {
  it("authenticates before delete and uses deleted row storage_path from RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "p1", storage_path: "user-1/proj-1/p1.jpg", project_id: "proj-1" }],
      error: null,
    });

    const result = await removeProjectPhoto({ photoId: "p1" });

    expect(getUserMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("delete_project_photo_metadata", { p_photo_id: "p1" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/proj-1/p1.jpg"]);
    expect(result).toEqual({
      photoId: "p1",
      storagePath: "user-1/proj-1/p1.jpg",
      storageCleanup: "removed",
    });
  });

  it("throws on zero-row delete and does not call Storage", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(removeProjectPhoto({ photoId: "missing" })).rejects.toMatchObject({
      stage: "metadata-delete",
      message: "Photo not found",
    });
    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it("throws on database failure and does not call Storage", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "fk violation" },
    });

    await expect(removeProjectPhoto({ photoId: "p1" })).rejects.toMatchObject({
      stage: "metadata-delete",
      message: "fk violation",
    });
    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it("unauthenticated removal performs no remote writes", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    authGetUserMock.mockReturnValue(null);

    await expect(removeProjectPhoto({ photoId: "p1" })).rejects.toMatchObject({
      stage: "authentication",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it("returns already-missing for not-found Storage object", async () => {
    storageRemoveMock.mockResolvedValue({
      data: null,
      error: { message: "Object not found", statusCode: "404" },
    });

    const result = await removeProjectPhoto({ photoId: "p1" });
    expect(result.storageCleanup).toBe("already-missing");
  });

  it("returns orphan-warning with storageError for non-missing Storage failure", async () => {
    storageRemoveMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied", statusCode: "403" },
    });

    const result = await removeProjectPhoto({ photoId: "p1" });
    expect(result.storageCleanup).toBe("orphan-warning");
    expect(result.storageError).toEqual(expect.objectContaining({ message: "permission denied" }));
    expect(loggerWarn).toHaveBeenCalledWith(
      "[photos-write] orphan storage object after metadata delete",
      expect.objectContaining({ photoId: "p1" }),
    );
  });

  it("rejects empty photoId before Auth", async () => {
    await expect(removeProjectPhoto({ photoId: "" })).rejects.toMatchObject({
      stage: "validation",
    });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("does not accept caller-supplied storagePath (API is photoId-only)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/photos-write.ts"), "utf8");
    expect(src).toMatch(/removeProjectPhoto\(input: \{\s*photoId: string/);
    expect(src).toMatch(/delete_project_photo_metadata/);
    expect(src).toMatch(/deletedRow\.storage_path/);
    expect(src).not.toMatch(/input\.storagePath|photo\.storagePath/);
  });

  it("source module has no photoStore runtime dependency", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/photos-write.ts"), "utf8");
    expect(src).not.toMatch(/photoStore\s*\./);
    expect(src).toMatch(/import\s+type\s+\{\s*ProjectPhoto\s*\}/);
  });
});

describe("module import neutrality", () => {
  it("module evaluation performs no Auth, database, or Storage requests", async () => {
    // Source has no top-level side-effect calls; only function bodies use remote APIs.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/photos-write.ts"), "utf8");
    // No top-level await
    expect(src).not.toMatch(/^await\s+/m);
    // resolvePhotoWriteUser / storage only appear inside async functions, not as bare calls at module scope
    const withoutFunctions = src
      .replace(/export async function[\s\S]*?(?=\nexport |$)/g, "")
      .replace(/async function[\s\S]*?(?=\n(?:export |async |function |const |$))/g, "")
      .replace(/function[\s\S]*?(?=\n(?:export |async |function |const |$))/g, "");
    expect(withoutFunctions).not.toMatch(/supabase\.(auth|storage|from)/);
    expect(withoutFunctions).not.toMatch(/resolvePhotoWriteUser\(/);
  });
});

describe("module exports", () => {
  it("exports the canonical bucket constant", () => {
    expect(PROJECT_PHOTOS_BUCKET).toBe("project-photos");
  });
});

describe("platform client selection", () => {
  it("getPhotoWriteClient is a compatibility alias of getPhotoStorageClient", async () => {
    const storage = await getPhotoStorageClient();
    const write = await getPhotoWriteClient();
    expect(write).toBe(storage);
    expect(write.auth.getUser).toBe(getUserMock);
    expect(getNativeSupabaseMock).not.toHaveBeenCalled();
  });

  it("web storage client selects the browser client and does not load native", async () => {
    const client = await getPhotoStorageClient();
    expect(isNativePlatform).toHaveBeenCalled();
    expect(getNativeSupabaseMock).not.toHaveBeenCalled();
    expect(client.auth.getUser).toBe(getUserMock);
    expect(client.storage.from).toBe(storageFromMock);
    expect(client.rpc).toBe(rpcMock);
  });

  it("web selects the browser client and does not load native", async () => {
    const client = await getPhotoWriteClient();
    expect(isNativePlatform).toHaveBeenCalled();
    expect(getNativeSupabaseMock).not.toHaveBeenCalled();
    expect(client.auth.getUser).toBe(getUserMock);
    expect(client.storage.from).toBe(storageFromMock);
    expect(client.rpc).toBe(rpcMock);
  });

  it("native storage client selects getNativeSupabase via dynamic import", async () => {
    isNativePlatform.mockReturnValue(true);
    const client = await getPhotoStorageClient();
    expect(getNativeSupabaseMock).toHaveBeenCalledTimes(1);
    expect(client.auth.getUser).toBe(nativeGetUserMock);
    expect(client.storage.from).toBe(nativeStorageFromMock);
    expect(client.rpc).toBe(nativeRpcMock);
    expect(client.auth.getUser).not.toBe(getUserMock);
  });

  it("native selects getNativeSupabase and not the browser client", async () => {
    isNativePlatform.mockReturnValue(true);
    const client = await getPhotoWriteClient();
    expect(getNativeSupabaseMock).toHaveBeenCalledTimes(1);
    expect(client.auth.getUser).toBe(nativeGetUserMock);
    expect(client.storage.from).toBe(nativeStorageFromMock);
    expect(client.rpc).toBe(nativeRpcMock);
  });

  it("web upload uses the same browser client for auth, Storage, and RPC", async () => {
    await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });

    expect(getUserMock).toHaveBeenCalled();
    expect(nativeGetUserMock).not.toHaveBeenCalled();
    expect(getNativeSupabaseMock).not.toHaveBeenCalled();
    expect(storageUploadMock).toHaveBeenCalledWith(
      "user-1/proj-1/uuid-fixed-0001.jpg",
      expect.anything(),
      expect.anything(),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "create_project_photo_metadata",
      expect.objectContaining({
        p_storage_path: "user-1/proj-1/uuid-fixed-0001.jpg",
      }),
    );
    expect(nativeStorageUploadMock).not.toHaveBeenCalled();
    expect(nativeRpcMock).not.toHaveBeenCalled();
  });

  it("native upload uses the same native client for auth, Storage, and RPC", async () => {
    isNativePlatform.mockReturnValue(true);

    await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });

    expect(getNativeSupabaseMock).toHaveBeenCalled();
    expect(nativeGetUserMock).toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(nativeStorageUploadMock).toHaveBeenCalledWith(
      "native-user-1/proj-1/uuid-fixed-0001.jpg",
      expect.anything(),
      expect.anything(),
    );
    expect(nativeRpcMock).toHaveBeenCalledWith(
      "create_project_photo_metadata",
      expect.objectContaining({
        p_storage_path: "native-user-1/proj-1/uuid-fixed-0001.jpg",
      }),
    );
    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("native Storage path first segment equals the native authenticated user id", async () => {
    isNativePlatform.mockReturnValue(true);
    nativeGetUserMock.mockResolvedValue({
      data: { user: { id: "aaaa1111-bbbb-cccc-dddd-eeeeffff0000", email: "n@b.co" } },
      error: null,
    });

    await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });

    const [path] = nativeStorageUploadMock.mock.calls[0] as [string];
    expect(path.startsWith("aaaa1111-bbbb-cccc-dddd-eeeeffff0000/")).toBe(true);
    expect(path.split("/")[0]).toBe("aaaa1111-bbbb-cccc-dddd-eeeeffff0000");
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("native missing session does not fall back to web auth and does not reach Storage", async () => {
    isNativePlatform.mockReturnValue(true);
    nativeGetUserMock.mockResolvedValue({ data: { user: null }, error: null });
    authGetUserMock.mockReturnValue({ id: "web-cached-user", email: "w@x.co" });
    getUserMock.mockResolvedValue({
      data: { user: { id: "web-session-user", email: "w@x.co" } },
      error: null,
    });

    await expect(
      uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() }),
    ).rejects.toMatchObject({
      message: PHOTO_WRITE_AUTH_ERROR,
      stage: "authentication",
      code: "not_authenticated",
    });

    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(nativeStorageUploadMock).not.toHaveBeenCalled();
    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(nativeRpcMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("web unauthenticated does not reach Storage", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    authGetUserMock.mockReturnValue(null);

    await expect(
      uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() }),
    ).rejects.toMatchObject({
      stage: "authentication",
      code: "not_authenticated",
    });
    expect(storageUploadMock).not.toHaveBeenCalled();
    expect(nativeStorageUploadMock).not.toHaveBeenCalled();
  });

  it("native remove uses the native client for auth, RPC, and Storage", async () => {
    isNativePlatform.mockReturnValue(true);
    nativeRpcMock.mockResolvedValue({
      data: [{ id: "p1", storage_path: "native-user-1/proj-1/p1.jpg", project_id: "proj-1" }],
      error: null,
    });

    const result = await removeProjectPhoto({ photoId: "p1" });

    expect(nativeGetUserMock).toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(nativeRpcMock).toHaveBeenCalledWith("delete_project_photo_metadata", {
      p_photo_id: "p1",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(nativeStorageRemoveMock).toHaveBeenCalledWith(["native-user-1/proj-1/p1.jpg"]);
    expect(storageRemoveMock).not.toHaveBeenCalled();
    expect(result.storageCleanup).toBe("removed");
  });

  it("new project-photo uploads send cacheControl 60; existing objects are not rewritten", async () => {
    await uploadProjectPhoto({ projectId: "proj-1", file: makeImageFile() });
    expect(PROJECT_PHOTO_CACHE_CONTROL).toBe("60");
    expect(storageUploadMock).toHaveBeenCalledWith(
      "user-1/proj-1/uuid-fixed-0001.jpg",
      expect.anything(),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "60",
      }),
    );
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/photos-write.ts"), "utf8");
    expect(src).toMatch(/cacheControl:\s*PROJECT_PHOTO_CACHE_CONTROL/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/upsert:\s*true/);
  });

  it("source uses dynamic native import and no static SecureStorage client", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/photos-write.ts"), "utf8");
    expect(src).toMatch(/import\(["']@\/platform\/supabase\/native["']\)/);
    expect(src).not.toMatch(
      /import\s*\{[^}]*getNativeSupabase[^}]*\}\s*from\s*["']@\/platform\/supabase\/native["']/,
    );
    expect(src).not.toMatch(/from\s+["']@\/platform\/supabase\/client["']/);
    expect(src).not.toMatch(/from\s+["']@\/platform\/auth\/native/);
    expect(src).toMatch(/if\s*\(\s*!Capacitor\.isNativePlatform\(\)\s*\)/);
  });
});

describe("validation item state", () => {
  it("oversized emits failed with stage validation", async () => {
    const events: Array<{ state: string; stage?: string }> = [];
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    await expect(
      uploadProjectPhoto({
        projectId: "proj-1",
        file: big,
        onItemState: (e) => events.push({ state: e.state, stage: e.stage }),
      }),
    ).rejects.toMatchObject({ stage: "validation" });
    expect(events.some((e) => e.state === "failed" && e.stage === "validation")).toBe(true);
  });
});

describe("shared cross-batch Storage concurrency", () => {
  it("two simultaneous batches never exceed shared Storage cap of 3", async () => {
    let active = 0;
    let maxActive = 0;
    let n = 0;
    randomUUIDMock.mockImplementation(() => `x-${n++}`);

    // Controllable deferred uploads so both batches truly overlap.
    const releaseGates: Array<() => void> = [];
    storageUploadMock.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        releaseGates.push(() => {
          active -= 1;
          resolve();
        });
      });
      return { error: null };
    });
    mockSuccessfulInserts();

    const batchA = Array.from({ length: 3 }, (_, i) => makeImageFile(`a${i}.jpg`));
    const batchB = Array.from({ length: 3 }, (_, i) => makeImageFile(`b${i}.jpg`));

    const p1 = uploadProjectPhotos({ projectId: "proj-1", files: batchA, concurrency: 3 });
    const p2 = uploadProjectPhotos({ projectId: "proj-1", files: batchB, concurrency: 3 });

    // Wait until both batches have queued work into the shared limiter.
    await new Promise((r) => setTimeout(r, 30));
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(0);

    // Release all gated uploads
    while (releaseGates.length > 0) {
      const gate = releaseGates.shift()!;
      gate();
      await new Promise((r) => setTimeout(r, 0));
    }

    await Promise.all([p1, p2]);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("clamps requested concurrency above the canonical cap", async () => {
    let active = 0;
    let maxActive = 0;
    let n = 0;
    randomUUIDMock.mockImplementation(() => `y-${n++}`);
    storageUploadMock.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
      return { error: null };
    });
    mockSuccessfulInserts();
    const files = Array.from({ length: 6 }, (_, i) => makeImageFile(`c${i}.jpg`));
    await uploadProjectPhotos({ projectId: "proj-1", files, concurrency: 10 });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("releases shared permits after a Storage failure", async () => {
    let active = 0;
    let maxActive = 0;
    let n = 0;
    randomUUIDMock.mockImplementation(() => `z-${n++}`);
    let call = 0;
    storageUploadMock.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      call += 1;
      if (call === 1) return { error: { message: "boom" } };
      return { error: null };
    });
    mockSuccessfulInserts();
    const files = [makeImageFile("fail.jpg"), makeImageFile("ok.jpg")];
    await expect(
      uploadProjectPhotos({ projectId: "proj-1", files, concurrency: 2 }),
    ).rejects.toBeInstanceOf(PhotoUploadBatchError);
    // Subsequent batch must still run under the cap (permits released).
    await uploadProjectPhotos({
      projectId: "proj-1",
      files: [makeImageFile("later.jpg")],
      concurrency: 1,
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
