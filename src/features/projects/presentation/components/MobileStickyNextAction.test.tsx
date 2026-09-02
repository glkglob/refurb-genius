import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileStickyNextAction } from "./MobileStickyNextAction";

describe("MobileStickyNextAction", () => {
  it("renders navigation sticky CTA from resolver-style href", () => {
    render(
      <MobileStickyNextAction
        label="Add Photos"
        href="/projects/abc/upload"
        actionKind="add_photos"
      />,
    );
    const cta = screen.getByTestId("mobile-sticky-next-action");
    expect(cta.getAttribute("href")).toBe("/projects/abc/upload");
    expect(cta.getAttribute("data-action-kind")).toBe("add_photos");
    expect(cta.textContent).toMatch(/Add Photos/);
  });

  it("renders mutation sticky CTA via onClick without inventing routes", () => {
    const onClick = vi.fn();
    render(
      <MobileStickyNextAction
        label="Analyse Photos"
        onClick={onClick}
        actionKind="analyse_photos"
      />,
    );
    fireEvent.click(screen.getByTestId("mobile-sticky-next-action"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("sits above the bottom destination bar instead of sharing bottom-0", () => {
    render(
      <MobileStickyNextAction
        label="Add Photos"
        href="/projects/abc/upload"
        actionKind="add_photos"
      />,
    );
    const bar = screen.getByTestId("mobile-sticky-next-action-bar");
    expect(bar.className).toMatch(/5\.75rem/);
    expect(bar.className).toMatch(/env\(safe-area-inset-bottom/);
    expect(bar.className).toMatch(/lg:hidden/);
    expect(bar.className).not.toMatch(/bottom-0/);
  });

  it("renders nothing when neither href nor onClick is provided", () => {
    const { container } = render(<MobileStickyNextAction label="Missing" />);
    expect(container.querySelector("[data-testid='mobile-sticky-next-action-bar']")).toBeNull();
  });
});
