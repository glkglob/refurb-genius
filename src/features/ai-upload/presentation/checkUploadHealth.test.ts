import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getPhotoWriteClientMock,
  getUserMock,
  storageFromMock,
  storageUploadMock,
  storageRemoveMock,
} = vi.hoisted(() => {
  const storageUploadMock = vi.fn();
  const storageRemoveMock = vi.fn();
  const storageFromMock = vi.fn(() => ({
    upload: storageUploadMock,
    remove: storageRemoveMock,
  }));
  return {
    getPhotoWriteClientMock: vi.fn(),
    getUserMock: vi.fn(),
    storageFromMock,
    storageUploadMock,
    storageRemoveMock,
  };
});

vi.mock("@/lib/photos-write", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photos-write")>();
  return {
    ...actual,
    getPhotoWriteClient: (...args: unknown[]) => getPhotoWriteClientMock(...args),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { checkUploadHealth } from "./checkUploadHealth";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos-write";

const HEALTH_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "checkUploadHealth.ts"),
  "utf8",
);

function makeClient() {
  return {
    auth: { getUser: getUserMock },
    storage: { from: storageFromMock },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "probe-uuid-0001") });
  getPhotoWriteClientMock.mockResolvedValue(makeClient());
  getUserMock.mockResolvedValue({
    data: { user: { id: "user-1", email: "a@b.co" } },
    error: null,
  });
  storageUploadMock.mockResolvedValue({ error: null });
  storageRemoveMock.mockResolvedValue({ data: [], error: null });
});

describe("checkUploadHealth client authority", () => {
  it("uses getPhotoWriteClient for auth, Storage upload, and cleanup", async () => {
    const result = await checkUploadHealth();

    expect(getPhotoWriteClientMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(storageFromMock).toHaveBeenCalledWith(PROJECT_PHOTOS_BUCKET);
    expect(storageUploadMock).toHaveBeenCalledWith(
      "user-1/.health/probe-uuid-0001.probe",
      expect.any(Blob),
      expect.objectContaining({
        contentType: "application/octet-stream",
        upsert: false,
      }),
    );
    expect(storageRemoveMock).toHaveBeenCalledWith(["user-1/.health/probe-uuid-0001.probe"]);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ok");
  });

  it("does not reach Storage when the selected client has no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const result = await checkUploadHealth();

    expect(getPhotoWriteClientMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("auth");
    expect(result.message).toBe("You must be signed in to upload photos.");
    expect(storageFromMock).not.toHaveBeenCalled();
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("does not reach Storage when the selected client auth call errors", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing" },
    });

    const result = await checkUploadHealth();

    expect(result.status).toBe("auth");
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("probe path first segment equals the selected authenticated user id", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "bbbb2222-cccc-dddd-eeee-ffff00001111", email: "n@b.co" } },
      error: null,
    });

    await checkUploadHealth();

    const [path] = storageUploadMock.mock.calls[0] as [string];
    expect(path.split("/")[0]).toBe("bbbb2222-cccc-dddd-eeee-ffff00001111");
  });

  it("source uses the write-path client selector and not a hard browser import", () => {
    expect(HEALTH_SRC).toMatch(/getPhotoWriteClient/);
    expect(HEALTH_SRC).not.toMatch(/from\s+["']@\/platform\/supabase\/browser["']/);
    expect(HEALTH_SRC).not.toMatch(/from\s+["']@\/platform\/supabase\/native["']/);
    expect(HEALTH_SRC).not.toMatch(/from\s+["']@\/lib\/auth["']/);
  });
});
