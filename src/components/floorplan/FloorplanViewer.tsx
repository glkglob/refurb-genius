"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Upload, Trash2, Download, Eye, Tag, Ruler, RefreshCw, Plus, X } from "lucide-react";
import { Button } from "@repo/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { Input } from "@repo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { toast } from "sonner";
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { estimateQueryOptions } from "@/lib/queries/projects";
import {
  floorplansByProjectQueryOptions,
  floorplanAnnotationsQueryOptions,
  floorplanMeasurementsQueryOptions,
  floorplanKeys,
} from "@/lib/queries/floorplans";
import {
  uploadFloorplanModel,
  deleteFloorplanStorage,
  pointToArray,
  exportScreenshot,
  exportAnnotationsJson,
} from "@/lib/floorplan";
import { FloorplanScene } from "./FloorplanScene";
import type { Tables } from "@repo/supabase";
import type { PersistedRoomEstimate } from "@/features/estimate/infrastructure";

type FloorplanModelRow = Tables<"floorplan_models">;
type FloorplanAnnotationRow = Tables<"floorplan_annotations">;
type FloorplanMeasurementRow = Tables<"floorplan_measurements">;

export interface FloorplanViewerProps {
  projectId: string;
}

type Mode = "view" | "tag" | "measure";

interface PendingTag {
  position: { x: number; y: number; z: number };
}

