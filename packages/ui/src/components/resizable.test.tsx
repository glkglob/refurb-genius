import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@repo/ui";

describe("Resizable (migrated @repo/ui)", () => {
  it("renders resizable panel group with panels and handle", () => {
    render(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>Left</ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>Right</ResizablePanel>
      </ResizablePanelGroup>,
    );

    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
    const group = document.querySelector("[data-group]");
    expect(group).toBeTruthy();
  });
});
