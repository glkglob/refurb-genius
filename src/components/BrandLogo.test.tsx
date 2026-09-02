import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrandLogo } from "./BrandLogo";

const SOURCE = readFileSync(join(__dirname, "BrandLogo.tsx"), "utf8");

describe("BrandLogo", () => {
  it("renders the approved light and dark horizontal logo assets with native aspect attributes", () => {
    const { container } = render(createElement(BrandLogo));
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);

    const light = images[0]!;
    const dark = images[1]!;

    expect(light.getAttribute("src") ?? "").toMatch(/logo-light-horizontal/);
    expect(light.getAttribute("width")).toBe("597");
    expect(light.getAttribute("height")).toBe("165");
    expect(light.style.aspectRatio.replace(/\s/g, "")).toBe("597/165");
    expect(light.className).toMatch(/object-contain/);
    expect(light.className).not.toMatch(/object-cover/);
    expect(light.className).toMatch(/dark:hidden/);

    expect(dark.getAttribute("src") ?? "").toMatch(/logo-dark-horizontal/);
    expect(dark.getAttribute("width")).toBe("593");
    expect(dark.getAttribute("height")).toBe("164");
    expect(dark.style.aspectRatio.replace(/\s/g, "")).toBe("593/164");
    expect(dark.className).toMatch(/object-contain/);
    expect(dark.className).not.toMatch(/object-cover/);
    expect(dark.className).toMatch(/hidden/);
    expect(dark.className).toMatch(/dark:block/);
  });

  it("exposes a single accessible name without the baked tagline", () => {
    render(createElement(BrandLogo));
    expect(screen.getByRole("img", { name: "Refurb Genius" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /property|refurbishment/i })).toBeNull();
    const images = document.querySelectorAll("img");
    for (const image of images) {
      expect(image.getAttribute("alt")).toBe("");
    }
  });

  it("supports decorative rendering with no accessible name", () => {
    render(createElement(BrandLogo, { decorative: true }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByLabelText("Refurb Genius")).toBeNull();
  });

  it("does not import @/lib/utils or reconstruct alternate logo assets", () => {
    expect(SOURCE).not.toMatch(/@\/lib\/utils/);
    expect(SOURCE).toMatch(/from "@repo\/ui"/);
    expect(SOURCE).toMatch(/@\/assets\/brand\/logo-light-horizontal\.png/);
    expect(SOURCE).toMatch(/@\/assets\/brand\/logo-dark-horizontal\.jpg/);
    expect(SOURCE).not.toMatch(/logo-light-r1|REVIEW_CANDIDATES|_preview_dark/);
    expect(SOURCE).not.toMatch(/Building2|leaf|sparkle|wordmark/);
  });
});
