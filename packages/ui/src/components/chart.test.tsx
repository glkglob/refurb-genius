import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ChartContainer } from "@repo/ui";

describe("Chart (migrated @repo/ui)", () => {
  it("renders chart container without crashing (config provided)", () => {
    const config = {
      desktop: {
        label: "Desktop",
        color: "hsl(var(--chart-1))",
      },
    };

    render(
      <ChartContainer config={config} className="min-h-[200px]">
        <div data-testid="chart-inner">Chart placeholder</div>
      </ChartContainer>,
    );

    expect(screen.getByTestId("chart-inner")).toBeInTheDocument();
    // Config drives CSS vars for theming inside the container; basic presence is the smoke test
    expect(screen.getByTestId("chart-inner").parentElement).toBeInTheDocument();
  });
});
