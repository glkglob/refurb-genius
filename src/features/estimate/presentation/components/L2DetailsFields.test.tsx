import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { L2DetailsFields, type L2DetailsValue } from "./L2DetailsFields";

function Harness({
  intent = "full-refurb" as const,
  initial,
}: {
  intent?: "full-refurb" | "cosmetic" | null;
  initial?: Partial<L2DetailsValue>;
}) {
  const [value, setValue] = useState<L2DetailsValue>({
    finish: null,
    propertySize: "",
    categoryRefinementEnabled: false,
    categories: [],
    ...initial,
  });
  return (
    <L2DetailsFields
      value={value}
      intent={intent}
      onChange={setValue}
      errors={
        value.categoryRefinementEnabled && value.categories.length === 0
          ? { categories: "Select at least one work category" }
          : undefined
      }
    />
  );
}

describe("L2DetailsFields", () => {
  it("renders finish chips with aria-pressed", () => {
    render(<Harness />);
    const premium = screen.getByRole("button", { name: "Premium" });
    expect(premium).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(premium);
    expect(premium).toHaveAttribute("aria-pressed", "true");
  });

  it("labels size input and associates helper text", () => {
    render(<Harness />);
    const size = screen.getByLabelText(/floor area/i);
    expect(size).toHaveAttribute("type", "number");
    expect(size).toHaveAttribute("min", "20");
    expect(size).toHaveAttribute("max", "500");
    expect(screen.getByText(/typical flat/i)).toBeInTheDocument();
    expect(size.getAttribute("aria-describedby")).toMatch(/l2-size-help/);
  });

  it("seeds intent categories when refinement is enabled", () => {
    render(<Harness intent="cosmetic" />);
    fireEvent.click(screen.getByLabelText(/refine work categories/i));
    expect(screen.getByLabelText("Painting")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Flooring")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Kitchen")).toHaveAttribute("aria-checked", "false");
  });

  it("uses semantic checkboxes for categories", () => {
    render(<Harness intent="full-refurb" />);
    fireEvent.click(screen.getByLabelText(/refine work categories/i));
    const group = screen.getByRole("group", { name: /work categories/i });
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(5);
  });

  it("shows validation state when categories are emptied while refinement enabled", () => {
    render(<Harness intent="cosmetic" />);
    fireEvent.click(screen.getByLabelText(/refine work categories/i));
    fireEvent.click(screen.getByLabelText("Painting"));
    fireEvent.click(screen.getByLabelText("Flooring"));
    expect(screen.getByText(/select at least one work category/i)).toBeInTheDocument();
  });

  it("disables refinement until intent is selected", () => {
    render(<Harness intent={null} />);
    expect(screen.getByLabelText(/refine work categories/i)).toBeDisabled();
  });

  it("notifies onChange when size changes", () => {
    const onChange = vi.fn();
    render(
      <L2DetailsFields
        value={{
          finish: null,
          propertySize: "",
          categoryRefinementEnabled: false,
          categories: [],
        }}
        intent="full-refurb"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ propertySize: "120" }));
  });

  it("sets aria-controls only while category refinement is enabled", () => {
    render(<Harness intent="full-refurb" />);
    const toggle = screen.getByLabelText(/refine work categories/i);
    expect(toggle).not.toHaveAttribute("aria-controls");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-controls", "l2-category-group");
    expect(document.getElementById("l2-category-group")).not.toBeNull();
  });
});
