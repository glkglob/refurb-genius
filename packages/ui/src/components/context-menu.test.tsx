import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@repo/ui";

describe("ContextMenu (migrated @repo/ui)", () => {
  it("renders trigger and content structure", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Right click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item 1</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    expect(screen.getByText("Right click me")).toBeInTheDocument();
    // Content is portaled, initially not visible
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  });
});
