/**
 * P1B3 — annotation data parser/serializer and row mapper.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  parseFloorplanAnnotationData,
  parseFloorplanPosition,
  serializeFloorplanAnnotationData,
  mapFloorplanAnnotationRow,
} from "./floorplan-annotation";
import { isFloorplanJsonCompatible } from "./floorplan-json";

describe("parseFloorplanPosition", () => {
  it("parses valid array and object", () => {
    expect(parseFloorplanPosition([1, 2, 3])).toEqual([1, 2, 3]);
    expect(parseFloorplanPosition({ x: 1, y: 2, z: 3 })).toEqual([1, 2, 3]);
  });

  it("rejects invalid coordinates", () => {
    expect(parseFloorplanPosition([1, 2])).toBeNull();
    expect(parseFloorplanPosition([1, NaN, 3])).toBeNull();
    expect(parseFloorplanPosition([1, Infinity, 3])).toBeNull();
    expect(parseFloorplanPosition("nope")).toBeNull();
    expect(parseFloorplanPosition(null)).toBeNull();
    expect(parseFloorplanPosition({ x: 1, y: "2", z: 3 })).toBeNull();
  });
});

describe("parseFloorplanAnnotationData", () => {
  it("parses complete valid data", () => {
    expect(
      parseFloorplanAnnotationData({
        label: "Kitchen",
        position: [1, 2, 3],
        notes: "Kitchen Room",
        room_id: "room-1",
      }),
    ).toEqual({
      label: "Kitchen",
      position: [1, 2, 3],
      notes: "Kitchen Room",
      roomId: "room-1",
    });
  });

  it("handles empty object, null, non-object", () => {
    expect(parseFloorplanAnnotationData({})).toEqual({ label: "", position: [0, 0, 0] });
    expect(parseFloorplanAnnotationData(null)).toEqual({ label: "", position: [0, 0, 0] });
    expect(parseFloorplanAnnotationData("x")).toEqual({ label: "", position: [0, 0, 0] });
    expect(parseFloorplanAnnotationData(42)).toEqual({ label: "", position: [0, 0, 0] });
    expect(parseFloorplanAnnotationData([])).toEqual({ label: "", position: [0, 0, 0] });
  });

  it("handles missing keys and invalid position", () => {
    expect(parseFloorplanAnnotationData({ label: "A" })).toEqual({
      label: "A",
      position: [0, 0, 0],
    });
    expect(parseFloorplanAnnotationData({ position: [1, NaN, 3] }).position).toEqual([0, 0, 0]);
  });

  it("supports roomId camelCase legacy alias", () => {
    expect(parseFloorplanAnnotationData({ roomId: "r2" }).roomId).toBe("r2");
  });

  it("ignores unsupported nested junk without fabricating", () => {
    const parsed = parseFloorplanAnnotationData({
      label: "L",
      position: [0, 0, 0],
      geometry: { foo: 1 },
      style: "red",
    });
    expect(parsed).toEqual({ label: "L", position: [0, 0, 0] });
    expect(parsed).not.toHaveProperty("geometry");
    expect(parsed).not.toHaveProperty("style");
  });
});

describe("serializeFloorplanAnnotationData", () => {
  it("serializes complete content and omits empty optionals", () => {
    const json = serializeFloorplanAnnotationData({
      label: "Kitchen",
      position: { x: 1, y: 2, z: 3 },
      notes: "Kitchen Room",
      roomId: "room-1",
    });
    expect(json).toEqual({
      label: "Kitchen",
      position: [1, 2, 3],
      notes: "Kitchen Room",
      room_id: "room-1",
    });
    expect(isFloorplanJsonCompatible(json)).toBe(true);
    expect(JSON.stringify(json)).not.toContain("undefined");
  });

  it("omits null/empty notes and roomId", () => {
    const json = serializeFloorplanAnnotationData({
      label: "Tag",
      position: [0, 0, 0],
      notes: null,
      roomId: null,
    });
    expect(json).toEqual({ label: "Tag", position: [0, 0, 0] });
    expect(Object.keys(json as object).sort()).toEqual(["label", "position"]);
  });

  it("does not use JSON.parse/JSON.stringify conversion", () => {
    const src = readFileSync(join(__dirname, "floorplan-annotation.ts"), "utf8");
    expect(src).not.toMatch(/JSON\.parse\s*\(\s*JSON\.stringify/);
  });
});

describe("mapFloorplanAnnotationRow", () => {
  it("maps canonical data blob", () => {
    const ann = mapFloorplanAnnotationRow({
      id: "a1",
      model_id: "m1",
      annotation_type: "room_tag",
      data: {
        label: "Kitchen",
        position: [1, 2, 3],
        notes: "Kitchen Room",
        room_id: "room-1",
      },
      created_at: "c",
      updated_at: "u",
    });
    expect(ann).toMatchObject({
      id: "a1",
      modelId: "m1",
      annotationType: "room_tag",
      label: "Kitchen",
      position: [1, 2, 3],
      notes: "Kitchen Room",
      roomId: "room-1",
    });
  });

  it("falls back to historical flat columns", () => {
    const ann = mapFloorplanAnnotationRow({
      id: "a2",
      model_id: "m1",
      label: "Bath",
      position: [4, 5, 6],
      notes: "Bath Room",
      room_id: "r-b",
      project_id: "p",
      created_by: "u",
      created_at: "c",
      updated_at: "u",
    });
    expect(ann.label).toBe("Bath");
    expect(ann.position).toEqual([4, 5, 6]);
    expect(ann.notes).toBe("Bath Room");
    expect(ann.roomId).toBe("r-b");
  });

  it("defaults missing label to Tag", () => {
    expect(mapFloorplanAnnotationRow({ id: "x", data: {} }).label).toBe("Tag");
  });
});
