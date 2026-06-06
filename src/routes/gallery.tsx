import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import {
  publicGalleryProjectsQueryOptions,
  type PublicGalleryProjectRow,
} from "@/lib/queries/gallery";
import { GalleryFilters } from "@/components/gallery/GalleryFilters";
import { ProjectCard } from "@/components/gallery/ProjectCard";
import { MapPin, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Public Project Gallery — Refurb Genius" },
      {
        name: "description",
        content:
          "Explore completed UK property refurbishment projects. See real GDV, ROI, scope and outcomes from verified investors.",
      },
      { property: "og:title", content: "Public Project Gallery — Refurb Genius" },
      {
        property: "og:description",
        content: "Browse beautiful before/after refurbs with full financials and investor stories.",
      },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { data: galleries = [], isLoading, error } = useQuery(publicGalleryProjectsQueryOptions());

  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [minGdv, setMinGdv] = useState(200000);
  const [minRoi, setMinRoi] = useState(0);

  type GalleryWithProject = PublicGalleryProjectRow & {
    project?: {
      region?: string;
      estimated_gdv?: number;
      purchase_price?: number;
      address?: string;
      postcode?: string;
    };
  };

  const availableRegions = useMemo(() => {
    const regs = new Set<string>();
    galleries.forEach((g: GalleryWithProject) => {
      const r = g.project?.region;
      if (r) regs.add(r);
    });
    return Array.from(regs).sort();
  }, [galleries]);

  const filtered = useMemo(() => {
    return (galleries as GalleryWithProject[]).filter((g) => {
      const p = g.project || {};
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        (g.title && g.title.toLowerCase().includes(term)) ||
        (g.description && g.description.toLowerCase().includes(term)) ||
        (p.address && p.address.toLowerCase().includes(term)) ||
        (p.postcode && p.postcode.toLowerCase().includes(term));

      const matchesRegion = regionFilter === "all" || p.region === regionFilter;

      const gdv = p.estimated_gdv || 0;
      const matchesGdv = gdv >= minGdv;

      const purchase = p.purchase_price || 0;
      const profit = gdv - purchase;
      const roi = purchase > 0 ? (profit / purchase) * 100 : 0;
      const matchesRoi = roi >= minRoi;

      return matchesSearch && matchesRegion && matchesGdv && matchesRoi;
    });
  }, [galleries, searchTerm, regionFilter, minGdv, minRoi]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 pt-12 pb-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Public Showcase
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Completed Refurbishment Projects
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Real UK property transformations with full financial outcomes, photos, and investor
            results. Browse, get inspired, and connect directly with owners.
          </p>
        </div>

        <div className="mt-8">
          <GalleryFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            regionFilter={regionFilter}
            setRegionFilter={setRegionFilter}
            minGdv={minGdv}
            setMinGdv={setMinGdv}
            minRoi={minRoi}
            setMinRoi={setMinRoi}
            availableRegions={availableRegions}
          />

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center text-destructive">
                Failed to load public gallery. Please try again later.
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No projects match your filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchTerm("");
                  setRegionFilter("all");
                  setMinGdv(200000);
                  setMinRoi(0);
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(filtered as GalleryWithProject[]).map((g) => (
                <ProjectCard key={g.id} gallery={g} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          Projects are marked public by owners. Interested in featuring your refurb?{" "}
          <Link to="/dashboard" className="underline">
            Log in to your dashboard
          </Link>
          .
        </div>
      </div>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Refurb Genius. All rights reserved.
      </footer>
    </div>
  );
}
