import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Alert, AlertTitle, AlertDescription } from "@repo/ui";

describe("Alert (migrated @repo/ui)", () => {
  it("renders with default variant and children", () => {
    render(
      <Alert>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>You can add components to your app using the cli.</AlertDescription>
      </Alert>,
    );

    expect(screen.getByText("Heads up!")).toBeInTheDocument();
    expect(screen.getByText(/You can add components/)).toBeInTheDocument();
    // default has role alert
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies destructive variant class", () => {
    const { container } = render(<Alert variant="destructive">Error</Alert>);
    // Note: actual cva applies border-destructive/50 etc; check contains
    expect(container.firstChild?.className || "").toContain("border-destructive");
  });
});
