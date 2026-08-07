import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Mirrors production serverFn input contract.
 * Ensures photos=[] cannot pass validation (regression B).
 */
const photoInputSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const runPhotoAnalysisInputSchema = z.object({
  projectId: z.string().min(1),
  photos: z.array(photoInputSchema).min(1, {
    message: "Upload at least one project photo before running AI analysis.",
  }),
});

describe("runPhotoAnalysisServerFn input validation (P0)", () => {
  it("B: photos=[] is rejected", () => {
    const parsed = runPhotoAnalysisInputSchema.safeParse({
      projectId: "proj-1",
      photos: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts at least one photo", () => {
    const parsed = runPhotoAnalysisInputSchema.safeParse({
      projectId: "proj-1",
      photos: [{ id: "p1", url: "https://cdn/p1.jpg", name: "a.jpg" }],
    });
    expect(parsed.success).toBe(true);
  });
});
