vi.mock("@tanstack/react-start/server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED } from "../domain";
import {
  AI_SIGNED_URL_TTL_SECONDS,
  listAuthorizedProjectPhotosWithClient,
} from "./resolveAuthorizedPhotos.server";

const USER = "user-1";
const OTHER = "user-2";
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO = "11111111-aaaa-4aaa-8aaa-111111111111";

function makeClient(opts: {
  project?: { data: unknown; error: unknown };
  photos?: { data: unknown; error: unknown };
  signedUrl?: string | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(opts.project ?? { data: null, error: null });
  const order = vi.fn().mockResolvedValue(opts.photos ?? { data: [], error: null });
  const eqUser = vi.fn(() => ({ maybeSingle, order }));
  const eqId = vi.fn(() => ({ eq: eqUser }));
  const select = vi.fn(() => ({ eq: eqId }));
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: opts.signedUrl === null ? null : { signedUrl: opts.signedUrl ?? "https://signed/p.jpg" },
    error: null,
  });
  return {
    from: vi.fn(() => ({ select })),
    rpc: vi.fn(),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
    createSignedUrl,
    select,
  };
}

describe("listAuthorizedProjectPhotosWithClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owner project lists and signs canonical photos", async () => {
    const client = makeClient({
      project: { data: { id: PROJECT }, error: null },
      photos: {
        data: [
          {
            id: PHOTO,
            url: "https://cdn/p.jpg",
            name: "p.jpg",
            size: 10,
            project_id: PROJECT,
            user_id: USER,
            storage_path: "user-1/p.jpg",
          },
        ],
        error: null,
      },
    });

    const photos = await listAuthorizedProjectPhotosWithClient(client, {
      userId: USER,
      projectId: PROJECT,
    });

    expect(photos).toHaveLength(1);
    expect(photos[0]?.id).toBe(PHOTO);
    expect(photos[0]?.url).toBe("https://cdn/p.jpg");
    expect(photos[0]?.retrievalUrl).toBe("https://signed/p.jpg");
    expect(client.createSignedUrl).toHaveBeenCalledWith("user-1/p.jpg", AI_SIGNED_URL_TTL_SECONDS);
  });

  it("other user's / missing project is not authorised", async () => {
    const client = makeClient({
      project: { data: null, error: null },
    });
    await expect(
      listAuthorizedProjectPhotosWithClient(client, { userId: OTHER, projectId: PROJECT }),
    ).rejects.toMatchObject({ code: PHOTO_ANALYSIS_PROJECT_NOT_AUTHORISED });
    expect(client.createSignedUrl).not.toHaveBeenCalled();
  });

  it("owned project with zero photos returns empty without signing", async () => {
    const client = makeClient({
      project: { data: { id: PROJECT }, error: null },
      photos: { data: [], error: null },
    });
    await expect(
      listAuthorizedProjectPhotosWithClient(client, { userId: USER, projectId: PROJECT }),
    ).resolves.toEqual([]);
    expect(client.createSignedUrl).not.toHaveBeenCalled();
  });
});
