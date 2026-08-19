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
  resolveCanonicalAuthorizedPhotos,
  signAuthorizedPhotoBatch,
  type PhotoAnalysisAuthClient,
} from "./resolveAuthorizedPhotos.server";
import {
  PHOTO_ANALYSIS_DUPLICATE_PHOTO_IDS,
  PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED,
  PHOTO_ANALYSIS_RETRIEVAL_UNAVAILABLE,
  PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED,
  PHOTO_ANALYSIS_SOURCE_SET_MISMATCH,
} from "../domain";

const USER = "user-1";
const OTHER = "user-2";
const PROJECT = "11111111-1111-1111-1111-111111111111";
const PHOTO = "22222222-2222-2222-2222-222222222222";
const PHOTO_B = "33333333-3333-3333-3333-333333333333";
const DURABLE_URL = "https://cdn.example/object/public/project-photos/user-1/proj/p.jpg";
const SIGNED_URL = "https://cdn.example/object/sign/project-photos/user-1/proj/p.jpg?token=s";

function photoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PHOTO,
    url: DURABLE_URL,
    name: "room.jpg",
    size: 12,
    project_id: PROJECT,
    user_id: USER,
    storage_path: "user-1/proj/p.jpg",
    ...overrides,
  };
}

function makeClient(opts: {
  project?: { data: unknown; error: unknown };
  photos?: { data: unknown; error: unknown };
}): PhotoAnalysisAuthClient {
  const projectResult = opts.project ?? { data: { id: PROJECT }, error: null };
  const photosResult = opts.photos ?? { data: [photoRow()], error: null };

  const projectBuilder = {
    select: vi.fn(() => projectBuilder),
    eq: vi.fn(() => projectBuilder),
    maybeSingle: vi.fn(async () => projectResult),
  };

  const photoBuilder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    select: vi.fn(() => photoBuilder),
    eq: vi.fn(() => photoBuilder),
    in: vi.fn(async () => photosResult),
    then: (resolve, reject) => Promise.resolve(photosResult).then(resolve, reject),
  };

  fromMock.mockImplementation((table: string) =>
    table === "projects" ? projectBuilder : photoBuilder,
  );

  return {
    from: fromMock as PhotoAnalysisAuthClient["from"],
    storage: { from: () => ({ createSignedUrl }) } as unknown as PhotoAnalysisAuthClient["storage"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED_URL }, error: null });
});

describe("resolveCanonicalAuthorizedPhotos", () => {
  it("returns canonical rows without retrievalUrl and does not sign", async () => {
    const supabase = makeClient({});
    const photos = await resolveCanonicalAuthorizedPhotos({
      userId: USER,
      projectId: PROJECT,
      photoIds: [PHOTO],
      supabase,
      catalogueMode: "requested",
    });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(photos).toHaveLength(1);
    expect(photos[0]?.url).toBe(DURABLE_URL);
    expect(photos[0]?.storagePath).toBe("user-1/proj/p.jpg");
    expect(photos[0]).not.toHaveProperty("retrievalUrl");
  });

  it("rejects duplicate client IDs as 400 before catalogue work", async () => {
    const supabase = makeClient({});
    await expect(
      resolveCanonicalAuthorizedPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO, PHOTO],
        supabase,
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_DUPLICATE_PHOTO_IDS });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("exact mode requires complete catalogue set equality", async () => {
    const supabase = makeClient({
      photos: {
        data: [
          photoRow(),
          photoRow({ id: PHOTO_B, name: "b.jpg", storage_path: "user-1/proj/b.jpg" }),
        ],
        error: null,
      },
    });

    await expect(
      resolveCanonicalAuthorizedPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO],
        supabase,
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_SOURCE_SET_MISMATCH });
  });

  it("exact mode rejects a client superset", async () => {
    const supabase = makeClient({
      photos: { data: [photoRow()], error: null },
    });

    await expect(
      resolveCanonicalAuthorizedPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO, PHOTO_B],
        supabase,
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_SOURCE_SET_MISMATCH });
  });

  it("rejects missing storage_path before any signing", async () => {
    const supabase = makeClient({
      photos: { data: [photoRow({ storage_path: null })], error: null },
    });

    await expect(
      resolveCanonicalAuthorizedPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO],
        supabase,
        catalogueMode: "requested",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_SOURCE_NOT_AUTHORISED });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects a project that is not owned by the authenticated user", async () => {
    const supabase = makeClient({
      project: { data: null, error: null },
    });

    await expect(
      resolveCanonicalAuthorizedPhotos({
        userId: OTHER,
        projectId: PROJECT,
        photoIds: [PHOTO],
        supabase,
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED });
  });

  it("does not treat .in(photoIds) as exact-catalogue proof", async () => {
    const supabase = makeClient({
      photos: {
        data: [
          photoRow(),
          photoRow({ id: PHOTO_B, name: "b.jpg", storage_path: "user-1/proj/b.jpg" }),
        ],
        error: null,
      },
    });

    await expect(
      resolveCanonicalAuthorizedPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO],
        supabase,
        catalogueMode: "exact",
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_SOURCE_SET_MISMATCH });
  });
});

