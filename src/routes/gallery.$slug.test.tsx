/**
 * SEC-1B-GALLERY-D — public Gallery detail is listing + cover only.
 * Existing tests could not prove consumer removal: no route-level detail test existed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => createElement("nav", { "data-testid": "navbar" }, "nav"),
}));

vi.mock("@/components/gallery/LeadCaptureForm", () => ({
  LeadCaptureForm: ({ galleryProjectId }: { galleryProjectId: string }) =>
    createElement("form", {
      "data-testid": "lead-form",
      "data-gallery-id": galleryProjectId,
    }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: { component: unknown; head?: unknown }) => ({
    options: opts,
    path,
    useParams: () => ({ slug: "gal-1" }),
  }),
  Link: ({ children, to }: { children?: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));

import { Route } from "./gallery.$slug";

const Detail = Route.options.component as () => ReactNode;
const SRC = readFileSync(join(process.cwd(), "src/routes/gallery.$slug.tsx"), "utf8");

const listing = {
  id: "gal-1",
  project_id: "proj-1",
  is_public: true,
  featured: true,
  title: "Victorian Terrace",
  description: "Full refurb opportunity",
  cover_image_url: "https://example.test/storage/v1/object/public/gallery/u/p/cover.jpg",
  view_count: 9,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  project: {
    name: "1 High Street",
    address: "1 High Street",
    postcode: "M1 1AA",
    region: "North West",
    property_type: "Terrace",
    bedrooms: 3,
    bathrooms: 1,
    size_sqm: 90,
    purchase_price: 200000,
    estimated_gdv: 280000,
  },
};

function renderDetail(data: typeof listing | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["gallery", "byId", "gal-1"], data);
  return render(createElement(QueryClientProvider, { client: qc }, createElement(Detail as never)));
}

describe("public gallery detail consumer contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not import or call publicProjectPhotosQueryOptions", () => {
    expect(SRC).not.toMatch(/publicProjectPhotosQueryOptions/);
    expect(SRC).toMatch(/publicGalleryProjectByIdQueryOptions/);
  });

  it("does not render project-photo URLs or a photo grid", () => {
    expect(SRC).not.toMatch(/ph\.url/);
    expect(SRC).not.toMatch(/photos\.url/);
    expect(SRC).not.toMatch(/Project Photos/);
    expect(SRC).not.toMatch(/from\(\s*["']photos["']\s*\)/);
    expect(SRC).not.toMatch(/createSignedUrl/);
    expect(SRC).not.toMatch(/useProjectPhotoDisplayUrl/);
    expect(SRC).not.toMatch(/projectPhotoDisplay/);
    expect(SRC).not.toMatch(/service_role/);
    expect(SRC).not.toMatch(/project-photos/);
    expect(SRC).not.toMatch(/storage_path/);
  });

  it("renders listing metadata and the public cover only", () => {
    renderDetail(listing);

    expect(screen.getByRole("heading", { name: "Victorian Terrace" })).toBeTruthy();
    expect(screen.getByText("Full refurb opportunity")).toBeTruthy();
    const cover = screen.getByAltText("Victorian Terrace") as HTMLImageElement;
    expect(cover.src).toBe(listing.cover_image_url);
    expect(screen.queryByText("Project Photos")).toBeNull();
    expect(screen.queryByText("Loading photos...")).toBeNull();
    expect(screen.getByTestId("lead-form").getAttribute("data-gallery-id")).toBe("gal-1");
    expect(document.querySelectorAll('img[src*="photos"]')).toHaveLength(0);
  });

  it("works without a photos query and keeps not-found copy", () => {
    renderDetail(null);
    expect(screen.getByText("Project not found or not public")).toBeTruthy();
    expect(screen.queryByText("Project Photos")).toBeNull();
  });
});
