import { useCallback, useMemo, useRef, useState } from "react";
import { Sparkles, Trash2, Plus, Save, Loader2, ChevronDown } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { formatGBP } from "@/core/pricing";
import {
  getRegionalMultiplier,
  calculateLineItem,
  calculateEstimateTotals,
  type CalculatedLineItem,
} from "@/core/pricing";
import type { AIGeneratedRoom } from "@/features/estimate";
import type { ScopeRoom } from "@/core/ai/server/openAiScopeAnalysis.server";
import { useGenerateEstimate, useSaveAIEstimate } from "@/features/estimate";
import type { UKRegion } from "@/core/projects";
import { UK_REGIONS } from "@/core/constants";
import { normalizeAIEstimate, type NormalizedEstimateResult } from "@/core/ai";
import type { ConditionLevel } from "@/core/ai";
import { runScopeThenEstimate } from "@/core/ai/platform/orchestrator";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type LocalItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  base_unit_cost: number;
  notes?: string;
  is_ai_suggested: boolean;
};

type LocalRoom = {
  id: string;
  name: string;
  area_sqm?: number;
  items: LocalItem[];
};

// ──────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────

export interface AIEstimateBuilderProps {
  projectId: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  initialRegion: UKRegion;
  postcode?: string;
  /** Pre-fill from a scope analysis result. Converted to editable rooms on mount. */
  initialScopeRooms?: ScopeRoom[];
  onSaved?: (estimateId: string) => void;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

let nextId = 0;
function uid() {
  return `local-${Date.now()}-${nextId++}`;
}

function aiRoomsToLocal(rooms: AIGeneratedRoom[]): LocalRoom[] {
  return rooms.map((room, idx) => ({
    id: uid(),
    name: room.name,
    area_sqm: room.area_sqm,
    items: room.items.map((item) => ({
      id: uid(),
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      base_unit_cost: item.base_unit_cost,
      notes: item.notes,
      is_ai_suggested: true,
    })),
  }));
}

function scopeRoomsToLocal(rooms: ScopeRoom[]): LocalRoom[] {
  return rooms.map((room) => ({
    id: uid(),
    name: room.room,
    area_sqm: room.area_sqm,
    items: room.recommended_items.map((item) => ({
      id: uid(),
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      base_unit_cost: item.base_unit_cost,
      notes: item.notes,
      is_ai_suggested: true,
    })),
  }));
}

const CATEGORY_LABELS: Record<string, string> = {
  materials: "Materials",
  labour: "Labour",
  both: "Materials + Labour",
  fees: "Fees",
};

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export function AIEstimateBuilder({
  projectId,
  propertyType,
  bedrooms,
  bathrooms,
  sizeSqm,
  initialRegion,
  postcode,
  initialScopeRooms,
  onSaved,
}: AIEstimateBuilderProps) {
  // Pre-fill from scope analysis if provided, otherwise start empty.
  // Lazy ref so scopeRoomsToLocal (which calls uid()) runs exactly once.
  const initialLocalRef = useRef<LocalRoom[] | undefined>(undefined);
  if (initialLocalRef.current === undefined) {
    initialLocalRef.current = initialScopeRooms?.length ? scopeRoomsToLocal(initialScopeRooms) : [];
  }
  const [region, setRegion] = useState<UKRegion>(initialRegion);
  const [condition, setCondition] = useState("Dated, needs full modernisation");
  const [requirements, setRequirements] = useState("");
  const [rooms, setRooms] = useState<LocalRoom[]>(initialLocalRef.current);
  const [openRooms, setOpenRooms] = useState<Set<string>>(
    () => new Set(initialLocalRef.current!.map((r) => r.id)),
  );
  const [notes, setNotes] = useState("");
  const [lastNormalized, setLastNormalized] = useState<NormalizedEstimateResult | null>(null);

  const generate = useGenerateEstimate();
  const save = useSaveAIEstimate();
  const multiplier = getRegionalMultiplier(region);

  // Calculate all items with regional adjustment
  const allCalcItems: CalculatedLineItem[] = useMemo(
    () => rooms.flatMap((room) => room.items.map((item) => calculateLineItem(item, multiplier))),
    [rooms, multiplier],
  );

  const totals = useMemo(() => calculateEstimateTotals(allCalcItems), [allCalcItems]);

  // Room subtotals
  const roomSubtotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const room of rooms) {
      const sub = room.items.reduce((s, item) => {
        const calc = calculateLineItem(item, multiplier);
        return s + calc.total_cost;
      }, 0);
      map.set(room.id, sub);
    }
    return map;
  }, [rooms, multiplier]);

  // ────────────── AI generation ──────────────

  const handleGenerate = useCallback(() => {
    const baseReq = requirements || "Standard good quality modern refurb";

    // If we have initial scope context, use the orchestrator for richer, more accurate AI output
    // (vision/scope context → better seeded estimate prompt). Falls back gracefully.
    if (initialScopeRooms && initialScopeRooms.length > 0) {
      (async () => {
        try {
          const aiRooms = await runScopeThenEstimate(
            { rooms: initialScopeRooms, overall_score: 5, summary: "" },
            { propertyType, bedrooms, bathrooms, region, condition, sizeSqm: sizeSqm || undefined },
            "balanced",
          );
          if (aiRooms && aiRooms.length > 0) {
            const local = aiRoomsToLocal(aiRooms);
            setRooms(local);
            setOpenRooms(new Set(local.map((r) => r.id)));
            try {
              const norm = normalizeAIEstimate({
                aiRooms,
                region,
                condition: [
                  "Modern",
                  "Average",
                  "Dated",
                  "Poor",
                  "Full Renovation Needed",
                ].includes(condition)
                  ? (condition as ConditionLevel)
                  : "Dated",
                sizeSqm: sizeSqm || undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                scope: { rooms: initialScopeRooms } as unknown as any,
              });
              setLastNormalized(norm);
              if (norm.warnings.length)
                toast.info(`AI (orchestrated from scope): ${norm.warnings[0]}`);
            } catch {
              setLastNormalized(null);
            }
            toast.success(`Generated ${aiRooms.length} rooms (scope-informed)`);
            return;
          }
        } catch {
          /* orchestration failed (e.g. no prior vision); fall back to direct estimate */
        }
        // fallback to direct
        generate.mutate(
          {
            propertyType,
            bedrooms,
            bathrooms,
            region,
            postcode,
            condition,
            requirements: baseReq,
            sizeSqm: sizeSqm || undefined,
          },
          { onSuccess: standardOnSuccess },
        );
      })();
      return;
    }

    generate.mutate(
      {
        propertyType,
        bedrooms,
        bathrooms,
        region,
        postcode,
        condition,
        requirements: baseReq,
        sizeSqm: sizeSqm || undefined,
      },
      { onSuccess: standardOnSuccess },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    generate,
    propertyType,
    bedrooms,
    bathrooms,
    region,
    postcode,
    condition,
    requirements,
    sizeSqm,
    initialScopeRooms,
  ]);

  const standardOnSuccess = (aiRooms: AIGeneratedRoom[]) => {
    const local = aiRoomsToLocal(aiRooms);
    setRooms(local);
    setOpenRooms(new Set(local.map((r) => r.id)));
    try {
      const norm = normalizeAIEstimate({
        aiRooms,
        region,
        condition: ["Modern", "Average", "Dated", "Poor", "Full Renovation Needed"].includes(
          condition,
        )
          ? (condition as ConditionLevel)
          : "Dated",
        sizeSqm: sizeSqm || undefined,
      });
      setLastNormalized(norm);
      if (norm.warnings.length) {
        toast.info(`AI estimate normalized: ${norm.warnings[0]}`);
      }
    } catch {
      setLastNormalized(null);
    }
    toast.success(
      `Generated ${aiRooms.length} rooms with ${aiRooms.reduce((s, r) => s + r.items.length, 0)} line items`,
    );
  };

  // ────────────── Save ──────────────

  const handleSave = useCallback(() => {
    if (rooms.length === 0) {
      toast.error("Generate or add rooms first");
      return;
    }

    save.mutate(
      {
        projectId,
        title: `AI Estimate — ${propertyType}, ${bedrooms} bed`,
        region,
        rooms: rooms.map((room) => ({
          name: room.name,
          area_sqm: room.area_sqm,
          items: room.items.map((item) => calculateLineItem(item, multiplier)),
        })),
        subtotal: totals.subtotal,
        vat_rate: 20,
        vat_amount: totals.vat_amount,
        total: totals.total,
        notes: notes || undefined,
      },
      {
        onSuccess: (result) => {
          toast.success("Estimate saved");
          onSaved?.(result.estimate.id);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to save estimate");
        },
      },
    );
  }, [rooms, save, projectId, propertyType, bedrooms, region, multiplier, totals, notes, onSaved]);

  // ────────────── Room CRUD ──────────────

  function toggleRoom(roomId: string) {
    setOpenRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  function addRoom() {
    const room: LocalRoom = {
      id: uid(),
      name: "New Room",
      items: [],
    };
    setRooms((prev) => [...prev, room]);
    setOpenRooms((prev) => new Set(prev).add(room.id));
  }

  function deleteRoom(roomId: string) {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  }

  function updateRoomName(roomId: string, name: string) {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, name } : r)));
  }

  // ────────────── Item CRUD ──────────────

  function addItem(roomId: string) {
    const item: LocalItem = {
      id: uid(),
      name: "",
      category: "both",
      quantity: 1,
      unit: "item",
      base_unit_cost: 0,
      is_ai_suggested: false,
    };
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, items: [...r.items, item] } : r)),
    );
  }

  function deleteItem(roomId: string, itemId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r,
      ),
    );
  }

  function updateItem(roomId: string, itemId: string, patch: Partial<LocalItem>) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              items: r.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            }
          : r,
      ),
    );
  }

  // ────────────── Render ──────────────

  const percentDiff =
    multiplier >= 1
      ? `+${((multiplier - 1) * 100).toFixed(0)}%`
      : `${((multiplier - 1) * 100).toFixed(0)}%`;

  return (
    <div className="space-y-6">
      {/* AI generation controls */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={(v) => setRegion(v as UKRegion)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UK_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Property condition</Label>
              <Input
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="e.g. Dated kitchen, old electrics"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Specific requirements</Label>
            <Textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="e.g. New kitchen, 2 bathrooms, full rewire, flooring throughout"
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Prices adjusted for <span className="font-medium text-foreground">{region}</span> (
              {percentDiff} vs East Midlands base)
            </p>
            <Button onClick={handleGenerate} disabled={generate.isPending} size="lg">
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Phase 2: AI normalization feedback (pricing authority alignment) */}
      {lastNormalized && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="p-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium text-foreground">
                AI estimate normalized to pricing authority
              </span>
              <span>
                AI suggested total: <strong>{formatGBP(lastNormalized.totalAiSuggested)}</strong>
              </span>
              <span>
                Authority-aligned: <strong>{formatGBP(lastNormalized.totalNormalized)}</strong>
              </span>
              <span className="text-xs text-muted-foreground">
                Risk uplift {(lastNormalized.riskMultiplier * 100).toFixed(0)}%
              </span>
            </div>
            {lastNormalized.warnings.length > 0 && (
              <p className="mt-2 text-xs text-amber-600">{lastNormalized.warnings.join(" ")}</p>
            )}
            {lastNormalized.notes.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {lastNormalized.notes.join(" ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rooms + items (accordion) */}
      {rooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 opacity-40" />
            <p>
              Click &ldquo;Generate with AI&rdquo; or add rooms manually to start your estimate.
            </p>
            <Button variant="outline" size="sm" onClick={addRoom}>
              <Plus className="mr-1 h-4 w-4" /> Add room manually
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => {
            const isOpen = openRooms.has(room.id);
            const roomTotal = roomSubtotals.get(room.id) ?? 0;

            return (
              <Collapsible key={room.id} open={isOpen} onOpenChange={() => toggleRoom(room.id)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between border-b border-border px-5 py-3 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                        />
                        <span className="font-medium text-foreground">{room.name}</span>
                        {room.area_sqm && (
                          <Badge variant="secondary" className="text-xs">
                            {room.area_sqm} m²
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {room.items.length} items
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatGBP(roomTotal)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRoom(room.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="space-y-3 p-5">
                      {/* Room name edit */}
                      <div className="flex items-center gap-3">
                        <Label className="w-24 shrink-0 text-xs text-muted-foreground">
                          Room name
                        </Label>
                        <Input
                          value={room.name}
                          onChange={(e) => updateRoomName(room.id, e.target.value)}
                          className="max-w-xs"
                        />
                      </div>

                      {/* Items table */}
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Item</th>
                              <th className="px-3 py-2 text-left font-medium">Category</th>
                              <th className="px-3 py-2 text-right font-medium">Qty</th>
                              <th className="px-3 py-2 text-left font-medium">Unit</th>
                              <th className="px-3 py-2 text-right font-medium">Base cost</th>
                              <th className="px-3 py-2 text-right font-medium">Adj. cost</th>
                              <th className="px-3 py-2 text-right font-medium">Total</th>
                              <th className="px-3 py-2 w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {room.items.map((item) => {
                              const calc = calculateLineItem(item, multiplier);
                              return (
                                <tr key={item.id} className="border-b last:border-0">
                                  <td className="px-3 py-2">
                                    <Input
                                      value={item.name}
                                      onChange={(e) =>
                                        updateItem(room.id, item.id, { name: e.target.value })
                                      }
                                      className="h-8 min-w-[160px]"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Select
                                      value={item.category}
                                      onValueChange={(v) =>
                                        updateItem(room.id, item.id, { category: v })
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-[130px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                          <SelectItem key={k} value={k}>
                                            {v}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.1}
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateItem(room.id, item.id, {
                                          quantity: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="h-8 w-20 text-right"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      value={item.unit}
                                      onChange={(e) =>
                                        updateItem(room.id, item.id, { unit: e.target.value })
                                      }
                                      className="h-8 w-16"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                    {formatGBP(item.base_unit_cost)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {formatGBP(calc.unit_cost)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                    {formatGBP(calc.total_cost)}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => deleteItem(room.id, item.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <Button variant="outline" size="sm" onClick={() => addItem(room.id)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add line item
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

          <Button variant="outline" onClick={addRoom} className="w-full">
            <Plus className="mr-1 h-4 w-4" /> Add room
          </Button>
        </div>
      )}

      {/* Totals + save */}
      {rooms.length > 0 && (
        <>
          <Card className="bg-muted/30">
            <CardContent className="space-y-2 p-6 text-right">
              <div className="text-sm text-muted-foreground">
                Subtotal:{" "}
                <span className="font-mono font-medium text-foreground">
                  {formatGBP(totals.subtotal)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                VAT (20%):{" "}
                <span className="font-mono font-medium text-foreground">
                  {formatGBP(totals.vat_amount)}
                </span>
              </div>
              <div className="border-t pt-2 text-xl font-semibold text-foreground">
                Total: {formatGBP(totals.total)}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this estimate…"
                rows={2}
              />
            </div>
            <div className="flex justify-end">
              <Button size="lg" onClick={handleSave} disabled={save.isPending}>
                {save.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save estimate
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
