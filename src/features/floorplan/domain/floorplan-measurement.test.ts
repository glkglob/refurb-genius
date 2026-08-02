/**
 * P1B3 — measurement domain mapping.
 */
import { describe, it, expect } from "vitest";
import {
  mapFloorplanMeasurementRow,
  parseFloorplanMeasurementValue,
  FLOORPLAN_MEASUREMENT_TYPE_DISTANCE,
  FLOORPLAN_MEASUREMENT_UNIT_DEFAULT,
} from "./floorplan-measurement";

describe("parseFloorplanMeasurementValue", () => {
  it("accepts finite numbers including zero", () => {
    expect(parseFloorplanMeasurementValue(0)).toBe(0);
    expect(parseFloorplanMeasurementValue(3.14)).toBe(3.14);
    expect(parseFloorplanMeasurementValue(-1)).toBe(-1);
  });

  it("rejects non-finite and non-numbers without string coercion", () => {
    expect(parseFloorplanMeasurementValue(NaN)).toBe(0);
    expect(parseFloorplanMeasurementValue(Infinity)).toBe(0);
    expect(parseFloorplanMeasurementValue("3")).toBe(0);
    expect(parseFloorplanMeasurementValue(null)).toBe(0);
    expect(parseFloorplanMeasurementValue(undefined)).toBe(0);
  });
});

describe("mapFloorplanMeasurementRow", () => {
  it("maps valid type/value/unit", () => {
    expect(
      mapFloorplanMeasurementRow({
        id: "meas-1",
        model_id: "m1",
        measurement_type: "distance",
        value: 3.142,
        unit: "m",
        created_at: "c",
        updated_at: "u",
      }),
    ).toEqual({
      id: "meas-1",
      modelId: "m1",
      measurementType: "distance",
      value: 3.142,
      unit: "m",
      createdAt: "c",
      updatedAt: "u",
    });
  });

  it("defaults missing unit and type; zero value preserved", () => {
    const m = mapFloorplanMeasurementRow({
      id: "m",
      model_id: "mod",
      value: 0,
    });
    expect(m.value).toBe(0);
    expect(m.unit).toBe(FLOORPLAN_MEASUREMENT_UNIT_DEFAULT);
    expect(m.measurementType).toBe(FLOORPLAN_MEASUREMENT_TYPE_DISTANCE);
  });

  it("does not expose obsolete points/project_id/created_by", () => {
    const m = mapFloorplanMeasurementRow({
      id: "m",
      model_id: "mod",
      measurement_type: "distance",
      value: 1,
      unit: "m",
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      project_id: "p",
      created_by: "u",
    });
    expect(m).not.toHaveProperty("points");
    expect(m).not.toHaveProperty("project_id");
    expect(m).not.toHaveProperty("created_by");
  });

  it("handles malformed value fallback", () => {
    expect(mapFloorplanMeasurementRow({ id: "x", value: "bad" }).value).toBe(0);
  });
});
