import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { compareConditionLevels } from "../../application";
import { ConditionLevelCompare } from "./ConditionLevelCompare";

const rows = compareConditionLevels({
  region: "London",
  property_condition: "Dated",
  finish_quality: "Standard",
  selected_categories: ["Kitchen", "Bathroom"],
  property_size_sqm: 90,
});

describe("ConditionLevelCompare", () => {
  it("states that comparison is advisory and the selected condition is the working estimate", () => {
    render(<ConditionLevelCompare rows={rows} selectedCondition="Dated" />);
    const copy = screen.getByText(/advisory only/i);
    expect(copy).toHaveTextContent("The selected condition (Dated) remains the working estimate.");
    expect(copy).toHaveTextContent("Alternative rows are not saved automatically.");
    expect(copy).not.toHaveTextContent(/saved and working/i);
  });

  it("exposes a captioned table with column and row headers", () => {
    render(<ConditionLevelCompare rows={rows} selectedCondition="Dated" />);
    const table = screen.getByRole("table", {
      name: /advisory cost comparison by property condition/i,
    });
    expect(within(table).getByRole("columnheader", { name: "Condition" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(within(table).getByRole("columnheader", { name: "Mid estimate" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(within(table).getByRole("columnheader", { name: "Range" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(within(table).getByRole("rowheader", { name: /Dated/ })).toHaveAttribute("scope", "row");
    expect(within(table).getByText("Current estimate")).toBeInTheDocument();
  });
});
