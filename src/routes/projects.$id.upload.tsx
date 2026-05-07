import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Upload, ImagePlus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/projects/$id/upload")({
  head: () => ({ meta: [{ title: "Upload photos — Refurb Genius" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { id } = Route.useParams();
  const [files, setFiles] = useState<File[]>([]);

  return (
    <AppLayout
      title="Upload photos"
      subtitle="Add property photos. Mock upload — files are not stored."
      actions={
        <Button asChild disabled={files.length === 0}>
          <Link to="/projects/$id/analysis" params={{ id }}>Run AI analysis</Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/40 p-12 text-center transition-colors hover:bg-secondary">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Click to upload property photos</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG up to 10MB each</p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>

          {files.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-lg border border-border bg-secondary">
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState icon={ImagePlus} title="No photos yet" description="Upload photos of every room to get the most accurate analysis." />
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
