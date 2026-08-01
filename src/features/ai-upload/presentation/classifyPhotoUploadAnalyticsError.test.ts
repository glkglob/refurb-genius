import { describe, it, expect } from "vitest";
import { PhotoUploadBatchError, PhotoWriteError } from "@/lib/photos-write";
import { classifyPhotoUploadAnalyticsError } from "./classifyPhotoUploadAnalyticsError";

describe("classifyPhotoUploadAnalyticsError", () => {
  it("maps batch file-count limit to zero attempts", () => {
    const err = new PhotoWriteError("Too many files", {
      stage: "validation",
      code: "file_count_limit",
    });
    expect(classifyPhotoUploadAnalyticsError(err, 31)).toEqual({
      stage: "batch_validation",
      reason: "file_count_limit",
      attempted_count: 0,
      failure_count: 0,
      selected_count: 31,
    });
  });

  it("maps auth failure to zero attempts", () => {
    const err = new PhotoWriteError("signed in", {
      stage: "authentication",
      code: "not_authenticated",
    });
    expect(classifyPhotoUploadAnalyticsError(err, 2)).toMatchObject({
      stage: "authentication",
      reason: "not_authenticated",
      attempted_count: 0,
      failure_count: 0,
    });
  });

  it("uses structured batch failure counts", () => {
    const err = new PhotoUploadBatchError({
      successes: [{ id: "1" } as never],
      failures: [
        {
          index: 1,
          file: new File([new Uint8Array([1])], "x.jpg", { type: "image/jpeg" }),
          stage: "storage-upload",
          cause: new PhotoWriteError("boom", {
            stage: "storage-upload",
            code: "storage_upload_failed",
          }),
        },
      ],
      attemptedCount: 2,
    });
    const out = classifyPhotoUploadAnalyticsError(err, 2);
    expect(out.attempted_count).toBe(2);
    expect(out.failure_count).toBe(1);
    expect(out.reason).toBe("storage_upload_failed");
  });

  it("never invents attempts for unknown errors", () => {
    expect(classifyPhotoUploadAnalyticsError(new Error("raw secret path"), 5)).toEqual({
      stage: "unknown",
      reason: "unknown",
      attempted_count: 0,
      failure_count: 0,
      selected_count: 5,
    });
  });
});
