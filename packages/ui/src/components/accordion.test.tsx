import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@repo/ui";

describe("Accordion (migrated @repo/ui)", () => {
  it("renders items and trigger content", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByText("Is it accessible?")).toBeInTheDocument();
    // Content may be hidden via state; structure test
    expect(screen.getByRole("button", { name: /Is it accessible/ })).toBeInTheDocument();
  });
});
