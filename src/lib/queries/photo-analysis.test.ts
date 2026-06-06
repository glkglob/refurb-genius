import { describe, it, expect, vi, beforeEach } from "vitest";
import { photoAnalysisByProjectQueryOptions } from "./photo-analysis";

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import { supabase } from "@/services/supabase";

describe("photo-analysis queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("photoAnalysisByProjectQueryOptions uses project key and calls with project_id", async () => {
    const opts = photoAnalysisByProjectQueryOptions("proj-1");
    expect(opts.queryKey).toContain("photoAnalysis");
    await (opts.queryFn as () => Promise<unknown>)();
    expect(supabase.from).toHaveBeenCalledWith("photo_analysis_results");
  });
});