describe("signAuthorizedPhotoBatch", () => {
  it("signs only the supplied batch from canonical storage_path with TTL 300", async () => {
    const supabase = makeClient({});
    const signed = await signAuthorizedPhotoBatch(supabase, [
      {
        id: PHOTO,
        url: DURABLE_URL,
        name: "room.jpg",
        size: 12,
        storagePath: "user-1/proj/p.jpg",
      },
    ]);

    expect(AI_SIGNED_URL_TTL_SECONDS).toBe(300);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/proj/p.jpg", 300);
    expect(signed[0]?.retrievalUrl).toBe(SIGNED_URL);
    expect(signed[0]?.url).toBe(DURABLE_URL);
    expect(signed[0]?.retrievalUrl).not.toBe(signed[0]?.url);
  });

  it("does not use a client-supplied URL as retrieval authority", async () => {
    const supabase = makeClient({});
    await signAuthorizedPhotoBatch(supabase, [
      {
        id: PHOTO,
        url: "https://evil.example/steal.jpg",
        name: "room.jpg",
        storagePath: "user-1/proj/p.jpg",
      },
    ]);

    expect(createSignedUrl.mock.calls[0]?.[0]).toBe("user-1/proj/p.jpg");
    expect(JSON.stringify(createSignedUrl.mock.calls)).not.toContain("https://evil.example");
  });

  it("fails closed when signing fails instead of falling back to public URL", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "denied" } });
    const supabase = makeClient({});

    await expect(
      signAuthorizedPhotoBatch(supabase, [
        {
          id: PHOTO,
          url: DURABLE_URL,
          name: "room.jpg",
          storagePath: "user-1/proj/p.jpg",
        },
      ]),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_RETRIEVAL_UNAVAILABLE });
  });
});

describe("resolveAuthorizedProjectPhotos web wrapper", () => {
  it("selects storage_path, signs it with AI TTL 300, and keeps durable url", async () => {
    makeClient({});
    const photos = await resolveAuthorizedProjectPhotos({
      userId: USER,
      projectId: PROJECT,
      photoIds: [PHOTO],
    });

    expect(createSupabaseServerClient).toHaveBeenCalled();
    expect(AI_SIGNED_URL_TTL_SECONDS).toBe(300);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/proj/p.jpg", 300);
    expect(photos).toHaveLength(1);
    expect(photos[0]?.url).toBe(DURABLE_URL);
    expect(photos[0]?.retrievalUrl).toBe(SIGNED_URL);
    expect(photos[0]?.storagePath).toBe("user-1/proj/p.jpg");
    expect(photos[0]?.retrievalUrl).not.toBe(photos[0]?.url);
  });

  it("does not use a client-supplied URL as retrieval authority", async () => {
    makeClient({});
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
    makeClient({});

    await expect(
      resolveAuthorizedProjectPhotos({
        userId: USER,
        projectId: PROJECT,
        photoIds: [PHOTO],
      }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_RETRIEVAL_UNAVAILABLE });
  });
});
