/**
 * RG-NEW-BRAND-IDENTITY-1 — committed brand masters, chrome wiring, and exclusions.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

function abs(rel: string): string {
  return join(ROOT, rel);
}

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(abs(rel)))
    .digest("hex");
}

function read(rel: string): string {
  return readFileSync(abs(rel), "utf8");
}

const APPROVED_MASTERS: Record<string, string> = {
  "src/assets/brand/rg-wordmark-master.svg":
    "d82f9c8b2bd22954981728f78dcac91a5d7972f89d6c833ac2a10221fadba58c",
  "src/assets/brand/rg-wordmark-on-light.svg":
    "d82f9c8b2bd22954981728f78dcac91a5d7972f89d6c833ac2a10221fadba58c",
  "src/assets/brand/rg-wordmark-on-dark.svg":
    "311ecfb0fb2c7a278341708d492c07982870ffbe730f6a83aa5304c3db4d561c",
  "src/assets/brand/rg-compact-master.svg":
    "9416454ece2f542d102de12ee1ba721c8c0a759e16d1303b2a2b16f912edc925",
  "src/assets/brand/rg-compact-on-light.svg":
    "9416454ece2f542d102de12ee1ba721c8c0a759e16d1303b2a2b16f912edc925",
  "src/assets/brand/rg-compact-on-dark.svg":
    "cfd40c54cadf8a7dd3630433cf6e4d901c59e83a7ba3ba8e6cf24e809cafc9db",
  "src/assets/brand/rg-sparkle-canonical.svg":
    "dea4b018772b43386cb15c9773a4085938a1308e1c15ff2f34656fab3b6f5f1c",
  "src/assets/brand/rg-compact-micro-master.svg":
    "4c6a788bd73876f8e0b1cf0ff8cb36e95047c7801c977f41fed0fbbbcc02c6b2",
  "src/assets/brand/rg-compact-micro-on-light.svg":
    "4c6a788bd73876f8e0b1cf0ff8cb36e95047c7801c977f41fed0fbbbcc02c6b2",
  "src/assets/brand/rg-compact-micro-on-dark.svg":
    "2c5a143712cf86a04271f7b972213bdaaff1a1ba1b4b7b3db75007f77cb300fa",
  "src/assets/brand/rg-app-icon-master.svg":
    "ab4b46b69b75617a730f2e813968c576fe2e207f91fbbfa7852245f3a259e470",
  "src/assets/brand/rg-app-icon-master-1024.png":
    "cfa939b38739047513606d9d956b4971450cd7fcb51446dcd1f54c49f686fff6",
};

const APP_ICON_PNG = "cfa939b38739047513606d9d956b4971450cd7fcb51446dcd1f54c49f686fff6";

test("approved committed master SHA-256 values match the authorised Desktop source hashes", () => {
  for (const [rel, expected] of Object.entries(APPROVED_MASTERS)) {
    assert.equal(sha256File(rel), expected, rel);
  }
});

test("iOS AppIcon committed bytes match the authorised 1024 PNG", () => {
  assert.equal(
    sha256File("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
    APP_ICON_PNG,
  );
});

test("Sidebar, MobileTopBar, Navbar, and report branding header do not use Building2", () => {
  for (const rel of [
    "src/components/Sidebar.tsx",
    "src/components/MobileTopBar.tsx",
    "src/components/Navbar.tsx",
  ]) {
    assert.doesNotMatch(read(rel), /Building2/);
  }
  const report = read("src/routes/_authed/projects.$id.report.tsx");
  const header = report.match(/\{\/\* Branding header \*\/\}[\s\S]*?<\/header>/);
  assert.ok(header, "report branding header block must exist");
  assert.doesNotMatch(header[0]!, /Building2/);
  assert.doesNotMatch(header[0]!, /uppercase tracking-\[0\.2em\]/);
});

test("AuthExperience has no literal RG brand tile", () => {
  const src = read("src/features/auth/presentation/AuthExperience.tsx");
  assert.doesNotMatch(src, /bg-\[#111827\]/);
  assert.doesNotMatch(src, />\s*RG\s*</);
  assert.match(src, /BrandLogo/);
  assert.match(src, /Property refurbishment analysis/);
});

test("public/icon-192.svg is not the legacy house/arrow mark", () => {
  const svg = read("public/icon-192.svg");
  assert.doesNotMatch(svg, /#1f2937|#3b82f6/i);
  assert.doesNotMatch(svg, /house with arrow|Refurb icon: house/i);
  assert.match(svg, /#0D2139/i);
});

test("R2 secondary/tagline assets are not present", () => {
  for (const rel of [
    "src/assets/brand/rg-secondary-r2-light.svg",
    "src/assets/brand/rg-secondary-r2-dark.svg",
    "src/assets/brand/rg-tagline-r2-outline.svg",
    "public/rg-secondary-r2-light.svg",
    "public/rg-secondary-r2-dark.svg",
    "public/rg-tagline-r2-outline.svg",
  ]) {
    assert.equal(existsSync(abs(rel)), false, rel);
  }
});

test("global brand token values remain Navy / Teal / White", () => {
  const docs = read("src/docs/design-system.md");
  const css = read("src/styles.css");
  for (const token of ["#0D2139", "#1B8D68", "#FFFFFF"]) {
    assert.match(docs, new RegExp(token));
    assert.match(css, new RegExp(token));
  }
});

test("deprecated horizontal raster assets are absent", () => {
  assert.equal(existsSync(abs("src/assets/brand/logo-light-horizontal.png")), false);
  assert.equal(existsSync(abs("src/assets/brand/logo-dark-horizontal.jpg")), false);
});

test("BrandLogo adaptive selection does not use OS prefers-color-scheme or media dark: utilities", () => {
  const src = read("src/components/BrandLogo.tsx");
  assert.doesNotMatch(src, /prefers-color-scheme/);
  assert.doesNotMatch(src, /matchMedia/);
  assert.doesNotMatch(src, /dark:hidden/);
  assert.doesNotMatch(src, /hidden dark:block/);
});

test("report branding header follows app theme on screen and on-light for PDF export", () => {
  const report = read("src/routes/_authed/projects.$id.report.tsx");
  const header = report.match(/\{\/\* Branding header \*\/\}[\s\S]*?<\/header>/);
  assert.ok(header, "report branding header block must exist");
  assert.doesNotMatch(header[0]!, /surface="light"/);
  assert.match(header[0]!, /pdfExporting/);
  assert.match(header[0]!, /"adaptive"/);
  assert.match(header[0]!, /"light"/);
});
