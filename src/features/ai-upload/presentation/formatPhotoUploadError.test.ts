import { describe, it, expect } from "vitest";
import {
  formatPhotoUploadError,
  formatPhotoUploadBatchError,
  stageLabel,
} from "./formatPhotoUploadError";
import { PhotoUploadBatchError, PhotoWriteError } from "@/lib/photos-write";

describe("upload-errors", () => {
  it("maps auth stage failures clearly", () => {
    const err = new PhotoWriteError("You must be signed in to manage project photos.", {
      stage: "authentication",
    });
    expect(formatPhotoUploadError(err)).toMatch(/sign in/i);
  });

  it("maps oversized files", () => {
    const err = new PhotoWriteError('"big.jpg" is 12.0MB — maximum is 10MB per photo.', {
      stage: "validation",
    });
    expect(formatPhotoUploadError(err)).toMatch(/too large|12\.0MB|10MB/i);
  });

  it("maps RLS / permission storage errors", () => {
    const err = new PhotoWriteError("new row violates row-level security policy", {
      stage: "storage-upload",
    });
    expect(formatPhotoUploadError(err)).toMatch(/authorised|sign in/i);
  });

  it("summarises partial batch failures", () => {
    const batch = new PhotoUploadBatchError({
      successes: [{ id: "1" } as never],
      failures: [
        {
          index: 1,
          file: new File([new Uint8Array([1])], "bad.jpg", { type: "image/jpeg" }),
          stage: "storage-upload",
          cause: new PhotoWriteError("timeout", { stage: "storage-upload" }),
        },
      ],
      attemptedCount: 2,
    });
    expect(formatPhotoUploadBatchError(batch)).toMatch(/1 uploaded, 1 failed/i);
  });

  it("stageLabel covers known stages", () => {
    expect(stageLabel("metadata-insert")).toBe("Saving details");
    expect(stageLabel("storage-upload")).toBe("Storage");
  });
});
