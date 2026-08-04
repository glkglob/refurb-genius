/**
 * P0-PHOTO-1 — PhotoUploadZone capture / library selection behaviour.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { PhotoUploadZone } from "./PhotoUploadZone";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

function makeImage(name: string, type = "image/jpeg", size = 100): File {
  return new File([new Uint8Array(size)], name, { type });
}

function makeMimeEmptyImage(name: string): File {
  // Mobile captures sometimes ship with an empty MIME type.
  return new File([new Uint8Array(64)], name, { type: "" });
}

function getCameraInput(): HTMLInputElement {
  return screen.getByTestId("property-photo-camera-input") as HTMLInputElement;
}

function getLibraryInput(): HTMLInputElement {
  return screen.getByTestId("property-photo-library-input") as HTMLInputElement;
}

function fireFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
  fireEvent.change(input);
}

beforeEach(() => {
  toastError.mockReset();
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

describe("PhotoUploadZone", () => {
  it("Take Photo triggers the camera input click", () => {
    render(createElement(PhotoUploadZone, { onPhotosSelected: vi.fn() }));
    const camera = getCameraInput();
    const clickSpy = vi.spyOn(camera, "click");
    fireEvent.click(screen.getByRole("button", { name: /take photo/i }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("Upload from Library triggers the library input click", () => {
    render(createElement(PhotoUploadZone, { onPhotosSelected: vi.fn() }));
    const library = getLibraryInput();
    const clickSpy = vi.spyOn(library, "click");
    fireEvent.click(screen.getByRole("button", { name: /upload from library/i }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("camera input is single-file with capture=environment", () => {
    render(createElement(PhotoUploadZone, { onPhotosSelected: vi.fn() }));
    const camera = getCameraInput();
    expect(camera).toHaveAttribute("type", "file");
    expect(camera).toHaveAttribute("accept", "image/*");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).not.toHaveAttribute("multiple");
  });

  it("library input supports multiple image selection", () => {
    render(createElement(PhotoUploadZone, { onPhotosSelected: vi.fn() }));
    const library = getLibraryInput();
    expect(library).toHaveAttribute("type", "file");
    expect(library).toHaveAttribute("accept", "image/*");
    expect(library).toHaveAttribute("multiple");
  });

  it("accepts image files and reports them to the parent", () => {
    const onPhotosSelected = vi.fn();
    render(createElement(PhotoUploadZone, { onPhotosSelected }));
    fireFiles(getLibraryInput(), [makeImage("room.jpg")]);
    expect(onPhotosSelected).toHaveBeenCalledTimes(1);
    const files = onPhotosSelected.mock.calls[0]![0] as File[];
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe("room.jpg");
    expect(screen.getByText(/Selected \(1\/20\)/i)).toBeTruthy();
  });

  it("accepts HEIC and MIME-empty mobile-style files by extension", () => {
    const onPhotosSelected = vi.fn();
    render(createElement(PhotoUploadZone, { onPhotosSelected }));
    fireFiles(getLibraryInput(), [
      makeImage("iphone.heic", "image/heic"),
      makeMimeEmptyImage("mobile-capture.JPG"),
    ]);
    const files = onPhotosSelected.mock.calls[0]![0] as File[];
    expect(files.map((f) => f.name)).toEqual(["iphone.heic", "mobile-capture.JPG"]);
  });

  it("shows an error for non-image files and does not add them", () => {
    const onPhotosSelected = vi.fn();
    render(createElement(PhotoUploadZone, { onPhotosSelected }));
    fireFiles(getLibraryInput(), [
      new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }),
    ]);
    expect(toastError).toHaveBeenCalled();
    expect(onPhotosSelected).not.toHaveBeenCalled();
  });

  it("allows selecting the same file again after input reset", () => {
    const onPhotosSelected = vi.fn();
    render(createElement(PhotoUploadZone, { onPhotosSelected }));
    const library = getLibraryInput();
    const file = makeImage("same.jpg");
    fireFiles(library, [file]);
    expect(library.value).toBe("");
    // Parent-controlled re-render with one photo already selected.
    onPhotosSelected.mockClear();
    fireFiles(library, [makeImage("same.jpg")]);
    // Controlled mode without photos prop uses internal state; second select appends.
    expect(onPhotosSelected).toHaveBeenCalled();
  });

  it("enforces the maximum photo count", () => {
    const onPhotosSelected = vi.fn();
    render(
      createElement(PhotoUploadZone, {
        onPhotosSelected,
        maxPhotos: 2,
        photos: [makeImage("a.jpg"), makeImage("b.jpg")],
      }),
    );
    fireFiles(getLibraryInput(), [makeImage("c.jpg")]);
    expect(toastError).toHaveBeenCalled();
    expect(onPhotosSelected).not.toHaveBeenCalled();
  });

  it("removes a photo and clears all", () => {
    const onPhotosSelected = vi.fn();
    const photos = [makeImage("a.jpg"), makeImage("b.jpg")];
    const { rerender } = render(createElement(PhotoUploadZone, { onPhotosSelected, photos }));
    fireEvent.click(screen.getByRole("button", { name: /remove a\.jpg/i }));
    expect(onPhotosSelected).toHaveBeenCalledWith([photos[1]]);

    onPhotosSelected.mockClear();
    rerender(
      createElement(PhotoUploadZone, {
        onPhotosSelected,
        photos: [photos[1]!],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onPhotosSelected).toHaveBeenCalledWith([]);
  });

  it("loading state disables capture and library buttons only", () => {
    render(
      createElement(PhotoUploadZone, {
        onPhotosSelected: vi.fn(),
        isLoading: true,
      }),
    );
    expect(screen.getByRole("button", { name: /take photo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /upload from library/i })).toBeDisabled();
    expect(getCameraInput()).toBeDisabled();
    expect(getLibraryInput()).toBeDisabled();
  });

  it("does not require a project prop to enable selection", () => {
    render(createElement(PhotoUploadZone, { onPhotosSelected: vi.fn(), isLoading: false }));
    expect(screen.getByRole("button", { name: /take photo/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /upload from library/i })).not.toBeDisabled();
  });
});
