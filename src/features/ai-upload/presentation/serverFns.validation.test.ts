import { describe, expect, it } from "vitest";
import { z } from "zod";

const photoInputSchema = z.object({
  id: z.string().uuid(),
  url: z.string().optional(),
  name: z.string().optional(),
  size: z.number().nonnegative().optional(),
});

const runPhotoAnalysisInputSchema = z
  .object({
    projectId: z.string().uuid(),
    photoIds: z.array(z.string().uuid()).min(1).optional(),
    photos: z.array(photoInputSchema).min(1).optional(),
  })
  .superRefine((val, ctx) => {
    const ids = val.photoIds ?? val.photos?.map((p) => p.id) ?? [];
    if (ids.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Upload at least one project photo before running AI analysis.",
        path: ["photos"],
      });
    }
  });

const PROJECT = "11111111-1111-1111-1111-111111111111";
const PHOTO = "22222222-2222-2222-2222-222222222222";

describe("runPhotoAnalysisServerFn input validation (P0 R2)", () => {
  it("B: empty photos rejected", () => {
    const parsed = runPhotoAnalysisInputSchema.safeParse({
      projectId: PROJECT,
      photos: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts photoIds", () => {
    const parsed = runPhotoAnalysisInputSchema.safeParse({
      projectId: PROJECT,
      photoIds: [PHOTO],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts photos with id selector only", () => {
    const parsed = runPhotoAnalysisInputSchema.safeParse({
      projectId: PROJECT,
      photos: [{ id: PHOTO, url: "https://cdn/x.jpg", name: "x.jpg" }],
    });
    expect(parsed.success).toBe(true);
  });
});
