import { describe, it, expect, vi, beforeEach } from "vitest";
import { floorplansByProjectQueryOptions, floorplanModelQueryOptions } from "./floorplans";

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import { supabase } from "@/platform/supabase/browser";

describe("floorplans queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("floorplansByProjectQueryOptions key and fn", async () => {
    const opts = floorplansByProjectQueryOptions("proj");
    expect(opts.queryKey).toContain("floorplans");
    await (opts.queryFn as () => Promise<unknown>)();
    expect(supabase.from).toHaveBeenCalledWith("floorplan_models");
  });

  it("floorplanModelQueryOptions enables on id", () => {
    const opts = floorplanModelQueryOptions("m1");
    expect(opts.enabled).toBe(true);
  });
});
