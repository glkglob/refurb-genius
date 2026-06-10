import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Image, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface PhotoUploadZoneProps {
  onPhotosSelected: (files: File[]) => void;
  photos?: File[];
  maxPhotos?: number;
  isLoading?: boolean;
}

type PreviewPhoto = {
  key: string;
  url: string;
  file: File;
};

export function PhotoUploadZone({
  onPhotosSelected,
  photos,
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

  const setPhotos = useCallback(
    (next: File[]) => {
      if (!photos) setInternalPhotos(next);
      onPhotosSelected(next);
    },
    [onPhotosSelected, photos],
  );

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));

      if (files.length === 0) {
        toast.error("Please select image files only.");
        return;
      }

      if (currentPhotos.length + files.length > maxPhotos) {
        toast.error(`Maximum ${maxPhotos} photos allowed.`);
        return;
      }

      const newPhotos = [...currentPhotos, ...files];
      setPhotos(newPhotos);

      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    },
    [currentPhotos, maxPhotos, setPhotos],
  );

  const triggerLibrary = () => fileInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  const removePhoto = (index: number) => {
    const updated = currentPhotos.filter((_, i) => i !== index);
    setPhotos(updated);
  };

  return (
    <Card className="border-border/60 bg-card/75">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-500/10">
            <Camera className="h-10 w-10 text-teal-500" />
          </div>
          <h3 className="text-2xl font-semibold">Capture Property Photos</h3>
          <p className="mt-1 text-slate-400">Take photos or choose from library</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Button
            type="button"
            onClick={triggerCamera}
            size="lg"
            disabled={isLoading}
            className="h-14"
            title="Open camera to take a photo"
          >
            <Camera className="mr-3 h-6 w-6" />
            Take Photo
          </Button>

          <Button
            type="button"
            onClick={triggerLibrary}
            variant="outline"
            size="lg"
            disabled={isLoading}
            className="h-14"
            title="Choose photos from your library"
          >
            <Upload className="mr-3 h-6 w-6" />
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
          onChange={(event) => processFiles(event.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => processFiles(event.target.files)}
        />

        {currentPhotos.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex justify-between">
              <h4 className="font-medium">
                Selected ({currentPhotos.length}/{maxPhotos})
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setPhotos([])}>
                Clear
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {previewPhotos.map((photo, index) => (
                <div
                  key={photo.key}
                  className="relative aspect-square overflow-hidden rounded-xl border border-slate-700"
                >
                  <img
                    src={photo.url}
                    alt={`Photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700"
                    aria-label={`Remove ${photo.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground sm:text-sm">
          <Image className="mt-0.5 h-3.5 w-3.5 text-accent" />
          Good lighting and multiple angles per room give the best AI results.
        </div>
      </CardContent>
    </Card>
  );
}
