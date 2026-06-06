"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical, Save, Download, Edit2, X } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Badge,
} from "@repo/ui";
import { toast } from "sonner";
import { formatGBP } from "@/core/pricing";
import { ESTIMATE_CATEGORIES } from "@/core/constants";
import {
  saveAIEstimate,
  getLatestRoomEstimate,
  type SaveAIEstimateInput,
  type PersistedRoomEstimate,
} from "@/lib/estimates";
import { logger } from "@/lib/logger";
import type { ProjectWithProgress } from "@/lib/mappers";
import { estimateQueryOptions, projectKeys } from "@/lib/queries/projects";

type BuilderItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  notes?: string;
};

type BuilderRoom = {
  id: string;
  name: string;
  area_sqm?: number;
  items: BuilderItem[];
};

interface EstimateBuilderProps {
  projectId: string;
  project: ProjectWithProgress;
  onSaved?: () => void;
}

const DEFAULT_ITEM: Omit<BuilderItem, "id"> = {
  name: "",
  category: "Kitchen",
  quantity: 1,
  unit: "item",
  unit_cost: 0,
  notes: "",
};

export function EstimateBuilder({ projectId, project, onSaved }: EstimateBuilderProps) {
  const queryClient = useQueryClient();

  // Hydrate from centralized query (populated by route loader)
  const savedEstimate = queryClient.getQueryData<PersistedRoomEstimate | null>(
    estimateQueryOptions(projectId).queryKey,
  );

  const [rooms, setRooms] = useState<BuilderRoom[]>(() => {
    try {
      const draft = localStorage.getItem(`estimate-draft:${projectId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}

    if (savedEstimate?.rooms?.length) {
      return savedEstimate.rooms.map((r: any, idx: number) => ({
        id: crypto.randomUUID(),
        name: r.name || `Room ${idx + 1}`,
        area_sqm: r.area_sqm,
        items: (r.items || []).map((it: any) => ({
          id: crypto.randomUUID(),
          name: it.name,
          category: it.category || "Kitchen",
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "item",
          unit_cost: Number(it.base_unit_cost ?? it.unit_cost) || 0,
          notes: it.notes,
        })),
      }));
    }

    return [
      {
        id: crypto.randomUUID(),
        name: "Kitchen",
        area_sqm: 12,
        items: [
          {
            id: crypto.randomUUID(),
            name: "New kitchen cabinets",
            category: "Kitchen",
            quantity: 1,
            unit: "set",
            unit_cost: 4500,
          },
        ],
      },
    ];
  });

  const [isExporting, setIsExporting] = useState(false);

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomEdit, setRoomEdit] = useState({ name: "", area_sqm: "" });

  const [addingToRoomId, setAddingToRoomId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState(DEFAULT_ITEM);

  // Real-time calculations (production ready, uses simple but accurate math + can be extended with pricing engine)
  const calculations = useMemo(() => {
    let grandSubtotal = 0;
    let totalItems = 0;

    const roomTotals = rooms.map((room) => {
      const roomSubtotal = room.items.reduce((sum, item) => {
        return sum + item.quantity * item.unit_cost;
      }, 0);

      grandSubtotal += roomSubtotal;
      totalItems += room.items.length;

      return {
        ...room,
        subtotal: roomSubtotal,
      };
    });

    // Simple VAT/contingency model (can be replaced by full pricing engine)
    const contingency = Math.round(grandSubtotal * 0.1);
    const vat = Math.round((grandSubtotal + contingency) * 0.2);
    const total = grandSubtotal + contingency + vat;

    return {
      rooms: roomTotals,
      subtotal: grandSubtotal,
      contingency,
      vat,
      total,
      totalItems,
      timelineWeeks: Math.max(4, Math.ceil(rooms.length * 1.5 + totalItems * 0.2)),
    };
  }, [rooms]);

  // --- Drag and Drop (native HTML5 - no extra deps, production reliable) ---
  const handleDragStart = (e: React.DragEvent, roomId: string, itemId?: string) => {
    if (itemId) {
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "item", roomId, itemId }));
    } else {
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "room", roomId }));
    }
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetRoomId: string, targetItemId?: string) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));

    if (data.type === "room") {
      reorderRooms(data.roomId, targetRoomId);
    } else if (data.type === "item") {
      reorderItems(data.roomId, data.itemId, targetRoomId, targetItemId);
    }
  };

  const reorderRooms = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setRooms((prev) => {
      const newRooms = [...prev];
      const sourceIndex = newRooms.findIndex((r) => r.id === sourceId);
      const targetIndex = newRooms.findIndex((r) => r.id === targetId);

      const [moved] = newRooms.splice(sourceIndex, 1);
      newRooms.splice(targetIndex, 0, moved);

      return newRooms;
    });
  };

  const reorderItems = (
    sourceRoomId: string,
    sourceItemId: string,
    targetRoomId: string,
    targetItemId?: string,
  ) => {
    setRooms((prev) => {
      const newRooms = prev.map((room) => ({ ...room, items: [...room.items] }));

      const sourceRoom = newRooms.find((r) => r.id === sourceRoomId)!;
      const sourceIdx = sourceRoom.items.findIndex((i) => i.id === sourceItemId);
      const [movedItem] = sourceRoom.items.splice(sourceIdx, 1);

      const targetRoom = newRooms.find((r) => r.id === targetRoomId)!;

      if (targetItemId) {
        const targetIdx = targetRoom.items.findIndex((i) => i.id === targetItemId);
        targetRoom.items.splice(targetIdx, 0, movedItem);
      } else {
        targetRoom.items.push(movedItem);
      }

      return newRooms;
    });
  };

  // --- Room & Item mutations ---
  const addRoom = () => {
    const newRoom: BuilderRoom = {
      id: crypto.randomUUID(),
      name: `Room ${rooms.length + 1}`,
      area_sqm: 10,
      items: [],
    };
    setRooms((prev) => [...prev, newRoom]);
    setEditingRoomId(newRoom.id);
    setRoomEdit({ name: newRoom.name, area_sqm: String(newRoom.area_sqm) });
  };

  const openEditRoom = (room: BuilderRoom) => {
    setEditingRoomId(room.id);
    setRoomEdit({
      name: room.name,
      area_sqm: room.area_sqm ? String(room.area_sqm) : "",
    });
  };

  const saveRoomEdit = () => {
    if (!editingRoomId) return;

    setRooms((prev) =>
      prev.map((room) =>
        room.id === editingRoomId
          ? {
              ...room,
              name: roomEdit.name.trim() || "Unnamed Room",
              area_sqm: roomEdit.area_sqm ? parseFloat(roomEdit.area_sqm) : undefined,
            }
          : room,
      ),
    );
    setEditingRoomId(null);
  };

  const deleteRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const openAddItem = (roomId: string) => {
    setAddingToRoomId(roomId);
    setNewItem({ ...DEFAULT_ITEM });
  };

  const addItem = () => {
    if (!addingToRoomId || !newItem.name.trim()) return;

    const item: BuilderItem = {
      id: crypto.randomUUID(),
      ...newItem,
      name: newItem.name.trim(),
    };

    setRooms((prev) =>
      prev.map((room) =>
        room.id === addingToRoomId ? { ...room, items: [...room.items, item] } : room,
      ),
    );

    setAddingToRoomId(null);
    setNewItem(DEFAULT_ITEM);
  };

  const updateItem = (roomId: string, itemId: string, updates: Partial<BuilderItem>) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId
          ? {
              ...room,
              items: room.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item,
              ),
            }
          : room,
      ),
    );
  };

  const deleteItem = (roomId: string, itemId: string) => {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId ? { ...room, items: room.items.filter((i) => i.id !== itemId) } : room,
      ),
    );
  };

  // --- Persistence (optimistic via TanStack mutation) ---
  const saveMutation = useMutation({
    mutationFn: (input: SaveAIEstimateInput) => saveAIEstimate(input),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: estimateQueryOptions(projectId).queryKey });
      const previous = queryClient.getQueryData(estimateQueryOptions(projectId).queryKey);
      queryClient.setQueryData(estimateQueryOptions(projectId).queryKey, {
        estimate: { mid_total: calculations.total },
        rooms: rooms.map((r) => ({
          name: r.name,
          area_sqm: r.area_sqm,
          items: r.items.map((i) => ({ ...i, base_unit_cost: i.unit_cost })),
        })),
      } as unknown as PersistedRoomEstimate | null);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(estimateQueryOptions(projectId).queryKey, ctx.previous);
      toast.error("Save failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.estimateByProject(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.financialsByProject(projectId) });
      localStorage.removeItem(`estimate-draft:${projectId}`);
      toast.success("Estimate saved");
      onSaved?.();
    },
  });

  const handleSave = () => {
    const input: SaveAIEstimateInput = {
      projectId,
      title: `${project.name || "Property"} Refurbishment Estimate`,
      region: project.region,
      rooms: rooms.map((room) => ({
        name: room.name,
        area_sqm: room.area_sqm,
        items: room.items.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          base_unit_cost: item.unit_cost,
          unit_cost: item.unit_cost,
          total_cost: item.quantity * item.unit_cost,
          notes: item.notes,
          labour: 0,
          materials: 0,
          weeks: 0,
          is_ai_suggested: false,
        })),
      })),
      subtotal: calculations.subtotal,
      vat_rate: 20,
      vat_amount: calculations.vat,
      total: calculations.total,
      notes: "Manual estimate built with drag & drop builder",
    };
    saveMutation.mutate(input);
  };

  // --- PDF Export (production ready using jsPDF + autotable) ---
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.text("Refurb Genius - Estimate", 14, 18);
      doc.setFontSize(11);
      doc.text(`Project: ${project.name || "Unnamed"}`, 14, 26);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 32);
      doc.text(`Region: ${project.region}`, 14, 38);

      // Summary box
      doc.setFontSize(12);
      doc.text("Summary", 14, 50);
      doc.setFontSize(10);
      doc.text(`Total (inc. VAT & contingency): ${formatGBP(calculations.total)}`, 14, 56);
      doc.text(`Subtotal: ${formatGBP(calculations.subtotal)}`, 14, 62);
      doc.text(`Estimated timeline: ${calculations.timelineWeeks} weeks`, 14, 68);

      let y = 80;

      // Rooms and items tables
      rooms.forEach((room, idx) => {
        const roomCalc = calculations.rooms[idx];

        doc.setFontSize(12);
        doc.text(`${room.name}${room.area_sqm ? ` (${room.area_sqm} m²)` : ""}`, 14, y);
        y += 6;

        const tableData = room.items.map((item) => [
          item.name,
          item.category,
          `${item.quantity} ${item.unit}`,
          formatGBP(item.unit_cost),
          formatGBP(item.quantity * item.unit_cost),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Item", "Category", "Qty", "Unit Cost", "Total"]],
          body: tableData,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [240, 240, 240] },
          margin: { left: 14, right: 14 },
          theme: "grid",
        });

        // @ts-expect-error - jspdf-autotable augments the instance at runtime
        y = (doc as any).lastAutoTable?.finalY + 8 ?? y + 20;

        doc.setFontSize(10);
        doc.text(`Room subtotal: ${formatGBP(roomCalc.subtotal)}`, 14, y);
        y += 10;

        if (y > 250) {
          doc.addPage();
          y = 20;
        }
      });

      // Footer totals
      doc.setFontSize(11);
      doc.text(`Grand Total: ${formatGBP(calculations.total)}`, 14, y + 8);
      doc.text("Generated by Refurb Genius • Confidential", 14, y + 18);

      doc.save(`refurb-estimate-${projectId.slice(0, 8)}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      logger.error("[EstimateBuilder] PDF export failed", { error: err });
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Estimate Builder</h3>
          <p className="text-sm text-muted-foreground">
            Drag rooms and items to reorder. Real-time totals. Save & export PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={addRoom} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Room
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || rooms.length === 0}
            size="sm"
          >
            {saveMutation.isPending ? (
              "Saving…"
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Estimate
              </>
            )}
          </Button>
          <Button
            onClick={handleExportPDF}
            disabled={isExporting || rooms.length === 0}
            variant="secondary"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Live Summary */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total</div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatGBP(calculations.total)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Subtotal</div>
            <div className="text-xl tabular-nums">{formatGBP(calculations.subtotal)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Contingency + VAT
            </div>
            <div className="text-xl tabular-nums">
              {formatGBP(calculations.contingency + calculations.vat)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Timeline</div>
            <div className="text-xl tabular-nums">{calculations.timelineWeeks} weeks</div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms */}
      <div className="space-y-4">
        {rooms.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No rooms yet. Click "Add Room" to start building your estimate.
            </CardContent>
          </Card>
        )}

        {rooms.map((room, roomIndex) => {
          const roomCalc = calculations.rooms[roomIndex];
          const isEditingThisRoom = editingRoomId === room.id;

          return (
            <Card
              key={room.id}
              className="overflow-hidden border-l-4 border-l-primary/70"
              draggable
              onDragStart={(e) => handleDragStart(e, room.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, room.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 py-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">
                      {room.name}
                      {room.area_sqm && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {room.area_sqm} m²
                        </span>
                      )}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {room.items.length} items • {formatGBP(roomCalc?.subtotal ?? 0)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => openEditRoom(room)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRoom(room.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openAddItem(room.id)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Item
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Items list - also draggable */}
                {room.items.length > 0 ? (
                  <div className="divide-y">
                    {room.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-accent/30"
                        draggable
                        onDragStart={(e) => handleDragStart(e, room.id, item.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, room.id, item.id)}
                      >
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

                        <div className="min-w-0 flex-1">
                          <input
                            className="w-full bg-transparent font-medium outline-none"
                            value={item.name}
                            onChange={(e) => updateItem(room.id, item.id, { name: e.target.value })}
                          />
                          <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                            <Select
                              value={item.category}
                              onValueChange={(v) => updateItem(room.id, item.id, { category: v })}
                            >
                              <SelectTrigger className="h-6 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ESTIMATE_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span>
                              <input
                                type="number"
                                className="w-14 bg-transparent text-right"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(room.id, item.id, {
                                    quantity: Math.max(0.1, parseFloat(e.target.value) || 1),
                                  })
                                }
                              />{" "}
                              {item.unit}
                            </span>
                            <span>
                              @{" "}
                              <input
                                type="number"
                                className="w-20 bg-transparent text-right"
                                value={item.unit_cost}
                                onChange={(e) =>
                                  updateItem(room.id, item.id, {
                                    unit_cost: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </span>
                          </div>
                        </div>

                        <div className="font-medium tabular-nums">
                          {formatGBP(item.quantity * item.unit_cost)}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteItem(room.id, item.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No items yet. Add your first line item above.
                  </div>
                )}

                <div className="flex justify-end border-t bg-muted/20 px-4 py-2 text-sm font-medium">
                  Room total: {formatGBP(roomCalc?.subtotal ?? 0)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Room Dialog */}
      <Dialog open={!!editingRoomId} onOpenChange={(open) => !open && setEditingRoomId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>Update room name and size.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="room-name">Room name</Label>
              <Input
                id="room-name"
                value={roomEdit.name}
                onChange={(e) => setRoomEdit({ ...roomEdit, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="room-area">Area (m², optional)</Label>
              <Input
                id="room-area"
                type="number"
                value={roomEdit.area_sqm}
                onChange={(e) => setRoomEdit({ ...roomEdit, area_sqm: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoomId(null)}>
              Cancel
            </Button>
            <Button onClick={saveRoomEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={!!addingToRoomId} onOpenChange={(open) => !open && setAddingToRoomId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Item description</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Replace kitchen sink and taps"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(v) => setNewItem({ ...newItem, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTIMATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      quantity: parseFloat(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit</Label>
                <Input
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                />
              </div>
              <div>
                <Label>Unit cost (£)</Label>
                <Input
                  type="number"
                  value={newItem.unit_cost}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      unit_cost: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingToRoomId(null)}>
              Cancel
            </Button>
            <Button onClick={addItem} disabled={!newItem.name.trim()}>
              Add item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-[10px] text-muted-foreground">
        Changes are local until you click Save Estimate. Drag handles allow full reordering of rooms
        and items.
      </p>
    </div>
  );
}
