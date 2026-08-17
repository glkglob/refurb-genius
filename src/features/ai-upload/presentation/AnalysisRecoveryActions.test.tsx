import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisRecoveryActions } from "./AnalysisRecoveryActions";

function assertVisibleOnNarrowViewports(el: HTMLElement) {
  const className = el.className;
  expect(className).not.toMatch(/(?:^|\s)hidden(?:\s|$)/);
  expect(className).not.toMatch(/md:hidden|sm:hidden|max-md:hidden|lg:hidden/);
  expect(el).toBeVisible();
}

describe("AnalysisRecoveryActions", () => {
  it("shows Re-analyse weak photos without breakpoint hiding (390x844)", () => {
    window.innerWidth = 390;
    window.innerHeight = 844;
    render(<AnalysisRecoveryActions mode="retry-weak" onRetryWeak={vi.fn()} onRecover={vi.fn()} />);
    const cta = screen.getByTestId("analysis-retry-weak-cta");
    expect(cta).toHaveTextContent("Re-analyse weak photos");
    assertVisibleOnNarrowViewports(cta);
  });

  it("shows recovery Analyse uploaded photos without breakpoint hiding (320x720)", () => {
    window.innerWidth = 320;
    window.innerHeight = 720;
    render(<AnalysisRecoveryActions mode="recover" onRetryWeak={vi.fn()} onRecover={vi.fn()} />);
    const cta = screen.getByTestId("analysis-recovery-cta");
    expect(cta).toHaveTextContent("Analyse uploaded photos");
    assertVisibleOnNarrowViewports(cta);
  });
});
