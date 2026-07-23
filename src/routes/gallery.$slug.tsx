import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@repo/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { Badge } from "@repo/ui";
import {
  publicGalleryProjectByIdQueryOptions,
  publicProjectPhotosQueryOptions,
  type PublicGalleryProjectRow,
} from "@/lib/queries/gallery";
import { LeadCaptureForm } from "@/components/gallery/LeadCaptureForm";
import { ArrowLeft, MapPin, TrendingUp, Ruler, Home, Camera, Layers } from "lucide-react";

export const Route = createFileRoute("/gallery/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Project ${params.slug} — Public Gallery | Refurb Genius` },
      {
        name: "description",
        content:
          "Detailed view of a completed UK property refurbishment with financials, photos and outcomes.",
      },
      { property: "og:title", content: `Featured Refurb Project — Refurb Genius` },
      {
        property: "og:description",
        content: "Real numbers, real results. Explore this public case study.",
      },
    ],
  }),
  component: GalleryDetailPage,
});

function GalleryDetailPage() {
  const params = Route.useParams() as { slug: string };
  const { slug } = params;

  const { data: gallery, isLoading: galleryLoading } = useQuery(
    publicGalleryProjectByIdQueryOptions(slug),
  );
  const { data: photos = [], isLoading: photosLoading } = useQuery({
    ...publicProjectPhotosQueryOptions(gallery?.project_id || ""),
    enabled: !!gallery?.project_id,
  });

  if (galleryLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="outline-none max-w-4xl mx-auto p-8">
          Loading project...
        </main>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main
          id="main-content"
          tabIndex={-1}
          className="outline-none max-w-4xl mx-auto p-8 text-center"
        >
          <h1 className="text-2xl font-semibold">Project not found or not public</h1>
          <p className="mt-2 text-muted-foreground">
            This project may have been made private or the link is invalid.
          </p>
          <Link to="/gallery" className="mt-4 inline-block underline">
            Back to Gallery
          </Link>
        </main>
      </div>
    );
  }

  type GalleryWithProject = PublicGalleryProjectRow & {
    project?: {
      id?: string;
      name?: string | null;
      address?: string | null;
      postcode?: string | null;
      region?: string | null;
      property_type?: string | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      size_sqm?: number | null;
      purchase_price?: number | null;
      estimated_gdv?: number | null;
    };
  };
  const g = gallery as GalleryWithProject;
  const p = g.project || {};
  const gdv = p.estimated_gdv || 0;
  const purchase = p.purchase_price || 0;
  const profit = gdv - purchase;
  const roi = purchase > 0 ? Math.round((profit / purchase) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main
        id="main-content"
        tabIndex={-1}
        className="outline-none max-w-5xl mx-auto px-6 pt-8 pb-16"
      >
        <Link
          to="/gallery"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to all projects
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight">
                {gallery.title || p.name || p.address || "Featured Refurb"}
              </h1>
              {gallery.featured && <Badge>Featured</Badge>}
            </div>
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {p.address || p.postcode || "United Kingdom"}
              {p.region && ` · ${p.region}`}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="rounded-md border px-3 py-1.5 bg-muted/50">
              {g.view_count || 0} views
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="#inquire">Contact Owner</a>
            </Button>
          </div>
        </div>

        {/* Hero / Cover */}
        <div className="rounded-xl overflow-hidden border mb-10 aspect-[16/9] bg-muted">
          {g.cover_image_url ? (
            <img
              src={g.cover_image_url}
              alt={gallery.title || "Project cover"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-6xl text-muted-foreground/40">
              <Home className="h-24 w-24" />
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Summary */}
            <section>
              <h2 className="text-xl font-semibold mb-3">Project Summary</h2>
              <p className="text-muted-foreground leading-relaxed">
                {gallery.description ||
                  "A completed refurbishment project showcasing strong returns and high-quality execution. Full details, photos and outcomes available below."}
              </p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {p.property_type && (
                  <div>
                    <span className="text-muted-foreground">Type:</span> {p.property_type}
                  </div>
                )}
                {p.bedrooms != null && (
                  <div>
                    <span className="text-muted-foreground">Beds / Baths:</span> {p.bedrooms} /{" "}
                    {p.bathrooms}
                  </div>
                )}
                {p.size_sqm && (
                  <div>
                    <span className="text-muted-foreground">Size:</span> {p.size_sqm} m²
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Status:</span> Completed
                </div>
              </div>
            </section>

            {/* Financial Highlights */}
            <section>
              <h2 className="text-xl font-semibold mb-3">Financial Highlights</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="text-muted-foreground text-sm">Purchase Price</div>
                    <div className="text-2xl font-semibold mt-1">£{purchase.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="text-muted-foreground text-sm">Est. GDV</div>
                    <div className="text-2xl font-semibold mt-1">£{gdv.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="text-muted-foreground text-sm">Est. Profit / ROI</div>
                    <div className="text-2xl font-semibold mt-1">
                      £{profit.toLocaleString()} ({roi}%)
                    </div>
                  </CardContent>
                </Card>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Figures are estimates from the project analysis. Full sensitivity and detailed
                breakdown available to qualified investors upon inquiry.
              </p>
            </section>

            {/* Photos */}
            <section>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Camera className="h-5 w-5" /> Project Photos
              </h2>
              {photosLoading ? (
                <div className="text-sm text-muted-foreground">Loading photos...</div>
              ) : photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {photos.slice(0, 6).map((ph) => (
                    <a
                      key={ph.id}
                      href={ph.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-lg border"
                    >
                      <img
                        src={ph.url}
                        alt={ph.name}
                        className="w-full h-40 object-cover hover:scale-105 transition"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Cover image shown above. Additional project photos are available in the private
                  owner dashboard.
                </div>
              )}
            </section>

            {/* 3D Teaser */}
            <section className="border rounded-lg p-6 bg-muted/30">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Layers className="h-5 w-5" /> 3D Floorplan &amp; Measurements
              </h2>
              <p className="text-muted-foreground">
                This project includes an interactive 3D model with room tags, distance and area
                measurements. Owners can share the full 3D experience privately with interested
                parties.
              </p>
              <p className="mt-3 text-sm">
                <span className="font-medium">Interested?</span> Use the inquiry form to request
                access to the 3D viewer and detailed measurements.
              </p>
            </section>
          </div>

          {/* Sidebar - Lead Form */}
          <div className="lg:col-span-1">
            <Card id="inquire" className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Interested in this project?</CardTitle>
                <p className="text-sm text-muted-foreground">Send a direct inquiry to the owner.</p>
              </CardHeader>
              <CardContent>
                <LeadCaptureForm
                  galleryProjectId={gallery.id}
                  projectTitle={(gallery.title || p.name) ?? undefined}
                />
              </CardContent>
            </Card>

            <div className="mt-6 text-xs text-muted-foreground px-1">
              All inquiries go directly to the project owner. Refurb Genius does not share your
              data.
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Refurb Genius · Public Gallery
      </footer>
    </div>
  );
}
