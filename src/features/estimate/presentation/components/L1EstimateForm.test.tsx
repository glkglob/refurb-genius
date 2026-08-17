import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { L1EstimateForm } from "./L1EstimateForm";
import * as application from "../../application";

function fillL1(opts?: { postcode?: string; condition?: string; intent?: string }) {
  fireEvent.change(screen.getByLabelText(/postcode/i), {
    target: { value: opts?.postcode ?? "E1 6AN" },
  });
  fireEvent.click(screen.getByRole("button", { name: opts?.condition ?? "Dated" }));
  fireEvent.click(screen.getByRole("button", { name: opts?.intent ?? "Full refurb" }));
}

function openDetails() {
  fireEvent.click(screen.getByRole("button", { name: /add more detail/i }));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /get estimate|update estimate/i }));
}

describe("L1EstimateForm progressive journey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the closed path through runL1Estimate with Low confidence and Engine rates", () => {
    const l1Spy = vi.spyOn(application, "runL1Estimate");
    const l2Spy = vi.spyOn(application, "runL2Estimate");
    render(<L1EstimateForm />);
    fillL1();
    submit();
    expect(l1Spy).toHaveBeenCalledTimes(1);
    expect(l2Spy).not.toHaveBeenCalled();
    expect(screen.getByText(/engine rates/i)).toBeInTheDocument();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
  });

  it("expands L2 controls via Add more detail", () => {
    render(<L1EstimateForm />);
    const toggle = screen.getByRole("button", { name: /add more detail/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/floor area/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Premium" })).toBeInTheDocument();
  });

  it("produces Medium confidence for finish + size + eligible postcode via real L2 path", () => {
    render(<L1EstimateForm />);
    fillL1({ postcode: "E1 6AN" });
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/confidence:\s*medium/i)).toBeInTheDocument();
    expect(screen.getByText(/engine rates/i)).toBeInTheDocument();
    // key drivers provenance
    const summary = screen.getByText(/estimated cost/i).closest("div")?.parentElement;
    expect(summary?.textContent).toMatch(/Premium/);
    expect(summary?.textContent).toMatch(/120 m²/);
    expect(summary?.textContent).not.toMatch(/120 m² \(assumed\)/);
    expect(summary?.textContent).toMatch(/from intent/i);
  });

  it("keeps Low when finish is missing", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
  });

  it("keeps Low when size is missing", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    submit();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
  });

  it("keeps Low for bare SW even with finish and size", () => {
    render(<L1EstimateForm />);
    fillL1({ postcode: "SW" });
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
  });

  it("shows an error for ZZ1 1ZZ instead of pricing as London", () => {
    render(<L1EstimateForm />);
    fillL1({ postcode: "ZZ1 1ZZ" });
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/postcode area was missing or unrecognised/i)).toBeInTheDocument();
    expect(screen.queryByText(/confidence:\s*low/i)).not.toBeInTheDocument();
  });

  it("does not show size not provided for explicit 90 m²", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "90" } });
    submit();
    expect(screen.queryByText(/size not provided/i)).not.toBeInTheDocument();
    expect(screen.getByText(/confidence:\s*medium/i)).toBeInTheDocument();
  });

  it("does not require category override for Medium", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Standard" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "110" } });
    // refinement left off
    submit();
    expect(screen.getByText(/confidence:\s*medium/i)).toBeInTheDocument();
  });

  it("blocks submission when enabled categories are empty", () => {
    render(<L1EstimateForm />);
    fillL1({ intent: "Cosmetic" });
    openDetails();
    fireEvent.click(screen.getByLabelText(/refine work categories/i));
    fireEvent.click(screen.getByLabelText("Painting"));
    fireEvent.click(screen.getByLabelText("Flooring"));
    submit();
    expect(screen.getByText(/select at least one work category/i)).toBeInTheDocument();
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();
  });

  it("rejects size 19 and 501", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "19" } });
    submit();
    expect(screen.getByText(/between 20 and 500/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "501" } });
    submit();
    expect(screen.getByText(/between 20 and 500/i)).toBeInTheDocument();
  });

  it("accepts size 20 and 500 but keeps Low due to extreme size warnings", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));

    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "20" } });
    submit();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
    expect(screen.getByText(/minimum cost band|very small property/i)).toBeInTheDocument();

    // change size clears and re-submit 500
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "500" } });
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();
    submit();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
    expect(screen.getByText(/size multiplier capped|very large property/i)).toBeInTheDocument();
  });

  it("clears the prior result when any L1 input changes", () => {
    render(<L1EstimateForm />);
    fillL1();
    submit();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/postcode/i), { target: { value: "M1 1AE" } });
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();
  });

  it("clears the prior result when finish, size or categories change", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "130" } });
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    submit();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/refine work categories/i));
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();
  });

  it("does not remove a successful result when onEstimated throws", () => {
    const onEstimated = vi.fn(() => {
      throw new Error("analytics down");
    });
    render(<L1EstimateForm onEstimated={onEstimated} />);
    fillL1();
    submit();
    expect(onEstimated).toHaveBeenCalled();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not generate estimate/i)).not.toBeInTheDocument();
  });

  it("keeps accessible selected state on condition chips", () => {
    render(<L1EstimateForm />);
    const dated = screen.getByRole("button", { name: "Dated" });
    fireEvent.click(dated);
    expect(dated).toHaveAttribute("aria-pressed", "true");
    const poor = screen.getByRole("button", { name: "Poor" });
    fireEvent.click(poor);
    expect(poor).toHaveAttribute("aria-pressed", "true");
    expect(dated).toHaveAttribute("aria-pressed", "false");
  });

  it("retains a valid L1 result when opening more detail", () => {
    render(<L1EstimateForm />);
    fillL1();
    submit();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    expect(screen.getByText(/confidence:\s*low/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add more detail/i }));
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/floor area/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Premium" })).toBeInTheDocument();
  });

  it("clears an L2 result when closing more detail", () => {
    render(<L1EstimateForm />);
    fillL1();
    openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Premium" }));
    fireEvent.change(screen.getByLabelText(/floor area/i), { target: { value: "120" } });
    submit();
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
    expect(screen.getByText(/confidence:\s*medium/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /hide extra detail/i }));
    expect(screen.queryByText(/estimated cost/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/floor area/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get estimate/i })).toBeInTheDocument();
  });
});
