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
  insertMock,
  deleteChainMock,
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
  const insertMock = vi.fn();
  const deleteChainMock = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  // wire chain: delete().eq().select().maybeSingle()
  deleteChainMock.eq.mockImplementation(() => deleteChainMock);
  deleteChainMock.select.mockImplementation(() => deleteChainMock);

  const fromMock = vi.fn((table: string) => {
    if (table === "photos") {
      return {
        insert: insertMock,
        delete: vi.fn(() => deleteChainMock),
      };
    }
    return {};
  });
  return {
    getUserMock: vi.fn(),
    authGetUserMock: vi.fn(),
    storageFromMock,
    storageUploadMock,
    storageRemoveMock,
    getPublicUrlMock,
    fromMock,
    insertMock,
    deleteChainMock,
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
    captureUploadErrorMock: vi.fn(),
    timeoutPromiseMock: vi.fn((p: Promise<unknown>) => p),
    randomUUIDMock: vi.fn(() => "uuid-fixed-0001"),
  };
});

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    auth: { getUser: getUserMock },
    storage: { from: storageFromMock },
    from: fromMock,
  },
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
  PHOTO_WRITE_AUTH_ERROR,
  buildProjectPhotoStoragePath,
  assertSafePathSegment,
  uploadProjectPhoto,
  uploadProjectPhotos,
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

function mockSuccessfulInserts() {
  insertMock.mockImplementation(((payload: { name: string; id: string }) => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: makeRow({
          id: payload.id,
          name: payload.name,
          storage_path: `user-1/proj-1/${payload.id}.jpg`,
        }),
        error: null,
      }),
    })),
  })) as typeof insertMock);
}

beforeEach(() => {
  vi.clearAllMocks();
  timeoutPromiseMock.mockImplementation((p: Promise<unknown>) => p);
  randomUUIDMock.mockReturnValue("uuid-fixed-0001");
  vi.stubGlobal("crypto", { randomUUID: randomUUIDMock });

  getUserMock.mockResolvedValue({
    data: { user: { id: "user-1", email: "a@b.co" } },
    error: null,
  });
  authGetUserMock.mockReturnValue(null);

  storageUploadMock.mockResolvedValue({ error: null });
  storageRemoveMock.mockResolvedValue({ data: [], error: null });
  getPublicUrlMock.mockReturnValue({
    data: { publicUrl: "https://cdn.example/user-1/proj-1/uuid-fixed-0001.jpg" },
  });

  insertMock.mockReturnValue({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: makeRow(), error: null }),
    })),
  });

  deleteChainMock.eq.mockImplementation(() => deleteChainMock);
  deleteChainMock.select.mockImplementation(() => deleteChainMock);
  deleteChainMock.maybeSingle.mockResolvedValue({
    data: { id: "uuid-fixed-0001", storage_path: "user-1/proj-1/uuid-fixed-0001.jpg" },
    error: null,
  });
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

  it("falls back to legacy auth.getUser when session missing", async () => {
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
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "uuid-fixed-0001",
        project_id: "proj-1",
        user_id: "user-1",
        storage_path: "user-1/proj-1/uuid-fixed-0001.jpg",
      }),
    );
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
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rolls back Storage when metadata insert fails and preserves primary error with rollback context", async () => {
    insertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "rls denied", code: "42501" },
        }),
      })),
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
    insertMock.mockImplementation(() => {
      insertCalled = true;
      expect(stages).toContain("saving");
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: makeRow(), error: null }),
        })),
      };
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
    insertMock.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "insert failed" },
        }),
      })),
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

  it("uploads multi-file batch successfully with default concurrency 4", async () => {
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
  it("authenticates before delete and uses deleted row storage_path", async () => {
    deleteChainMock.maybeSingle.mockResolvedValue({
      data: { id: "p1", storage_path: "user-1/proj-1/p1.jpg" },
      error: null,
    });

    const result = await removeProjectPhoto({ photoId: "p1" });

    expect(getUserMock).toHaveBeenCalled();
    expect(deleteChainMock.eq).toHaveBeenCalledWith("id", "p1");
    expect(deleteChainMock.select).toHaveBeenCalledWith("id, storage_path");
    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/proj-1/p1.jpg"]);
    expect(result).toEqual({
      photoId: "p1",
      storagePath: "user-1/proj-1/p1.jpg",
      storageCleanup: "removed",
    });
  });

  it("throws on zero-row delete and does not call Storage", async () => {
    deleteChainMock.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(removeProjectPhoto({ photoId: "missing" })).rejects.toMatchObject({
      stage: "metadata-delete",
      message: "Photo not found",
    });
    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it("throws on database failure and does not call Storage", async () => {
    deleteChainMock.maybeSingle.mockResolvedValue({
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
      expect.objectContaining({ photoId: "uuid-fixed-0001" }),
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
