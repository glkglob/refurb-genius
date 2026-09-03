import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrandLogo } from "./BrandLogo";

const SOURCE = readFileSync(join(__dirname, "BrandLogo.tsx"), "utf8");

function imgSrc(image: Element): string {
  return image.getAttribute("src") ?? "";
}

describe("BrandLogo", () => {
  it("renders the approved primary on-light asset for surface=light", () => {
    const { container } = render(
      createElement(BrandLogo, { variant: "primary", surface: "light" }),
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    const image = images[0]!;
    expect(imgSrc(image)).toMatch(/rg-wordmark-on-light/);
    expect(image.getAttribute("width")).toBe("1260");
    expect(image.getAttribute("height")).toBe("288");
    expect(image.style.aspectRatio.replace(/\s/g, "")).toBe("1260/288");
    expect(image.className).toMatch(/object-contain/);
    expect(image.className).not.toMatch(/object-cover/);
  });

  it("renders the approved primary on-dark asset for surface=dark", () => {
    const { container } = render(createElement(BrandLogo, { variant: "primary", surface: "dark" }));
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(imgSrc(images[0]!)).toMatch(/rg-wordmark-on-dark/);
  });

  it("follows application theme for surface=adaptive via dark: utilities", () => {
    const { container } = render(
      createElement(BrandLogo, { variant: "primary", surface: "adaptive" }),
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(imgSrc(images[0]!)).toMatch(/rg-wordmark-on-light/);
    expect(images[0]!.className).toMatch(/dark:hidden/);
    expect(imgSrc(images[1]!)).toMatch(/rg-wordmark-on-dark/);
    expect(images[1]!.className).toMatch(/hidden/);
    expect(images[1]!.className).toMatch(/dark:block/);
  });

  it("renders compact and compactMicro from the approved leaf+sparkle masters", () => {
    const compact = render(
      createElement(BrandLogo, { variant: "compact", surface: "light" }),
    ).container.querySelector("img");
    expect(imgSrc(compact!)).toMatch(/rg-compact-on-light/);
    expect(compact!.getAttribute("width")).toBe("596");
    expect(compact!.getAttribute("height")).toBe("743");

    const micro = render(
      createElement(BrandLogo, { variant: "compactMicro", surface: "dark" }),
    ).container.querySelector("img");
    expect(imgSrc(micro!)).toMatch(/rg-compact-micro-on-dark/);
  });

  it("exposes a single accessible name without a tagline", () => {
    render(createElement(BrandLogo, { variant: "primary", surface: "light" }));
    expect(screen.getByRole("img", { name: "Refurb Genius" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /property|refurbishment|restore|renew/i })).toBeNull();
    for (const image of document.querySelectorAll("img")) {
      expect(image.getAttribute("alt")).toBe("");
    }
  });

  it("supports decorative rendering with no accessible name", () => {
    render(createElement(BrandLogo, { variant: "compact", surface: "adaptive", decorative: true }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByLabelText("Refurb Genius")).toBeNull();
  });

  it("does not reconstruct a secondary/tagline variant or the superseded rasters", () => {
    expect(SOURCE).not.toMatch(/@\/lib\/utils/);
    expect(SOURCE).toMatch(/from "@repo\/ui"/);
    expect(SOURCE).toMatch(/variant: "primary" \| "compact" \| "compactMicro"/);
    expect(SOURCE).not.toMatch(/secondary|tagline|prefers-color-scheme/);
    expect(SOURCE).not.toMatch(/logo-light-horizontal|logo-dark-horizontal/);
    expect(SOURCE).not.toMatch(/Building2/);
    expect(SOURCE).not.toMatch(/rg-secondary-r2|rg-tagline-r2/);
  });
});
