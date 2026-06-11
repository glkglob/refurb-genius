"use client";

import { useState, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui";
import { Input } from "@repo/ui";
import { Textarea } from "@repo/ui";
import { Label } from "@repo/ui";
import { Badge } from "@repo/ui";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/platform/supabase/browser";
import { estimateQueryOptions } from "@/lib/queries/projects";
import { photoAnalysisByProjectQueryOptions } from "@/lib/queries/photo-analysis";
import { PhotoAnalysisFilters } from "./PhotoAnalysisFilters";
import { PhotoAnalysisCard } from "./PhotoAnalysisCard";
import type { ProjectPhoto } from "@/lib/photos";
import type { PhotoAnalysisResultRow } from "@/lib/queries/photo-analysis";
import type { PersistedRoomEstimate } from "@/features/estimate/infrastructure";

interface PhotoAnalysisViewerProps {
  projectId: string;
  photos: ProjectPhoto[];
  analyses: PhotoAnalysisResultRow[];
}

interface ParsedDefect {
  description: string;
  severity: "low" | "medium" | "high";
  category?: string;
  estimated_cost?: number;
}

interface ParsedAnalysis {
  room?: string;
  condition_report?: string;
  defects?: ParsedDefect[];
  material_estimates?: Array<{
    name: string;
    quantity: number;
    unit: string;
    cost_per_unit?: number;
  }>;
  cost_suggestions?: { low?: number; mid: number; high?: number };
  category?: string;
  confidence?: number;
}

function rowToParsed(a?: PhotoAnalysisResultRow): ParsedAnalysis {
  if (!a) return {};
  return {
    room: a.category ?? undefined,
    condition_report: a.condition_report ?? undefined,
    defects: (a.detected_defects as unknown as ParsedDefect[]) ?? [],
    material_estimates: a.material_estimates as ParsedAnalysis["material_estimates"],
    cost_suggestions: a.cost_suggestions as ParsedAnalysis["cost_suggestions"],
    category: a.category ?? undefined,
    confidence: a.confidence_score ?? undefined,
  };
}

interface SelectedSuggestion {
  photoId: string;
  analysisId: string;
  defect?: ParsedDefect;
}

export function PhotoAnalysisViewer({ projectId, photos, analyses }: PhotoAnalysisViewerProps) {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "analyzed" | "unanalyzed">("all");

  // Selection for bulk apply
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // analysis ids

  // Detail / Edit dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState<{
    photo: ProjectPhoto;
    analysis: PhotoAnalysisResultRow;
  } | null>(null);
  const [editForm, setEditForm] = useState<ParsedAnalysis>({});

  // Join photos + analyses
  const photoMap = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const analysisByPhotoId = useMemo(() => {
    const m = new Map<string, PhotoAnalysisResultRow>();
    analyses.forEach((a) => {
      if (a.photo_id) m.set(a.photo_id, a);
    });
    return m;
  }, [analyses]);

  const allItems = useMemo(() => {
    const withAnalysis = analyses
      .filter((a) => a.photo_id && photoMap.has(a.photo_id))
      .map((a) => ({ photo: photoMap.get(a.photo_id!)!, analysis: a, hasAnalysis: true }));

    const unanalyzedPhotos = photos
      .filter((p) => !analysisByPhotoId.has(p.id))
      .map((p) => ({ photo: p, analysis: undefined, hasAnalysis: false }));

    return [...withAnalysis, ...unanalyzedPhotos];
  }, [photos, analyses, photoMap, analysisByPhotoId]);

  // Derived filter options
  const availableRooms = useMemo(() => {
    const rooms = new Set<string>();
    analyses.forEach((a) => {
      const p = rowToParsed(a).room;
      if (p) rooms.add(p);
    });
    return Array.from(rooms).sort();
  }, [analyses]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    analyses.forEach((a) => {
      const data = rowToParsed(a);
      if (data?.category) cats.add(data.category);
      (data?.defects || []).forEach((d) => {
        if (d.category) cats.add(d.category);
      });
    });
    return Array.from(cats).sort();
  }, [analyses]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const { photo, analysis, hasAnalysis } = item;
      const data = rowToParsed(analysis);

      // Status
      if (statusFilter === "analyzed" && !hasAnalysis) return false;
      if (statusFilter === "unanalyzed" && hasAnalysis) return false;

      // Text search
      if (search) {
        const s = search.toLowerCase();
        const hay = [
          photo.name,
          data.condition_report || "",
          data.room || "",
          ...(data.defects || []).map((d) => d.description || ""),
          ...(data.material_estimates || []).map((m) => m.name || ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }

      // Room
      if (roomFilter !== "all" && data.room !== roomFilter) return false;

      // Category
      if (categoryFilter !== "all") {
        const catMatch =
          data.category === categoryFilter ||
          (data.defects || []).some((d) => d.category === categoryFilter);
        if (!catMatch) return false;
      }

      // Severity — unanalyzed photos never match a specific severity filter
      if (severityFilter !== "all") {
        if (!hasAnalysis) return false;
        const defects: ParsedDefect[] = data.defects || [];
        if (!defects.some((d) => d.severity === severityFilter)) return false;
      }

      return true;
    });
  }, [allItems, search, roomFilter, severityFilter, categoryFilter, statusFilter]);

  const toggleSelect = (photoId: string, analysisId?: string) => {
    if (!analysisId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(analysisId)) next.delete(analysisId);
      else next.add(analysisId);
      return next;
    });
  };

  // Open detail
  const openDetails = (photo: ProjectPhoto, analysis?: PhotoAnalysisResultRow) => {
    if (analysis) {
      setEditingAnalysis({ photo, analysis });
      setEditForm(rowToParsed(analysis));
      setDetailOpen(true);
    } else {
      // For unanalyzed, just show photo info (no edit)
      toast.info("No analysis data for this photo yet.");
    }
  };

  // Edit save with optimistic
  const editMutation = useMutation({
    mutationFn: async ({ id, newData }: { id: string; newData: ParsedAnalysis }) => {
      const { error } = await supabase
        .from("photo_analysis_results")
        .update({
          category: newData.category ?? null,
          condition_report: newData.condition_report ?? null,
          detected_defects: (newData.defects ??
            []) as unknown as import("@repo/supabase/database.types").Json,
          material_estimates: (newData.material_estimates ??
            []) as unknown as import("@repo/supabase/database.types").Json,
          cost_suggestions: (newData.cost_suggestions ??
            {}) as unknown as import("@repo/supabase/database.types").Json,
          confidence_score: newData.confidence ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      return { id, newData };
    },
    onMutate: async ({ id, newData }) => {
      const key = photoAnalysisByProjectQueryOptions(projectId).queryKey;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PhotoAnalysisResultRow[]>(key);
      queryClient.setQueryData<PhotoAnalysisResultRow[]>(key, (old = []) =>
        old.map((a) =>
          a.id === id
            ? {
                ...a,
                category: newData.category ?? null,
                condition_report: newData.condition_report ?? null,
                detected_defects: (newData.defects ??
                  []) as unknown as import("@repo/supabase/database.types").Json,
                material_estimates: (newData.material_estimates ??
                  []) as unknown as import("@repo/supabase/database.types").Json,
                cost_suggestions: (newData.cost_suggestions ??
                  {}) as unknown as import("@repo/supabase/database.types").Json,
                confidence_score: newData.confidence ?? null,
              }
            : a,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          photoAnalysisByProjectQueryOptions(projectId).queryKey,
          ctx.previous,
        );
      }
      toast.error("Failed to save edits");
    },
    onSuccess: () => {
      toast.success("Analysis updated");
      queryClient.invalidateQueries({
        queryKey: photoAnalysisByProjectQueryOptions(projectId).queryKey,
      });
    },
    onSettled: () => {
      setDetailOpen(false);
      setEditingAnalysis(null);
    },
  });

  const saveEdit = () => {
    if (!editingAnalysis) return;
    editMutation.mutate({ id: editingAnalysis.analysis.id, newData: editForm });
  };

  // Apply single or selected to Estimate (optimistic + invalidate)
  const applyToEstimate = async (singleAnalysis?: PhotoAnalysisResultRow) => {
    const toApply = singleAnalysis
      ? [singleAnalysis]
      : (Array.from(selectedIds)
          .map((id) => analyses.find((a) => a.id === id))
          .filter(Boolean) as PhotoAnalysisResultRow[]);

    if (toApply.length === 0) {
      toast.error("No analyses selected");
      return;
    }

    const estimateKey = estimateQueryOptions(projectId).queryKey;
    const current = queryClient.getQueryData<PersistedRoomEstimate | null>(estimateKey);

    // Build suggested rooms/items from analyses
    const suggestedRooms: Record<string, { name: string; items: Record<string, unknown>[] }> = {};

    toApply.forEach((analysis) => {
      const data = rowToParsed(analysis);
      const roomName = data.room || "General / Unspecified";
      if (!suggestedRooms[roomName]) {
        suggestedRooms[roomName] = { name: roomName, items: [] };
      }

      // Defects -> items
      (data.defects || []).forEach((def: ParsedDefect, idx: number) => {
        suggestedRooms[roomName].items.push({
          id: `sugg-${analysis.id}-${idx}`,
          name: def.description,
          category: def.category || data.category || "General",
          quantity: 1,
          unit: "item",
          unit_cost:
            def.estimated_cost ||
            (data.cost_suggestions?.mid ? Math.round(data.cost_suggestions.mid / 10) : 150),
          notes: `From AI photo analysis (conf ${Math.round((analysis.confidence_score || 0.8) * 100)}%)`,
        });
      });

      // Materials
      (data.material_estimates || []).forEach((mat, idx: number) => {
        suggestedRooms[roomName].items.push({
          id: `sugg-mat-${analysis.id}-${idx}`,
          name: mat.name,
          category: data.category || "Materials",
          quantity: mat.quantity || 1,
          unit: mat.unit || "item",
          unit_cost: mat.cost_per_unit || 50,
          notes: "AI material estimate",
        });
      });
    });

    const newRooms = Object.values(suggestedRooms).map((r) => ({
      id: crypto.randomUUID(),
      name: r.name,
      items: r.items,
    }));

    // Merge into current estimate rooms (append or create)
    const existingRooms = current?.rooms || [];
    const mergedRooms = [...existingRooms, ...newRooms];

    // Optimistic update query data (invalidate as specified)
    if (current) {
      queryClient.setQueryData(estimateKey, { ...current, rooms: mergedRooms } as never);
    } else {
      queryClient.setQueryData(estimateKey, { rooms: mergedRooms } as never);
    }

    // Invalidate as required
    queryClient.invalidateQueries({ queryKey: estimateKey });

    toast.success(`Applied ${toApply.length} analysis(es) to Estimate`, {
      description: `${newRooms.length} room(s) suggested. Switch to Estimate Builder tab.`,
    });

    // Clear selection
    setSelectedIds(new Set());
  };

  // Per card quick apply
  const handleQuickApply = (photo: ProjectPhoto, analysis: PhotoAnalysisResultRow) => {
    applyToEstimate(analysis);
  };

  // Bulk apply
  const handleBulkApply = () => {
    applyToEstimate();
  };

  // Parse helper for cards
  const getParsed = (a?: PhotoAnalysisResultRow): ParsedAnalysis => rowToParsed(a);

  return (
    <div>
      <PhotoAnalysisFilters
        search={search}
        setSearch={setSearch}
        roomFilter={roomFilter}
        setRoomFilter={setRoomFilter}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        availableRooms={availableRooms}
        availableCategories={availableCategories}
      />

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <Badge>{selectedIds.size} selected</Badge>
          <Button size="sm" onClick={handleBulkApply}>
            Apply Selected to Estimate
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No photos match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(({ photo, analysis, hasAnalysis }) => (
            <PhotoAnalysisCard
              key={photo.id}
              photo={photo}
              analysis={analysis}
              isSelected={analysis ? selectedIds.has(analysis.id) : false}
              onToggleSelect={toggleSelect}
              onViewDetails={openDetails}
              onEdit={
                hasAnalysis
                  ? (p, a) => {
                      setEditingAnalysis({ photo: p, analysis: a });
                      setEditForm(rowToParsed(a));
                      setDetailOpen(true);
                    }
                  : undefined
              }
              onApply={hasAnalysis ? handleQuickApply : undefined}
            />
          ))}
        </div>
      )}

      {/* Detail / Edit Dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDetailOpen(false);
            setEditingAnalysis(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          {editingAnalysis && (
            <>
              <DialogHeader>
                <DialogTitle>Analysis for {editingAnalysis.photo.name}</DialogTitle>
                <div className="flex gap-2">
                  <Badge>{getParsed(editingAnalysis.analysis).room || "Unknown room"}</Badge>
                  <Badge variant="outline">
                    {Math.round((editingAnalysis.analysis.confidence_score || 0) * 100)}% confidence
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Image */}
                <img
                  src={editingAnalysis.photo.url}
                  alt=""
                  className="rounded w-full max-h-80 object-contain bg-black/5"
                />

                {/* Editable fields */}
                <div className="grid gap-4">
                  <div>
                    <Label>Room / Location</Label>
                    <Input
                      value={editForm.room || ""}
                      onChange={(e) =>
                        setEditForm((f: ParsedAnalysis) => ({ ...f, room: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Condition Report</Label>
                    <Textarea
                      value={editForm.condition_report || ""}
                      onChange={(e) =>
                        setEditForm((f: ParsedAnalysis) => ({
                          ...f,
                          condition_report: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Defects (JSON editable for flexibility)</Label>
                    <Textarea
                      value={JSON.stringify(editForm.defects || [], null, 2)}
                      onChange={(e) => {
                        try {
                          setEditForm((f: ParsedAnalysis) => ({
                            ...f,
                            defects: JSON.parse(e.target.value),
                          }));
                        } catch (_e) {
                          // ignore invalid JSON while typing
                        }
                      }}
                      rows={6}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <Label>Cost Suggestions (mid example)</Label>
                    <Input
                      type="number"
                      value={editForm.cost_suggestions?.mid || ""}
                      onChange={(e) =>
                        setEditForm((f: ParsedAnalysis) => ({
                          ...f,
                          cost_suggestions: {
                            ...(f.cost_suggestions || {}),
                            mid: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEdit} disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Saving..." : "Save Edits (Optimistic)"}
                </Button>
                <Button variant="default" onClick={() => applyToEstimate(editingAnalysis.analysis)}>
                  Apply this to Estimate
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
