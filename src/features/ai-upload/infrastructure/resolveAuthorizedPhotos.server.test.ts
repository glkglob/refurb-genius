import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const { createSignedUrl, fromMock, createSupabaseServerClient } = vi.hoisted(() => {
  const createSignedUrl = vi.fn();
  const fromMock = vi.fn();
  const createSupabaseServerClient = vi.fn(async () => ({
    from: fromMock,
    storage: { from: () => ({ createSignedUrl }) },
  }));
  return { createSignedUrl, fromMock, createSupabaseServerClient };
});

vi.mock("@/serverFns/auth.server", () => ({
  createSupabaseServerClient,
}));

import {
  AI_SIGNED_URL_TTL_SECONDS,
  resolveAuthorizedProjectPhotos,
} from "./resolveAuthorizedPhotos.server";
import { PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED } from "../domain";

const USER = "user-1";
const PROJECT = "11111111-1111-1111-1111-111111111111";
const PHOTO = "22222222-2222-2222-2222-222222222222";
const DURABLE_URL = "https://cdn.example/object/public/project-photos/user-1/proj/p.jpg";
const SIGNED_URL = "https://cdn.example/object/sign/project-photos/user-1/proj/p.jpg?token=s";

function chain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const inFn = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn(() => ({ maybeSingle, in: inFn }));
  const eq1 = vi.fn(() => ({ eq: eq2, maybeSingle, in: inFn }));
  return { select: vi.fn(() => ({ eq: eq1 })), maybeSingle, in: inFn };
}

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED_URL }, error: null });
});

describe("resolveAuthorizedProjectPhotos", () => {
  it("selects storage_path, signs it with AI TTL 300, and keeps durable url", async () => {
    const projectChain = chain({ data: { id: PROJECT }, error: null });
    const photoChain = chain({
      data: [
        {
          id: PHOTO,
          url: DURABLE_URL,
          name: "room.jpg",
          size: 12,
          project_id: PROJECT,
          user_id: USER,
          storage_path: "user-1/proj/p.jpg",
        },
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "projects" ? projectChain : photoChain,
    );

    const photos = await resolveAuthorizedProjectPhotos({
      userId: USER,
      projectId: PROJECT,
      photoIds: [PHOTO],
    });

    expect(photoChain.select).toHaveBeenCalledWith(
      "id,url,name,size,project_id,user_id,storage_path",
    );
    expect(AI_SIGNED_URL_TTL_SECONDS).toBe(300);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/proj/p.jpg", 300);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.url).toBe(DURABLE_URL);
    expect(photos[0]?.retrievalUrl).toBe(SIGNED_URL);
    expect(photos[0]?.storagePath).toBe("user-1/proj/p.jpg");
    expect(photos[0]?.retrievalUrl).not.toBe(photos[0]?.url);
  });

  it("does not use a client-supplied URL as retrieval authority", async () => {
    const projectChain = chain({ data: { id: PROJECT }, error: null });
    const photoChain = chain({
      data: [
        {
          id: PHOTO,
          url: DURABLE_URL,
          name: "room.jpg",
          size: 12,
          project_id: PROJECT,
          user_id: USER,
          storage_path: "user-1/proj/p.jpg",
        },
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "projects" ? projectChain : photoChain,
    );

    await resolveAuthorizedProjectPhotos({
      userId: USER,
      projectId: PROJECT,
      photoIds: [PHOTO],
    });

    expect(createSignedUrl.mock.calls[0]?.[0]).toBe("user-1/proj/p.jpg");
    expect(JSON.stringify(createSignedUrl.mock.calls)).not.toContain("https://evil.example");
    expect(JSON.stringify(createSignedUrl.mock.calls)).not.toContain(DURABLE_URL);
  });

  it("fails closed when signing fails instead of falling back to public URL", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "denied" } });
    const projectChain = chain({ data: { id: PROJECT }, error: null });
    const photoChain = chain({
      data: [
        {
          id: PHOTO,
          url: DURABLE_URL,
          name: "room.jpg",
          size: 12,
          project_id: PROJECT,
          user_id: USER,
          storage_path: "user-1/proj/p.jpg",
        },
      ],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "projects" ? projectChain : photoChain,
    );

    await expect(
      resolveAuthorizedProjectPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO],
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED });
  });
});
