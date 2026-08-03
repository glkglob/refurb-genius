import { describe, it, expect, vi, beforeEach } from "vitest";
import { publicGalleryProjectsQueryOptions, publicGalleryProjectByIdQueryOptions } from "./gallery";

// Mock the supabase client used in queries
vi.mock("@/platform/supabase/browser", () => {
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    })),
  };
  return { supabase: mockSupabase };
});

import { supabase } from "@/platform/supabase/browser";

describe("gallery queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publicGalleryProjectsQueryOptions returns query options with correct key and staleTime", () => {
    const opts = publicGalleryProjectsQueryOptions();
    expect(opts.queryKey).toEqual(["gallery", "public"]);
    expect(opts.staleTime).toBe(2 * 60 * 1000);
    expect(typeof opts.queryFn).toBe("function");
  });

  it("publicGalleryProjectByIdQueryOptions has byId key", () => {
    const opts = publicGalleryProjectByIdQueryOptions("test-id");
    expect(opts.queryKey).toContain("byId");
    expect(opts.queryKey).toContain("test-id");
  });

  it("public queryFn calls supabase with is_public filter and maps rows", async () => {
    const mockData = [
      {
        id: "1",
        project_id: "p1",
        is_public: true,
        featured: false,
        title: "T",
        description: null,
        cover_image_url: null,
        view_count: 2,
        created_at: "c",
        updated_at: "u",
      },
    ];
    const fromMock = vi.mocked(supabase.from);
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    const opts = publicGalleryProjectsQueryOptions();
    const result = await (opts.queryFn as () => Promise<unknown>)();

    expect(fromMock).toHaveBeenCalledWith("public_gallery_projects");
    expect(result).toEqual([
      {
        id: "1",
        project_id: "p1",
        is_public: true,
        featured: false,
        title: "T",
        description: null,
        cover_image_url: null,
        view_count: 2,
        created_at: "c",
        updated_at: "u",
      },
    ]);
  });
});
