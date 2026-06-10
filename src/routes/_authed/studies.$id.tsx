import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePhotos } from "@/features/ai-upload";
import { useExportFeasibilityReport } from "@/features/export";
import {
  type CreateFeasibilityStudyCommand,
  useCreateFeasibilityStudy,
  useFeasibilityStudy,
  useQueueFeasibilityExport,
} from "@/features/feasibility";
import type { ConditionLevel, EstimateCategory } from "@repo/types";
import { useCreateShareLink, useRevokeShareLink, useShareLinks } from "@/features/sharing";
import { ArrowLeft, ExternalLink, FileText, Loader2, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_ESTIMATE_CATEGORIES: EstimateCategory[] = [
  "Kitchen",
  "Bathroom",
  "Flooring",
  "Painting",
  "Electrical",
  "Plumbing",
  "Heating",
  "Roofing",
  "Structural",
  "Damp Treatment",
  "Garden",
  "Windows & Doors",
];

export const Route = createFileRoute("/_authed/studies/$id")({
  head: () => ({ meta: [{ title: "Feasibility Study — Refurb Genius" }] }),
  component: StudyDetailPage,
});

function StudyDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: study, isLoading } = useFeasibilityStudy(id);
  const createStudy = useCreateFeasibilityStudy();
  const queueExport = useQueueFeasibilityExport(study?.projectId ?? "");
  const exportFeasibilityReport = useExportFeasibilityReport();

  const { data: photos = [] } = usePhotos(study?.projectId ?? "");
  const { data: shareLinks = [] } = useShareLinks(id);
  const createShareLink = useCreateShareLink(id);
  const revokeShareLink = useRevokeShareLink(id);

  if (isLoading) {
    return (
      <AppLayout title="Loading study…" subtitle="Fetching the latest feasibility snapshot.">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading study...
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!study) {
    return (
      <AppLayout title="Study not found" subtitle="This feasibility study could not be loaded.">
        <EmptyState
          icon={FileText}
          title="Study unavailable"
          description="The study may have been deleted or you may not have access."
          action={
            <Button asChild variant="outline">
              <Link to="/studies">
                <ArrowLeft className="h-4 w-4" />
                Back to studies
              </Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  const currentStudy = study;

  async function handleRerun() {
    if (photos.length === 0) {
      toast.error("No project photos found. Upload photos to regenerate this study.");
      return;
    }

    const propertyCondition: ConditionLevel = currentStudy.property.property_condition ?? "Average";
    const command: CreateFeasibilityStudyCommand = {
      projectId: currentStudy.projectId,
      property: currentStudy.property,
      photos: photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        name: photo.name,
        size: photo.size,
      })),
      scopeInput: {
        roomTags: currentStudy.scope.rooms.map((room) => room.room),
        propertyType: currentStudy.property.property_type,
        bedrooms: currentStudy.property.bedrooms,
        bathrooms: currentStudy.property.bathrooms,
        region: currentStudy.property.region,
        notes: currentStudy.property.notes || undefined,
      },
      estimateInput: {
        region: currentStudy.property.region,
        property_condition: propertyCondition,
        finish_quality: "Standard",
        selected_categories: DEFAULT_ESTIMATE_CATEGORIES,
        property_size_sqm: Math.max(currentStudy.property.size_sqm, 1),
      },
      roiInput: {
        purchase_price: currentStudy.property.purchase_price,
        estimated_gdv: currentStudy.property.estimated_gdv,
        rental_income: 0,
        projected_rental_income: undefined,
        holding_costs: Math.round(currentStudy.property.purchase_price * 0.02),
        region: currentStudy.property.region,
        property_condition: propertyCondition,
      },
    };

    const result = await createStudy.mutateAsync(command);
    toast.success("New feasibility snapshot created.");
    navigate({ to: "/studies/$id", params: { id: result.study.id } });
  }

  return (
    <AppLayout
      title={`Study ${currentStudy.id.slice(0, 8)}`}
      subtitle={`Project ${currentStudy.property.name || currentStudy.property.address} · v${currentStudy.metadata.version}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/studies">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button onClick={handleRerun} disabled={createStudy.isPending}>
            {createStudy.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Re-run orchestration
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{currentStudy.status}</Badge>
              <span className="text-muted-foreground">
                Updated {currentStudy.updatedAt.toLocaleString("en-GB")}
              </span>
            </div>
            <p>
              <span className="font-medium">Scope summary:</span> {currentStudy.scope.summary}
            </p>
            <p>
              <span className="font-medium">Estimate:</span> £
              {currentStudy.estimate.mid_total.toLocaleString("en-GB")}
            </p>
            <p>
              <span className="font-medium">ROI:</span>{" "}
              {currentStudy.roi.baseMetrics.roi.toFixed(1)}%
            </p>
            <p>
              <span className="font-medium">Investment score:</span>{" "}
              {currentStudy.roi.baseMetrics.investment_score.toFixed(1)}/10
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <h2 className="font-semibold">Export & sharing</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => queueExport.mutate(currentStudy.id)}
                disabled={queueExport.isPending}
              >
                <FileText className="h-4 w-4" />
                Queue export
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  exportFeasibilityReport.mutate({
                    studyId: currentStudy.id,
                    filename: `feasibility-${currentStudy.id.slice(0, 8)}.pdf`,
                  })
                }
                disabled={exportFeasibilityReport.isPending}
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  createShareLink.mutate({
                    visibility: "private",
                    accessRole: "investor",
                    expiresAt: null,
                  })
                }
                disabled={createShareLink.isPending}
              >
                <Share2 className="h-4 w-4" />
                New share link
              </Button>
            </div>
            {shareLinks.length === 0 ? (
              <p className="text-muted-foreground">No active share links.</p>
            ) : (
              <div className="space-y-2">
                {shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
                  >
                    <div className="text-xs text-muted-foreground">
                      {link.accessRole} ·{" "}
                      {link.expiresAt ? `expires ${link.expiresAt}` : "no expiry"}
                    </div>
                    <div className="flex gap-1">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/studies/share/${link.token}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revokeShareLink.mutate({ linkId: link.id })}
                        disabled={revokeShareLink.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
