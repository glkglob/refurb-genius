"use client";

import { Card, CardContent } from "@repo/ui";
import { Badge } from "@repo/ui";
import { Button } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { MapPin, TrendingUp, Ruler, Home, ArrowRight } from "lucide-react";
import type { PublicGalleryProjectRow } from "@/lib/queries/gallery";

interface ProjectCardProps {
  gallery: PublicGalleryProjectRow & {
    project?: {
      address?: string;
      postcode?: string;
      region?: string;
      property_type?: string;
      bedrooms?: number | null;
      bathrooms?: number | null;
      size_sqm?: number | null;
      purchase_price?: number | null;
      estimated_gdv?: number | null;
    };
  };
}

export function ProjectCard({ gallery }: ProjectCardProps) {
  const p = gallery.project || {};
  const gdv = p.estimated_gdv || 0;
  const purchase = p.purchase_price || 0;
  const profit = gdv - purchase;
  const roi = purchase > 0 ? Math.round((profit / purchase) * 100) : 0;

  const displayLocation = gallery.title || p.address || "Featured Project";
  const location = p.postcode || p.region || "UK";

  return (
    <Card className="group overflow-hidden h-full flex flex-col transition hover:shadow-lg border-border/60">
      <div className="relative h-48 bg-muted overflow-hidden">
        {gallery.cover_image_url ? (
          <img
            src={gallery.cover_image_url}
            alt={displayLocation}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-background">
            <Home className="h-12 w-12" />
          </div>
        )}
        {gallery.featured && (
          <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground">
            Featured
          </Badge>
        )}
        <div className="absolute bottom-3 left-3">
          <Badge variant="secondary" className="bg-background/90 backdrop-blur">
            <MapPin className="h-3 w-3 mr-1" /> {location}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="font-semibold text-lg tracking-tight line-clamp-2 group-hover:text-accent transition">
            {gallery.title || displayLocation}
          </h3>
          {p.address && p.address !== displayLocation && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{p.address}</p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>ROI ~{roi}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Home className="h-4 w-4" />
              <span>{p.property_type || "Property"}</span>
            </div>
            {p.size_sqm && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Ruler className="h-4 w-4" />
                <span>{p.size_sqm} m²</span>
              </div>
            )}
            {gdv > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>GDV £{(gdv / 1000).toFixed(0)}k</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{gallery.view_count || 0} views</div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="group-hover:bg-accent group-hover:text-accent-foreground"
          >
            <Link to="/gallery/$slug" params={{ slug: gallery.id }}>
              View Project <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