export function FloorplanViewer({ projectId }: FloorplanViewerProps) {
  const queryClient = useQueryClient();

  // Data fetching - non-blocking for the tab
  const {
    data: models = [],
    isLoading: modelsLoading,
    error: modelsError,
  } = useQuery(floorplansByProjectQueryOptions(projectId));

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Auto-select first model (effect style via useEffect below to avoid render side-effects)

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;

  // Auto-select the first model when list loads (avoids setState during render)
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const { data: annotations = [] } = useQuery({
    ...floorplanAnnotationsQueryOptions(selectedModelId || ""),
    enabled: !!selectedModelId,
  });

  const { data: measurements = [] } = useQuery({
    ...floorplanMeasurementsQueryOptions(selectedModelId || ""),
    enabled: !!selectedModelId,
  });

  // Estimate rooms for linking tags (optional but required by spec)
  const { data: estimateData } = useQuery(estimateQueryOptions(projectId));
  const estimateRooms: PersistedRoomEstimate["rooms"] = estimateData?.rooms ?? [];

  // Local UI state
  const [mode, setMode] = useState<Mode>("view");
  const [pendingTag, setPendingTag] = useState<PendingTag | null>(null);
  const [tagLabel, setTagLabel] = useState("");
  const [linkedRoomId, setLinkedRoomId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  // Mutations
  const createModelMutation = useMutation({
    mutationFn: async (file: File) => {
      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in to upload models.");

      setIsUploading(true);
      const { path } = await uploadFloorplanModel(projectId, file, user.id);

      const { data: inserted, error } = await supabase
        .from("floorplan_models")
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          name: file.name.replace(/\.[^/.]+$/, ""),
          storage_path: path,
          file_type: file.name.split(".").pop()?.toLowerCase() ?? "glb",
          metadata: { originalName: file.name, size: file.size },
        })
        .select()
        .single();

      if (error) {
        // Attempt cleanup
        await deleteFloorplanStorage(path).catch(() => {});
        throw error;
      }
      return inserted as FloorplanModelRow;
    },
    onSuccess: (newModel) => {
      queryClient.invalidateQueries({ queryKey: floorplanKeys.byProject(projectId) });
      setSelectedModelId(newModel.id);
      toast.success("Model uploaded", { description: newModel.name });
    },
    onError: (err: Error) => {
      logger.error("[floorplan] model create failed", { projectId, error: err.message });
      toast.error("Upload failed", { description: err.message });
    },
    onSettled: () => setIsUploading(false),
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (model: FloorplanModelRow) => {
      if (model.storage_path) {
        await deleteFloorplanStorage(model.storage_path);
      }
      const { error } = await supabase.from("floorplan_models").delete().eq("id", model.id);
      if (error) throw error;
    },
    onSuccess: (_, model) => {
      queryClient.invalidateQueries({ queryKey: floorplanKeys.byProject(projectId) });
      if (selectedModelId === model.id) {
        const remaining = models.filter((m) => m.id !== model.id);
        setSelectedModelId(remaining[0]?.id ?? null);
      }
      toast.success("Model deleted");
    },
    onError: (err: Error) => {
      toast.error("Delete failed", { description: err.message });
    },
  });

  const saveAnnotationMutation = useMutation({
    mutationFn: async (payload: {
      position: { x: number; y: number; z: number };
      label: string;
      linkedRoomId?: string;
    }) => {
      if (!selectedModelId) throw new Error("No model selected");

      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in");

      const THREE = await import("three");
      const posVec = new THREE.Vector3(payload.position.x, payload.position.y, payload.position.z);

      const { error } = await supabase.from("floorplan_annotations").insert({
        model_id: selectedModelId,
        project_id: projectId,
        created_by: user.id,
        label: payload.label,
        position: pointToArray(posVec) as unknown as import("@repo/supabase/database.types").Json,
        room_id: payload.linkedRoomId ?? null,
        notes: payload.linkedRoomId
          ? (estimateRooms.find((r) => r.id === payload.linkedRoomId)?.name ?? null)
          : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: floorplanKeys.annotationsByModel(selectedModelId!),
      });
      toast.success("Room tagged");
      setPendingTag(null);
      setTagLabel("");
      setLinkedRoomId("");
      setMode("view");
    },
    onError: (err: Error) => {
      toast.error("Failed to save tag", { description: err.message });
    },
  });

  const saveMeasurementMutation = useMutation({
    mutationFn: async (payload: {
      p1: { x: number; y: number; z: number };
      p2: { x: number; y: number; z: number };
    }) => {
      if (!selectedModelId) throw new Error("No model selected");

      const THREE = await import("three");
      const v1 = new THREE.Vector3(payload.p1.x, payload.p1.y, payload.p1.z);
      const v2 = new THREE.Vector3(payload.p2.x, payload.p2.y, payload.p2.z);
      const dist = v1.distanceTo(v2);

      // NOTE: measurements table stores scalar value + unit. Points are only kept for the live session.
      // Persisted measurements appear in the list with their value.
      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in");

      const { error } = await supabase.from("floorplan_measurements").insert({
        model_id: selectedModelId,
        project_id: projectId,
        created_by: user.id,
        measurement_type: "distance",
        value: Math.round(dist * 1000) / 1000,
        unit: "m",
        points: [
          [payload.p1.x, payload.p1.y, payload.p1.z],
          [payload.p2.x, payload.p2.y, payload.p2.z],
        ] as unknown as import("@repo/supabase/database.types").Json,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: floorplanKeys.measurementsByModel(selectedModelId!),
      });
      toast.success("Measurement saved");
      setMode("view");
    },
    onError: (err: Error) => {
      toast.error("Failed to save measurement", { description: err.message });
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("floorplan_annotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (selectedModelId) {
        queryClient.invalidateQueries({
          queryKey: floorplanKeys.annotationsByModel(selectedModelId),
        });
      }
      toast.success("Annotation removed");
    },
    onError: (err: Error) => toast.error("Delete failed", { description: err.message }),
  });

  const deleteMeasurementMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("floorplan_measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (selectedModelId) {
        queryClient.invalidateQueries({
          queryKey: floorplanKeys.measurementsByModel(selectedModelId),
        });
      }
      toast.success("Measurement removed");
    },
    onError: (err: Error) => toast.error("Delete failed", { description: err.message }),
  });

  // Handlers
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const ext = file.name.toLowerCase().split(".").pop();
      if (!ext || !["glb", "gltf"].includes(ext)) {
        toast.error("Unsupported file", { description: "Please upload a .glb or .gltf file." });
        return;
      }
      createModelMutation.mutate(file);
    },
    [createModelMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSelectModel = (id: string) => {
    setSelectedModelId(id);
    setMode("view");
    setPendingTag(null);
  };

  const handleDeleteModel = (model: FloorplanModelRow) => {
    if (!confirm(`Delete model "${model.name}" and all its annotations?`)) return;
    deleteModelMutation.mutate(model);
  };

  // Called by the 3D scene when user clicks in tag mode
  const handleAddTagPoint = useCallback((position: { x: number; y: number; z: number }) => {
    setPendingTag({ position });
    setTagLabel("");
    setLinkedRoomId("");
    // Keep mode as tag until dialog closes
  }, []);

  // Called by scene for measure mode (collects two points)
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number; z: number }>>(
    [],
  );

  const handleMeasurePoint = useCallback(
    (position: { x: number; y: number; z: number }) => {
      const next = [...measurePoints, position];
      setMeasurePoints(next);

      if (next.length === 2) {
        saveMeasurementMutation.mutate({ p1: next[0], p2: next[1] });
        setMeasurePoints([]);
      }
    },
    [measurePoints, saveMeasurementMutation],
  );

  const handleSavePendingTag = () => {
    if (!pendingTag || !tagLabel.trim()) {
      toast.error("Label required");
      return;
    }
    saveAnnotationMutation.mutate({
      position: pendingTag.position,
      label: tagLabel.trim(),
      linkedRoomId: linkedRoomId || undefined,
    });
  };

  const handleCancelPendingTag = () => {
    setPendingTag(null);
    setTagLabel("");
    setLinkedRoomId("");
    setMode("view");
  };

  const handleExportScreenshot = () => {
    if (canvasRef) {
      exportScreenshot(canvasRef, `floorplan-${selectedModel?.name || "model"}.png`);
      toast.success("Screenshot exported");
    } else {
      toast.error("Canvas not ready for export");
    }
  };

  const handleExportData = () => {
    if (!selectedModel) return;
    exportAnnotationsJson(
      selectedModel,
      annotations,
      measurements,
      `floorplan-data-${selectedModel.name}.json`,
    );
    toast.success("Annotation data exported");
  };

  // Cross-feature sync: 3D Floorplan annotations -> Estimate rooms (hardening for integration)
  // Collects unique tag labels and appends as rooms to the estimate query data (optimistic + invalidate)
  const syncTagsToEstimate = () => {
    if (!annotations.length) return;
    const labels = Array.from(
      new Set(
        annotations
          .map((a) => a.label)
          .filter((l: unknown): l is string => typeof l === "string" && !!l),
      ),
    );
    if (!labels.length) return;

    const estimateKey = estimateQueryOptions(projectId).queryKey;
    const current = queryClient.getQueryData<{ rooms?: Array<{ name: string }> }>(estimateKey);
    const existingNames = new Set((current?.rooms || []).map((r) => r.name));
    const newRooms = labels
      .filter((l) => !existingNames.has(l))
      .map((label) => ({ id: `fp-${Date.now()}-${label}`, name: label, items: [] }));

    if (!newRooms.length) {
      toast.info("All tags already in Estimate");
      return;
    }

    const mergedRooms = [...(current?.rooms || []), ...newRooms];
    queryClient.setQueryData(
      estimateKey,
      // mergedRooms are optimistic placeholders; full shape will be populated on invalidation
      (current ? { ...current, rooms: mergedRooms } : { rooms: mergedRooms }) as never,
    );
    queryClient.invalidateQueries({ queryKey: estimateKey });
    toast.success(`Synced ${newRooms.length} room tags from 3D to Estimate Builder`);
  };

  const handleResetMode = () => {
    setMode("view");
    setMeasurePoints([]);
    setPendingTag(null);
  };

  const handleCanvasReady = (canvas: HTMLCanvasElement) => {
    setCanvasRef(canvas);
  };

  // Render
  if (modelsError) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">
          Failed to load floorplan models. {modelsError.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-floorplan-stage>
      {/* Top controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold">3D Floorplan</h3>
          <span className="text-sm text-muted-foreground">
            {models.length} model{models.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: floorplanKeys.byProject(projectId) });
              toast.info("Refreshed");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportScreenshot}
            disabled={!selectedModel || !canvasRef}
          >
            <Download className="mr-2 h-4 w-4" /> Screenshot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            disabled={!selectedModel || (annotations.length === 0 && measurements.length === 0)}
          >
            <Download className="mr-2 h-4 w-4" /> Export Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Sidebar: Models + Controls */}
        <div className="lg:col-span-3 space-y-4">
          {/* Upload */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="rounded-md border-2 border-dashed border-muted-foreground/30 p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("floorplan-file-input")?.click()}
              >
                <input
                  id="floorplan-file-input"
                  type="file"
                  accept=".glb,.gltf"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  disabled={isUploading || createModelMutation.isPending}
                />
                <p className="text-sm text-muted-foreground">
                  Drop .glb or .gltf here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Models are private to your project
                </p>
              </div>
              {(isUploading || createModelMutation.isPending) && (
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Uploading...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Model list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Models</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {modelsLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading models...</div>
              ) : models.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No models yet. Upload one above.
                </div>
              ) : (
                <div className="divide-y">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer ${
                        selectedModelId === model.id ? "bg-muted" : ""
                      }`}
                      onClick={() => handleSelectModel(model.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{model.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(model.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteModel(model);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mode + Tools */}
          {selectedModel && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={mode === "view" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMode("view");
                      setMeasurePoints([]);
                    }}
                  >
                    <Eye className="mr-1.5 h-4 w-4" /> View
                  </Button>
                  <Button
                    variant={mode === "tag" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMode("tag");
                      setMeasurePoints([]);
                    }}
                  >
                    <Tag className="mr-1.5 h-4 w-4" /> Tag Room
                  </Button>
                  <Button
                    variant={mode === "measure" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMode("measure");
                      setMeasurePoints([]);
                    }}
                  >
                    <Ruler className="mr-1.5 h-4 w-4" /> Measure
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetMode}>
                    <X className="mr-1.5 h-4 w-4" /> Reset
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  {mode === "view" && "Orbit, zoom, pan. Click tags or lines to inspect."}
                  {mode === "tag" && "Click the model surface to place a room tag."}
                  {mode === "measure" && "Click two points on the model to measure distance."}
                </div>

                {/* Current measure progress */}
                {mode === "measure" && measurePoints.length > 0 && (
                  <div className="rounded bg-muted px-3 py-1.5 text-xs">
                    Point {measurePoints.length + 1} of 2 selected. Click the second point.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Annotations list */}
          {selectedModel && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Tags ({annotations.length})</span>
                  {annotations.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExportData}
                        className="h-6 px-2 text-xs"
                      >
                        Export
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={syncTagsToEstimate}
                        className="h-6 px-2 text-xs"
                      >
                        Sync to Estimate
                      </Button>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-auto p-0">
                {annotations.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No tags yet. Use Tag Room mode.
                  </div>
                ) : (
                  <div className="divide-y text-sm">
                    {annotations.map((ann) => {
                      const label = ann.label || "Untitled";
                      const room = ann.notes as string | undefined;
                      return (
                        <div key={ann.id} className="flex items-center justify-between px-4 py-2">
                          <div className="truncate pr-2">
                            {label}{" "}
                            {room && <span className="text-muted-foreground">({room})</span>}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteAnnotationMutation.mutate(ann.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Measurements list */}
          {selectedModel && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Measurements ({measurements.length})</CardTitle>
              </CardHeader>
              <CardContent className="max-h-48 overflow-auto p-0">
                {measurements.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No measurements.</div>
                ) : (
                  <div className="divide-y text-sm">
                    {measurements.map((m) => {
                      const val = m.value;
                      const unit = m.unit || "m";
                      return (
                        <div key={m.id} className="flex items-center justify-between px-4 py-2">
                          <div>
                            {val} {unit}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteMeasurementMutation.mutate(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 3D Canvas Area */}
        <div className="lg:col-span-9 min-h-[520px] rounded-lg border bg-black/5 overflow-hidden">
          {!selectedModel ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Eye className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="font-semibold">No model selected</h4>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                  Upload a GLB/GLTF model using the panel on the left, or select an existing one.
                </p>
              </div>
            </div>
          ) : (
            <FloorplanScene
              model={selectedModel}
              annotations={annotations}
              measurements={measurements}
              mode={mode}
              onAddTagPoint={handleAddTagPoint}
              onMeasurePoint={handleMeasurePoint}
              onCanvasReady={handleCanvasReady}
              estimateRooms={estimateRooms}
            />
          )}
        </div>
      </div>

      {/* Tag Dialog (appears after clicking surface in tag mode) */}
      <Dialog open={!!pendingTag} onOpenChange={(open) => !open && handleCancelPendingTag()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag Room</DialogTitle>
            <DialogDescription>
              Give this location a name and optionally link it to an estimate room.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Room / Location Name</label>
              <Input
                value={tagLabel}
                onChange={(e) => setTagLabel(e.target.value)}
                placeholder="e.g. Kitchen, Master Bedroom"
                className="mt-1"
                autoFocus
              />
            </div>

            {estimateRooms.length > 0 && (
              <div>
                <label className="text-sm font-medium">Link to Estimate Room (optional)</label>
                <Select value={linkedRoomId} onValueChange={setLinkedRoomId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a room from estimate..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {estimateRooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} {room.area_sqm ? `(${room.area_sqm} m²)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelPendingTag}>
              Cancel
            </Button>
            <Button onClick={handleSavePendingTag} disabled={!tagLabel.trim()}>
              Save Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
