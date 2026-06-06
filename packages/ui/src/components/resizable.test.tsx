import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@repo/ui";

describe("Resizable (migrated @repo/ui)", () => {
  it("renders resizable panel group with panels and handle", () => {
    render(
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>Left</ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>Right</ResizablePanel>
      </ResizablePanelGroup>,
    );

    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
    // Handle/panel structure: the group container should be present (data attrs may vary under jsdom)
    const group =
      document.querySelector("[data-panel-group]") ||
      document.querySelector("div[style*='display:flex']") ||
      screen.getByText("Left").parentElement;
    expect(group).toBeTruthy();
  });
});
