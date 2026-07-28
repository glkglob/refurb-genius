/**
 * AO-1H2 — pure mapFloorplanAnnotationsToEstimateRooms contract.
 */
import { describe, it, expect, vi } from "vitest";
import { mapFloorplanAnnotationsToEstimateRooms } from "./mapFloorplanAnnotationsToEstimateRooms";

describe("mapFloorplanAnnotationsToEstimateRooms", () => {
  it("maps unique labels to exact room shape with ID formula", () => {
    const now = vi.fn(() => 1_700_000_000_000);
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "Kitchen" }, { label: "Bath" }],
      [],
      now,
    );

    expect(result.uniqueLabels).toEqual(["Kitchen", "Bath"]);
    expect(result.newRooms).toEqual([
      { id: "fp-1700000000000-Kitchen", name: "Kitchen", items: [] },
      { id: "fp-1700000000000-Bath", name: "Bath", items: [] },
    ]);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it("removes duplicate exact labels and preserves first-seen order", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "Kitchen" }, { label: "Bath" }, { label: "Kitchen" }, { label: "Hall" }],
      [],
      () => 1,
    );

    expect(result.uniqueLabels).toEqual(["Kitchen", "Bath", "Hall"]);
    expect(result.newRooms.map((r) => r.name)).toEqual(["Kitchen", "Bath", "Hall"]);
  });

  it("preserves case-sensitive variants as distinct labels", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "Kitchen" }, { label: "kitchen" }],
      [],
      () => 1,
    );

    expect(result.uniqueLabels).toEqual(["Kitchen", "kitchen"]);
    expect(result.newRooms).toHaveLength(2);
  });

  it("removes null, undefined, non-string, and empty labels", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [
        { label: "Kitchen" },
        { label: null },
        { label: undefined },
        { label: 42 as unknown as string },
        { label: "" },
        {},
      ],
      [],
      () => 1,
    );

    expect(result.uniqueLabels).toEqual(["Kitchen"]);
    expect(result.newRooms).toHaveLength(1);
  });

  it("retains whitespace-only labels and does not trim", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "  " }, { label: " Kitchen " }],
      [],
      () => 9,
    );

    expect(result.uniqueLabels).toEqual(["  ", " Kitchen "]);
    expect(result.newRooms[0]).toEqual({
      id: "fp-9-  ",
      name: "  ",
      items: [],
    });
    expect(result.newRooms[1].name).toBe(" Kitchen ");
  });

  it("excludes exact existing room names only", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "Kitchen" }, { label: "Bath" }, { label: "Hall" }],
      [{ name: "Bath" }, { name: "Kitchen" }],
      () => 1,
    );

    expect(result.uniqueLabels).toEqual(["Kitchen", "Bath", "Hall"]);
    expect(result.newRooms.map((r) => r.name)).toEqual(["Hall"]);
  });

  it("treats case-different existing names as new rooms", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "Kitchen" }],
      [{ name: "kitchen" }],
      () => 1,
    );

    expect(result.newRooms).toHaveLength(1);
    expect(result.newRooms[0].name).toBe("Kitchen");
  });

  it("handles empty annotations and empty existing rooms", () => {
    expect(mapFloorplanAnnotationsToEstimateRooms([], [], () => 1)).toEqual({
      uniqueLabels: [],
      newRooms: [],
    });
    expect(mapFloorplanAnnotationsToEstimateRooms([{ label: "A" }], [], () => 2)).toEqual({
      uniqueLabels: ["A"],
      newRooms: [{ id: "fp-2-A", name: "A", items: [] }],
    });
  });

  it("invokes now once per created room (not once per unique label filtered out)", () => {
    const now = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(20);
    const result = mapFloorplanAnnotationsToEstimateRooms(
      [{ label: "A" }, { label: "B" }, { label: "C" }],
      [{ name: "B" }],
      now,
    );

    expect(result.newRooms.map((r) => r.id)).toEqual(["fp-10-A", "fp-20-C"]);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it("returns items: [] and no extra room fields", () => {
    const result = mapFloorplanAnnotationsToEstimateRooms([{ label: "X" }], [], () => 1);
    expect(result.newRooms[0]).toEqual({ id: "fp-1-X", name: "X", items: [] });
    expect(Object.keys(result.newRooms[0]).sort()).toEqual(["id", "items", "name"]);
  });

  it("does not mutate annotation or existing-room inputs", () => {
    const annotations = [{ label: "Kitchen" }, { label: "Bath" }];
    const existing = [{ name: "Kitchen" }];
    const annSnap = structuredClone(annotations);
    const existSnap = structuredClone(existing);

    mapFloorplanAnnotationsToEstimateRooms(annotations, existing, () => 1);

    expect(annotations).toEqual(annSnap);
    expect(existing).toEqual(existSnap);
  });
});
