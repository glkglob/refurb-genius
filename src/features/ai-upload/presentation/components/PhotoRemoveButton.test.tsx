import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("does not invoke onRemove when disabled", () => {
    const onRemove = vi.fn();
    render(<PhotoRemoveButton photoName="room.jpg" onRemove={onRemove} disabled />);

    fireEvent.click(screen.getByTestId("photo-remove-button"));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("upload grid uses PhotoRemoveButton with per-photo pending only", () => {
    const src = readFileSync(
      join(process.cwd(), "src/routes/_authed/projects.$id.upload.tsx"),
      "utf8",
    );
    expect(src).toMatch(/PhotoRemoveButton/);
    expect(src).toMatch(/removePhoto\.isPending && removePhoto\.variables === p\.id/);
    expect(src).not.toMatch(/disabled=\{removePhoto\.isPending\}/);
  });
});
