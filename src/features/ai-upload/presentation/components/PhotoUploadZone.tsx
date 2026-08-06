import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, Image, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isImageFile } from "../../domain/rules";

export interface PhotoUploadZoneProps {
  onPhotosSelected: (files: File[]) => void;
  photos?: File[];
  maxPhotos?: number;
  /** True only while a genuine file/upload operation blocks further selection. */
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
  const [previewPhotos, setPreviewPhotos] = useState<PreviewPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileKeyMapRef = useRef<WeakMap<File, string>>(new WeakMap());
  const fileKeySeqRef = useRef(0);
  const previewIdPrefix = useId();
  const currentPhotos = photos ?? internalPhotos;

  const getStableFileKey = useCallback(
    (file: File): string => {
      const map = fileKeyMapRef.current;
      const existing = map.get(file);
      if (existing) return existing;
      fileKeySeqRef.current += 1;
      const key = `${previewIdPrefix}-file-${fileKeySeqRef.current}`;
      map.set(file, key);
      return key;
    },
    [previewIdPrefix],
  );

  // Effect-owned object URLs: create on photo list change, revoke on cleanup.
  useEffect(() => {
    const next = currentPhotos.map((file) => ({
      key: getStableFileKey(file),
      url: URL.createObjectURL(file),
      file,
    }));
    setPreviewPhotos(next);

    return () => {
      next.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [currentPhotos, getStableFileKey]);

  const setPhotos = useCallback(
    (next: File[]) => {
      if (!photos) setInternalPhotos(next);
      onPhotosSelected(next);
    },
    [onPhotosSelected, photos],
  );

  const resetInputs = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, []);

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        resetInputs();
        return;
      }

      const originalCount = fileList.length;
      const files = Array.from(fileList).filter(isImageFile);
      const skippedCount = originalCount - files.length;

      if (files.length === 0) {
        toast.error("Please select image files only.");
        resetInputs();
        return;
      }

      if (skippedCount > 0) {
        toast.error(
          skippedCount === 1
            ? "1 non-image file was skipped."
            : `${skippedCount} non-image files were skipped.`,
        );
      }

      if (currentPhotos.length + files.length > maxPhotos) {
        toast.error(`Maximum ${maxPhotos} photos allowed.`);
        resetInputs();
        return;
      }

      const newPhotos = [...currentPhotos, ...files];
      setPhotos(newPhotos);
      resetInputs();
    },
    [currentPhotos, maxPhotos, setPhotos, resetInputs],
  );

  const triggerLibrary = () => {
    if (isLoading) return;
    fileInputRef.current?.click();
  };

  const triggerCamera = () => {
    if (isLoading) return;
    cameraInputRef.current?.click();
  };

  const removePhoto = (index: number) => {
    if (isLoading) return;
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
            className="h-14 min-h-14"
            title="Open camera to take a photo"
            aria-label="Take Photo"
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
            className="h-14 min-h-14"
            title="Choose photos from your library"
            aria-label="Upload from Library"
          >
            <Upload className="mr-3 h-6 w-6" />
            Upload from Library
          </Button>
        </div>

        <input
          ref={cameraInputRef}
          id="property-photo-camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          disabled={isLoading}
          aria-hidden="true"
          data-testid="property-photo-camera-input"
          onChange={(event) => processFiles(event.target.files)}
        />
        <input
          ref={fileInputRef}
          id="property-photo-library-input"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          disabled={isLoading}
          aria-hidden="true"
          data-testid="property-photo-library-input"
          onChange={(event) => processFiles(event.target.files)}
        />

        {currentPhotos.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex justify-between">
              <h4 className="font-medium">
                Selected ({currentPhotos.length}/{maxPhotos})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={isLoading}
                onClick={() => setPhotos([])}
              >
                Clear
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {previewPhotos.map((photo, index) => (
                <div
                  key={photo.key}
                  data-preview-key={photo.key}
                  className="relative aspect-square overflow-hidden rounded-xl border border-slate-700"
                >
                  <img
                    src={photo.url}
                    alt={`Photo ${index + 1}: ${photo.file.name}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    disabled={isLoading}
                    className="absolute -right-1 -top-1 rounded-full bg-red-600 p-1 text-white shadow hover:bg-red-700 disabled:opacity-50"
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
