import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  ChevronDown,
  Download,
  Gauge,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { addDiagnosticBreadcrumb } from "@/lib/sentry";
import { toast } from "sonner";
import { useProject } from "@/hooks/useProjects";
import { usePhotos } from "@/hooks/usePhotos";
import { useScopeAnalysis } from "@/hooks/useScopeAnalysis";
import { useSavedScopeAnalysis, useSaveScopeAnalysis } from "@/hooks/useScopeAnalysisPersistence";
import { formatGBP, getRegionalMultiplier, calculateLineItem } from "@/core/pricing";
import type {
  ScopeAnalysisResult,
  ScopeRoom,
  ScopeIssue,
} from "@/core/ai/server/openAiScopeAnalysis.server";

export const Route = createFileRoute("/projects/$id/scope")({
  head: () => ({ meta: [{ title: "AI scope analysis — Refurb Genius" }] }),
  component: ScopePage,
});

// ──────────────────────────────────────────────────────────────
// Room tag options
// ──────────────────────────────────────────────────────────────

const ROOM_OPTIONS = [
  "Kitchen",
  "Bathroom",
  "Living Room",
  "Bedrooms",
  "Hallway",
  "Garden",
  "Exterior",
] as const;

const DEFAULT_ROOM_TAGS = ["Kitchen", "Bathroom", "Living Room", "Bedrooms"];

// ──────────────────────────────────────────────────────────────
// Severity helpers
// ──────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical:
    "border-destructive/30 bg-destructive/5 text-destructive dark:border-destructive/40 dark:bg-destructive/10",
  high: "border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-400",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  low: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function severityStyle(severity: string): string {
  return SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium;
}

// ──────────────────────────────────────────────────────────────
// Score display
// ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function scoreLabel(score: number): string {
  if (score >= 8) return "Good condition";
  if (score >= 6) return "Fair — needs some work";
  if (score >= 4) return "Below average — significant refurb needed";
  return "Poor — full renovation recommended";
}

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

function ScopePage() {
  const { id } = Route.useParams();
  const { data: project, isLoading, error } = useProject(id);

  if (isLoading) {
    return (
      <AppLayout title="AI scope analysis" subtitle="Loading project details...">
        <LoadingState label="Loading project..." />
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="AI scope analysis" subtitle="Failed to load project">
        <EmptyState
          icon={AlertCircle}
          title="Failed to load project"
          description="We couldn't load this project. Please try again."
        />
      </AppLayout>
    );
  }

  if (!project) return <Navigate to="/dashboard" />;

  return <ScopeContent id={id} project={project} />;
}

// ──────────────────────────────────────────────────────────────
// Main content
// ──────────────────────────────────────────────────────────────

