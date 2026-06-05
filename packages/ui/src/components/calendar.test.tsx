import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Calendar } from "@repo/ui";

describe("Calendar (migrated @repo/ui)", () => {
  it("renders without crashing and shows month navigation", () => {
    render(<Calendar />);

    // DayPicker renders a grid; check for common calendar UI elements
    expect(screen.getByRole("grid")).toBeInTheDocument();
    // Buttons for nav exist (previous/next month)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
