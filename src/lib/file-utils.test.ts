import { describe, it, expect } from "vitest";
import { formatFileSize, isImageFile, imageContentType } from "@/lib/file-utils";

describe("formatFileSize", () => {
  it("formats bytes under 1 KB as B", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats 1 KB boundary as integer KB", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    // 1536 / 1024 = 1.5 → toFixed(0) → "2"
    expect(formatFileSize(1536)).toBe("2 KB");
  });

  it("formats 1 MiB and multi-MB values with one decimal", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("isImageFile / imageContentType smoke", () => {
  it("detects jpeg by mime", () => {
    const f = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    expect(isImageFile(f)).toBe(true);
    expect(imageContentType(f)).toBe("image/jpeg");
  });
});
