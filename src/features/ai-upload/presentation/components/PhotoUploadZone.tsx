import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Image, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface PhotoUploadZoneProps {
  photos?: File[];
  onPhotosSelected: (files: File[]) => void;
  maxPhotos?: number;
  isLoading?: boolean;
}

type PreviewPhoto = {
  key: string;
  url: string;
  file: File;
};

export function PhotoUploadZone({
  photos,
  onPhotosSelected,
  maxPhotos = 20,
  isLoading = false,
}: PhotoUploadZoneProps) {
  const [internalPhotos, setInternalPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentPhotos = photos ?? internalPhotos;

  const previewPhotos = useMemo<PreviewPhoto[]>(
    () =>
      currentPhotos.map((file, index) => ({
        key: `${file.name}-${file.size}-${index}`,
        url: URL.createObjectURL(file),
        file,
      })),
    [currentPhotos],
  );

  useEffect(() => {
    return () => {
      previewPhotos.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previewPhotos]);

  function setPhotos(next: File[]) {
    if (!photos) {
      setInternalPhotos(next);
    }
    onPhotosSelected(next);
  }

  function processFiles(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const selected = Array.from(selectedFiles);
    const validFiles = selected.filter((file) => file.type.startsWith("image/"));
    if (validFiles.length !== selectedFiles.length) {
      toast.error("Only image files can be uploaded.");
    }

    const nextPhotos = [...currentPhotos, ...validFiles];
    if (nextPhotos.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed.`);
      return;
    }

    setPhotos(nextPhotos);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    processFiles(event.target.files);
    event.currentTarget.value = "";
  }

  function removePhoto(index: number) {
    const next = currentPhotos.filter((_, currentIndex) => currentIndex !== index);
    setPhotos(next);
  }

  function clearAll() {
    setPhotos([]);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Capture Property Photos</h3>
          <p className="text-xs text-muted-foreground">
            Take photos directly with your camera or upload from your library.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isLoading}
            className="flex-1"
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-1"
          >
            <Image className="h-4 w-4" />
            Upload from Library
          </Button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {currentPhotos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Selected photos: {currentPhotos.length}/{maxPhotos}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {previewPhotos.map((preview, index) => (
                <div key={preview.key} className="group relative overflow-hidden rounded-md border">
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute right-1 top-1 rounded-full bg-black/65 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`Remove ${preview.file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">
          <Upload className="mt-0.5 h-3.5 w-3.5 text-accent" />
          Use good lighting and multiple room angles for best AI analysis quality.
        </div>
      </CardContent>
    </Card>
  );
}
