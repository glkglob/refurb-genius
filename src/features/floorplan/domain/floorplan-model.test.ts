/**
 * P1B3 — floorplan model domain mapping.
 */
import { describe, it, expect } from "vitest";
import {
  mapFloorplanModelRow,
  mapFloorplanModelRows,
  FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD,
} from "./floorplan-model";

describe("mapFloorplanModelRow", () => {
  it("maps a complete canonical row", () => {
    const model = mapFloorplanModelRow({
      id: "m1",
      project_id: "p1",
      user_id: "u1",
      name: "Kitchen",
      model_url: "u1/p1/file.glb",
      metadata: { originalName: "Kitchen.glb", size: 100, fileType: "glb" },
      status: "ready",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });

    expect(model).toEqual({
      id: "m1",
      projectId: "p1",
      userId: "u1",
      name: "Kitchen",
      modelUrl: "u1/p1/file.glb",
      status: "ready",
      metadata: { originalName: "Kitchen.glb", size: 100, fileType: "glb" },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
    expect(model).not.toHaveProperty("storage_path");
    expect(model).not.toHaveProperty("uploaded_by");
    expect(model).not.toHaveProperty("file_type");
    expect(model).not.toHaveProperty("is_active");
  });

  it("falls back storage_path → modelUrl and uploaded_by → userId", () => {
    const model = mapFloorplanModelRow({
      id: "m2",
      project_id: "p",
      uploaded_by: "legacy-user",
      name: "Hall",
      storage_path: "legacy/path.glb",
      file_type: "glb",
      is_active: true,
      metadata: {},
      created_at: "t",
      updated_at: "t",
    });
    expect(model.modelUrl).toBe("legacy/path.glb");
    expect(model.userId).toBe("legacy-user");
    expect(model.status).toBe("draft");
  });

  it("prefers model_url over storage_path", () => {
    const model = mapFloorplanModelRow({
      id: "m3",
      project_id: "p",
      user_id: "u",
      name: "n",
      model_url: "canonical/path.glb",
      storage_path: "legacy/path.glb",
      status: "processing",
      metadata: null,
      created_at: "",
      updated_at: "",
    });
    expect(model.modelUrl).toBe("canonical/path.glb");
    expect(model.status).toBe("processing");
    expect(model.metadata).toEqual({});
  });

  it("maps unknown status to draft", () => {
    expect(mapFloorplanModelRow({ id: "x", status: "active" }).status).toBe("draft");
    expect(mapFloorplanModelRow({ id: "x", status: 1 }).status).toBe("draft");
    expect(mapFloorplanModelRow({ id: "x" }).status).toBe("draft");
  });

  it("accepts all valid statuses", () => {
    for (const status of ["draft", "processing", "ready", "error"] as const) {
      expect(mapFloorplanModelRow({ id: "x", status }).status).toBe(status);
    }
  });

  it("handles null model_url", () => {
    expect(mapFloorplanModelRow({ id: "x", model_url: null }).modelUrl).toBeNull();
  });

  it("mapFloorplanModelRows handles non-arrays", () => {
    expect(mapFloorplanModelRows(null)).toEqual([]);
    expect(mapFloorplanModelRows(undefined)).toEqual([]);
    expect(mapFloorplanModelRows({})).toEqual([]);
  });

  it("documents upload default status constant", () => {
    expect(FLOORPLAN_MODEL_STATUS_AFTER_UPLOAD).toBe("ready");
  });
});
