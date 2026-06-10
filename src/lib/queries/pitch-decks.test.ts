import { describe, it, expect, vi, beforeEach } from "vitest";
import { pitchDecksByProjectQueryOptions } from "./pitch-decks";

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

describe("pitch-decks queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pitchDecksByProjectQueryOptions has project key", () => {
    const opts = pitchDecksByProjectQueryOptions("p1");
    expect(opts.queryKey).toEqual(["projects", "p1", "pitchDecks"]);
  });
});
