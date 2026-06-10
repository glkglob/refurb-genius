import { describe, it, expect, vi, beforeEach } from "vitest";
import { tradespeopleQueryOptions, tradeFavoritesQueryOptions } from "./marketplace";

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

import { supabase } from "@/platform/supabase/browser";

describe("marketplace queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tradespeopleQueryOptions has correct key and calls supabase", async () => {
    const opts = tradespeopleQueryOptions();
    expect(opts.queryKey).toEqual(["marketplace", "tradespeople"]);
    const result = await (opts.queryFn as () => Promise<unknown>)();
    expect(supabase.from).toHaveBeenCalledWith("tradespeople");
    expect(result).toEqual([]);
  });

  it("tradeFavoritesQueryOptions requires userId", () => {
    const opts = tradeFavoritesQueryOptions("user-123");
    expect(opts.enabled).toBe(true);
    expect(opts.queryKey).toContain("user-123");
  });
});
