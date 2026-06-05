import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@repo/ui";

describe("Carousel (migrated @repo/ui)", () => {
  it("renders carousel structure with items and controls", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
          <CarouselItem>Slide 2</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );

    expect(screen.getByText("Slide 1")).toBeInTheDocument();
    expect(screen.getByText("Slide 2")).toBeInTheDocument();
    // Controls are buttons
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });
});
