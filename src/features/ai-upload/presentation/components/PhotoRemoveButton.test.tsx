import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoRemoveButton } from "./PhotoRemoveButton";

describe("PhotoRemoveButton", () => {
  it("is labelled for the photo and visible without hover on small viewports", () => {
    render(<PhotoRemoveButton photoName="IMG_0164.png" onRemove={() => undefined} />);

    const button = screen.getByRole("button", { name: "Remove IMG_0164.png" });
    expect(button).toBeVisible();
    expect(button.className).toMatch(/opacity-100/);
    expect(button.className).not.toMatch(/(?:^|\s)opacity-0(?:\s|$)/);
    expect(button.className).toMatch(/h-11/);
    expect(button.className).toMatch(/w-11/);
    expect(button.className).toMatch(/md:opacity-0/);
  });

  it("invokes onRemove when pressed", () => {
    const onRemove = vi.fn();
    render(<PhotoRemoveButton photoName="room.jpg" onRemove={onRemove} />);

    fireEvent.click(screen.getByTestId("photo-remove-button"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