function ScopeContent({
  id,
  project,
}: {
  id: string;
  project: { property_type: string; bedrooms: number; bathrooms: number; region: string };
}) {
  const navigate = useNavigate();
  const { data: photos = [], isLoading: photosLoading } = usePhotos(id);
  const scopeAnalysis = useScopeAnalysis();
  const { data: savedAnalysis, isLoading: savedLoading } = useSavedScopeAnalysis(id);
  const saveScopeMutation = useSaveScopeAnalysis();

  const [roomTags, setRoomTags] = useState<string[]>([...DEFAULT_ROOM_TAGS]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ScopeAnalysisResult | null>(null);
  const [openRooms, setOpenRooms] = useState<Set<string>>(new Set());
  const [pdfExporting, setPdfExporting] = useState(false);

  // Hydrate from saved analysis on first load (only if no fresh result yet)
  useEffect(() => {
    if (savedAnalysis && !result) {
      setResult(savedAnalysis);
      setOpenRooms(new Set(savedAnalysis.rooms.map((r) => r.room)));
    }
  }, [savedAnalysis, result]);

  const multiplier = getRegionalMultiplier(project.region);

  function toggleRoomTag(tag: string, checked: boolean) {
    setRoomTags((prev) => (checked ? [...prev, tag] : prev.filter((t) => t !== tag)));
  }

  function toggleRoom(roomName: string) {
    setOpenRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomName)) next.delete(roomName);
      else next.add(roomName);
      return next;
    });
  }

  function handleAnalyse() {
    if (photos.length === 0) {
      toast.error("Upload photos first to run the scope analysis");
      return;
    }

    scopeAnalysis.mutate(
      {
        projectId: id,
        photos: photos.map(({ id, url, name, size }) => ({ id, url, name, size })),
        roomTags,
        propertyType: project.property_type,
        bedrooms: project.bedrooms,
        bathrooms: project.bathrooms,
        region: project.region,
        notes: notes || undefined,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setOpenRooms(new Set(data.rooms.map((r) => r.room)));
          toast.success(
            `Analysis complete — ${data.rooms.length} rooms, ${data.rooms.reduce((s, r) => s + r.issues.length, 0)} issues detected`,
          );

          // Auto-save to database
          saveScopeMutation.mutate(
            {
              projectId: id,
              analysis: data,
              region: project.region,
              notes: notes || undefined,
            },
            {
              onSuccess: () => {
                toast.success("Scope analysis saved");
              },
              onError: (err) => {
                console.error("Failed to save scope analysis:", err);
                toast.error("Analysis complete but failed to save — results are visible above");
              },
            },
          );
        },
        onError: (err) => {
          toast.error(err.message || "Scope analysis failed");
        },
      },
    );
  }

  // Estimated cost from recommended items (regionally adjusted)
  const estimatedCosts = useMemo(() => {
    if (!result) return null;
    let subtotal = 0;
    for (const room of result.rooms) {
      for (const item of room.recommended_items) {
        const calc = calculateLineItem(item, multiplier);
        subtotal += calc.total_cost;
      }
    }
    const vat = Math.round(subtotal * 0.2 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    return { subtotal, vat, total };
  }, [result, multiplier]);

  // Issue stats
  const issueStats = useMemo(() => {
    if (!result) return null;
    const allIssues = result.rooms.flatMap((r) => r.issues);
    return {
      total: allIssues.length,
      critical: allIssues.filter((i) => i.severity === "critical").length,
      high: allIssues.filter((i) => i.severity === "high").length,
      medium: allIssues.filter((i) => i.severity === "medium").length,
      low: allIssues.filter((i) => i.severity === "low").length,
    };
  }, [result]);

  // PDF export — reuses the existing html2canvas + jsPDF pipeline
  const handleExportPdf = useCallback(async () => {
    if (pdfExporting || !result) return;
    setPdfExporting(true);
    try {
      const { exportReportPdf } = await import("@/lib/exportPdf");
      await exportReportPdf({
        filename: `scope-analysis-${id}`,
        onProgress: (stage) => {
          if (stage === "complete") {
            toast.success("PDF exported");
          }
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`PDF export failed: ${errorMsg}`);
      addDiagnosticBreadcrumb("pdf:scope:error", { error: errorMsg });
    } finally {
      setPdfExporting(false);
    }
  }, [pdfExporting, result, id]);

  // Navigate to estimate builder with scope rooms pre-loaded via session storage
  function handleOpenEstimateBuilder() {
    if (!result) return;
    // Store scope rooms in sessionStorage so the estimate page can pick them up
    sessionStorage.setItem(`scope-rooms:${id}`, JSON.stringify(result.rooms));
    navigate({ to: "/projects/$id/estimate", params: { id }, search: { from: "scope" } });
  }

  return (
    <AppLayout
      title="AI scope analysis"
      subtitle="Photo-based condition assessment with costed scope of works."
      actions={
        result ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPdf} disabled={pdfExporting}>
              {pdfExporting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-1 h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
            <Button onClick={handleOpenEstimateBuilder}>
              Open estimate builder <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* Controls */}
      <Card>
        <CardContent className="space-y-5 p-6">
          {/* Photo count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Camera className="h-4 w-4 text-muted-foreground" />
              {photosLoading ? (
                <span className="text-muted-foreground">Loading photos...</span>
              ) : photos.length > 0 ? (
                <span>
                  <span className="font-medium text-foreground">{photos.length}</span> photo
                  {photos.length !== 1 ? "s" : ""} available
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No photos uploaded yet.{" "}
                  <Link
                    to="/projects/$id/upload"
                    params={{ id }}
                    className="font-medium text-foreground underline underline-offset-4 hover:text-accent"
                  >
                    Upload photos
                  </Link>
                </span>
              )}
            </div>
            {photos.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Up to 10 analysed
              </Badge>
            )}
          </div>

          {/* Room tags */}
          <div>
            <Label className="mb-3 block">Rooms to focus on</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ROOM_OPTIONS.map((room) => {
                const checked = roomTags.includes(room);
                return (
                  <label
                    key={room}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 text-sm hover:bg-accent/5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleRoomTag(room, Boolean(v))}
                    />
                    <span className="text-foreground">{room}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1930s semi, needs full modernisation for rental market"
              rows={2}
            />
          </div>

          {/* Analyse button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleAnalyse}
              disabled={scopeAnalysis.isPending || photos.length === 0}
            >
              {scopeAnalysis.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analysing photos...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analyse property photos
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading saved analysis */}
      {savedLoading && !result && (
        <div className="mt-6">
          <LoadingState label="Loading previous scope analysis..." />
        </div>
      )}

      {/* Results — wrapped in print-area for PDF export */}
      {result && (
        <div className="print-area">
          {/* Score + Summary */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Gauge className="h-4 w-4" /> Condition score
                </div>
                <p
                  className={`mt-2 text-4xl font-bold tracking-tight ${scoreColor(result.overall_score)}`}
                >
                  {result.overall_score}/10
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scoreLabel(result.overall_score)}
                </p>
              </CardContent>
            </Card>

            {issueStats && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <ShieldAlert className="h-4 w-4" /> Issues detected
                  </div>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                    {issueStats.total}
                  </p>
                  <div className="mt-1 flex gap-2 text-xs">
                    {issueStats.critical > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {issueStats.critical} critical
                      </Badge>
                    )}
                    {issueStats.high > 0 && (
                      <Badge className="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400">
                        {issueStats.high} high
                      </Badge>
                    )}
                    {issueStats.medium > 0 && (
                      <span className="text-muted-foreground">{issueStats.medium} medium</span>
                    )}
                    {issueStats.low > 0 && (
                      <span className="text-muted-foreground">{issueStats.low} low</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {estimatedCosts && (
              <Card className="border-accent/40 bg-accent/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-4 w-4" /> Estimated refurb cost
                  </div>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                    {formatGBP(estimatedCosts.total)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inc. VAT &middot; {project.region} pricing
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          <Card className="mt-4">
            <CardContent className="p-5">
              <p className="text-sm leading-relaxed text-foreground">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Room-by-room breakdown */}
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Room-by-room assessment
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Issues detected and recommended scope of works per room.
              </p>
            </div>

            <div className="space-y-3">
              {result.rooms.map((room) => (
                <RoomCard
                  key={room.room}
                  room={room}
                  isOpen={openRooms.has(room.room)}
                  onToggle={() => toggleRoom(room.room)}
                  multiplier={multiplier}
                />
              ))}
            </div>
          </div>

          {/* CTA — hidden from PDF */}
          <Card className="no-print mt-8 border-dashed">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <p className="text-base font-semibold text-foreground">
                  Ready to build a detailed estimate?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Take these recommendations into the AI Estimate Builder for a full line-item
                  breakdown with regional pricing.
                </p>
              </div>
              <Button size="lg" className="shrink-0" onClick={handleOpenEstimateBuilder}>
                Open estimate builder <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

// ──────────────────────────────────────────────────────────────
// Room card component
// ──────────────────────────────────────────────────────────────

function RoomCard({
  room,
  isOpen,
  onToggle,
  multiplier,
}: {
  room: ScopeRoom;
  isOpen: boolean;
  onToggle: () => void;
  multiplier: number;
}) {
  const roomSubtotal = useMemo(() => {
    return room.recommended_items.reduce((s, item) => {
      const calc = calculateLineItem(item, multiplier);
      return s + calc.total_cost;
    }, 0);
  }, [room, multiplier]);

  const sortedIssues = useMemo(
    () =>
      [...room.issues].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
      ),
    [room.issues],
  );

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between border-b border-border px-5 py-3 hover:bg-muted/30">
            <div className="flex items-center gap-3">
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
              />
              <span className="font-medium text-foreground">{room.room}</span>
              {room.area_sqm && (
                <Badge variant="secondary" className="text-xs">
                  {room.area_sqm} m&sup2;
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {room.issues.length} issue{room.issues.length !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {room.recommended_items.length} item{room.recommended_items.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatGBP(roomSubtotal)}
            </span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-5 p-5">
            {/* Condition summary */}
            <p className="text-sm text-muted-foreground">{room.condition_summary}</p>

            {/* Issues */}
            {sortedIssues.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Issues detected
                </h4>
                <div className="space-y-2">
                  {sortedIssues.map((issue, i) => (
                    <IssueRow key={i} issue={issue} />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended items */}
            {room.recommended_items.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended scope
                </h4>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="px-3 py-2 text-left font-medium">Category</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-left font-medium">Unit</th>
                        <th className="px-3 py-2 text-right font-medium">Base</th>
                        <th className="px-3 py-2 text-right font-medium">Adj.</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.recommended_items.map((item, i) => {
                        const calc = calculateLineItem(item, multiplier);
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground">
                              {item.name}
                              {item.notes && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  — {item.notes}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.unit}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {formatGBP(item.base_unit_cost)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatGBP(calc.unit_cost)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatGBP(calc.total_cost)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ──────────────────────────────────────────────────────────────
// Issue row
// ──────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: ScopeIssue }) {
  return (
    <div className={`rounded-md border p-3 ${severityStyle(issue.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0 text-xs">
              {issue.category}
            </Badge>
            <span className="text-xs font-semibold uppercase">{issue.severity}</span>
          </div>
          <p className="mt-1 text-sm">{issue.description}</p>
        </div>
      </div>
      <p className="mt-2 text-xs opacity-80">
        <span className="font-medium">Action:</span> {issue.recommended_action}
      </p>
    </div>
  );
}
