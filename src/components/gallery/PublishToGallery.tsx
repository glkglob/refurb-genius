// src/components/gallery/PublishToGallery.tsx
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, CardContent, Input, Label, Switch, Textarea } from "@repo/ui";
import { toast } from "sonner";
import { Eye, Users, Image as ImageIcon, Loader2, ExternalLink } from "lucide-react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useUpsertGalleryProject } from "@/hooks/useGallery";
import { galleryByProjectQueryOptions, investorLeadsQueryOptions } from "@/lib/queries/gallery";
import { uploadGalleryCoverImage } from "@/lib/gallery";

interface PublishToGalleryProps {
  projectId: string;
  projectName?: string;
}

const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function PublishToGallery({ projectId, projectName }: PublishToGalleryProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: gallery, isLoading: galleryLoading } = useQuery(
    galleryByProjectQueryOptions(projectId),
  );

  const { data: leads = [] } = useQuery({
    ...investorLeadsQueryOptions(gallery?.id ?? ""),
    enabled: !!gallery?.id,
  });

  const upsert = useUpsertGalleryProject(projectId);

  const [isPublic, setIsPublic] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sync local form state from the fetched row whenever it changes
  // (initial load, or after a successful save reconciles via invalidation).
  useEffect(() => {
    if (gallery) {
      setIsPublic(gallery.is_public);
      setFeatured(gallery.featured);
      setTitle(gallery.title ?? "");
      setDescription(gallery.description ?? "");
      setCoverImageUrl(gallery.cover_image_url);
    }
  }, [gallery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error("You must be signed in to upload images.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }

    setUploading(true);
    try {
      const { publicUrl } = await uploadGalleryCoverImage(projectId, file, user.id);
      setCoverImageUrl(publicUrl);
      toast.success("Cover image uploaded. Don't forget to save your changes.");
    } catch (err) {
      logger.error("[gallery] cover image upload failed", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Failed to upload cover image. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = (overrides?: Partial<{ is_public: boolean; featured: boolean }>) => {
    const nextIsPublic = overrides?.is_public ?? isPublic;
    const nextFeatured = overrides?.featured ?? featured;

    if (overrides?.is_public !== undefined) setIsPublic(overrides.is_public);
    if (overrides?.featured !== undefined) setFeatured(overrides.featured);

    upsert.mutate(
      {
        is_public: nextIsPublic,
        featured: nextFeatured,
        title: title.trim() || null,
        description: description.trim() || null,
        cover_image_url: coverImageUrl,
      },
      {
        onSuccess: () => {
          toast.success("Gallery settings saved");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to save gallery settings.");
        },
      },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Publish to Gallery</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Showcase this project on the public investor gallery and capture leads.
            </p>
          </div>
          {gallery?.is_public && gallery.id && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/gallery/${gallery.id}`} target="_blank" rel="noopener noreferrer">
                View public listing
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Views</p>
                <p className="text-xl font-semibold tracking-tight">{gallery?.view_count ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Investor leads
                </p>
                <p className="text-xl font-semibold tracking-tight">{leads.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="pr-4">
              <Label htmlFor="gallery-is-public" className="text-sm font-medium">
                Public listing
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Make this project visible on the public investor gallery.
              </p>
            </div>
            <Switch
              id="gallery-is-public"
              checked={isPublic}
              disabled={galleryLoading || upsert.isPending}
              onCheckedChange={(checked) => save({ is_public: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="pr-4">
              <Label htmlFor="gallery-featured" className="text-sm font-medium">
                Featured
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Highlight this project near the top of the gallery.
              </p>
            </div>
            <Switch
              id="gallery-featured"
              checked={featured}
              disabled={galleryLoading || upsert.isPending || !isPublic}
              onCheckedChange={(checked) => save({ featured: checked })}
            />
          </div>
        </div>

        {/* Listing details */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="gallery-title">Title</Label>
            <Input
              id="gallery-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={projectName || "e.g. 3-Bed Refurb Opportunity in Manchester"}
              disabled={upsert.isPending}
            />
          </div>

          <div>
            <Label htmlFor="gallery-description">Description</Label>
            <Textarea
              id="gallery-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the opportunity for prospective investors..."
              rows={4}
              disabled={upsert.isPending}
            />
          </div>

          <div>
            <Label>Cover image</Label>
            <div className="mt-2 flex items-center gap-4">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Gallery cover"
                  className="h-20 w-32 rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || upsert.isPending}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : coverImageUrl ? (
                    "Replace image"
                  ) : (
                    "Upload image"
                  )}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, up to 5MB.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save()} disabled={upsert.isPending || galleryLoading}>
            {upsert.isPending ? "Saving..." : "Save gallery settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
