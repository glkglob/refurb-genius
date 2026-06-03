import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui";

describe("Popover (migrated @repo/ui)", () => {
  it("renders trigger and can show content structure (basic)", () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <div>Popover content here</div>
        </PopoverContent>
      </Popover>,
    );

    expect(screen.getByText("Open")).toBeInTheDocument();
    // Content is portaled, so may not be in DOM until open; basic structure test passes if no crash
    expect(screen.queryByText("Popover content here")).not.toBeInTheDocument(); // not open yet
  });
});
