/**
 * AO-1H1 — floorplanWrite table primitives.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, insertMock, selectMock, singleMock, deleteMock, deleteEqMock } = vi.hoisted(
  () => {
    const singleMock = vi.fn();
    const selectMock = vi.fn(() => ({ single: singleMock }));
    /** Dual-mode: model create chains .select().single(); annotation/measurement await insert directly. */
    const insertMock = vi.fn() as ReturnType<typeof vi.fn> & {
      mockResolvedValue: (v: unknown) => unknown;
    };
    const deleteEqMock = vi.fn();
    const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
    const fromMock = vi.fn((table: string) => {
      if (
        table === "floorplan_models" ||
        table === "floorplan_annotations" ||
        table === "floorplan_measurements"
      ) {
        return {
          insert: insertMock,
          delete: deleteMock,
        };
      }
      return {};
    });
    return {
      fromMock,
      insertMock,
      selectMock,
      singleMock,
      deleteMock,
      deleteEqMock,
    };
  },
);

vi.mock("@/platform/supabase/browser", () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  createFloorplanModelRecord,
  deleteFloorplanModelRecord,
  createFloorplanAnnotation,
  deleteFloorplanAnnotation,
  createFloorplanMeasurement,
  deleteFloorplanMeasurement,
} from "./floorplanWrite";

describe("floorplanWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockImplementation(() => ({ single: singleMock }));
    deleteMock.mockImplementation(() => ({ eq: deleteEqMock }));
  });

  describe("createFloorplanModelRecord", () => {
    it("inserts floorplan_models with exact payload and returns row", async () => {
      const row = {
        id: "model-1",
        project_id: "proj-1",
        uploaded_by: "user-1",
        name: "Kitchen",
        storage_path: "user-1/proj-1/id-file.glb",
        file_type: "glb",
        metadata: { originalName: "Kitchen.glb", size: 100 },
      };
      insertMock.mockImplementation(() => ({ select: selectMock }));
      singleMock.mockResolvedValue({ data: row, error: null });

      const result = await createFloorplanModelRecord({
        projectId: "proj-1",
        userId: "user-1",
        name: "Kitchen",
        storagePath: "user-1/proj-1/id-file.glb",
        fileType: "glb",
        metadata: { originalName: "Kitchen.glb", size: 100 },
      });

      expect(fromMock).toHaveBeenCalledWith("floorplan_models");
      expect(insertMock).toHaveBeenCalledWith({
        project_id: "proj-1",
        uploaded_by: "user-1",
        name: "Kitchen",
        storage_path: "user-1/proj-1/id-file.glb",
        file_type: "glb",
        metadata: { originalName: "Kitchen.glb", size: 100 },
      });
      expect(selectMock).toHaveBeenCalled();
      expect(singleMock).toHaveBeenCalled();
      expect(result).toEqual(row);
    });

    it("throws Supabase error unchanged", async () => {
      const err = { message: "insert failed", code: "23505" };
      insertMock.mockImplementation(() => ({ select: selectMock }));
      singleMock.mockResolvedValue({ data: null, error: err });

      await expect(
        createFloorplanModelRecord({
          projectId: "p",
          userId: "u",
          name: "n",
          storagePath: "path",
          fileType: "glb",
          metadata: {},
        }),
      ).rejects.toBe(err);
    });
  });

  describe("deleteFloorplanModelRecord", () => {
    it("deletes by id", async () => {
      deleteEqMock.mockResolvedValue({ error: null });

      await deleteFloorplanModelRecord("model-1");

      expect(fromMock).toHaveBeenCalledWith("floorplan_models");
      expect(deleteMock).toHaveBeenCalled();
      expect(deleteEqMock).toHaveBeenCalledWith("id", "model-1");
    });

    it("throws Supabase error unchanged", async () => {
      const err = { message: "delete failed" };
      deleteEqMock.mockResolvedValue({ error: err });

      await expect(deleteFloorplanModelRecord("model-1")).rejects.toBe(err);
    });
  });

  describe("createFloorplanAnnotation", () => {
    it("inserts floorplan_annotations with exact payload (no select)", async () => {
      insertMock.mockResolvedValue({ error: null });

      await createFloorplanAnnotation({
        modelId: "m1",
        projectId: "p1",
        userId: "u1",
        label: "Kitchen",
        position: [1, 2, 3],
        roomId: "room-1",
        notes: "Kitchen Room",
      });

      expect(fromMock).toHaveBeenCalledWith("floorplan_annotations");
      expect(insertMock).toHaveBeenCalledWith({
        model_id: "m1",
        project_id: "p1",
        created_by: "u1",
        label: "Kitchen",
        position: [1, 2, 3],
        room_id: "room-1",
        notes: "Kitchen Room",
      });
      expect(selectMock).not.toHaveBeenCalled();
    });

    it("allows null roomId and notes", async () => {
      insertMock.mockResolvedValue({ error: null });

      await createFloorplanAnnotation({
        modelId: "m1",
        projectId: "p1",
        userId: "u1",
        label: "Tag",
        position: [0, 0, 0],
        roomId: null,
        notes: null,
      });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ room_id: null, notes: null }),
      );
    });

    it("throws Supabase error unchanged", async () => {
      const err = { message: "ann insert failed" };
      insertMock.mockResolvedValue({ error: err });

      await expect(
        createFloorplanAnnotation({
          modelId: "m",
          projectId: "p",
          userId: "u",
          label: "L",
          position: [0, 0, 0],
          roomId: null,
          notes: null,
        }),
      ).rejects.toBe(err);
    });
  });

  describe("deleteFloorplanAnnotation", () => {
    it("deletes by id", async () => {
      deleteEqMock.mockResolvedValue({ error: null });

      await deleteFloorplanAnnotation("ann-1");

      expect(fromMock).toHaveBeenCalledWith("floorplan_annotations");
      expect(deleteEqMock).toHaveBeenCalledWith("id", "ann-1");
    });
  });

  describe("createFloorplanMeasurement", () => {
    it("inserts with measurement_type column (not type)", async () => {
      insertMock.mockResolvedValue({ error: null });

      await createFloorplanMeasurement({
        modelId: "m1",
        projectId: "p1",
        userId: "u1",
        measurementType: "distance",
        value: 3.142,
        unit: "m",
        points: [
          [0, 0, 0],
          [1, 0, 0],
        ],
      });

      expect(fromMock).toHaveBeenCalledWith("floorplan_measurements");
      expect(insertMock).toHaveBeenCalledWith({
        model_id: "m1",
        project_id: "p1",
        created_by: "u1",
        measurement_type: "distance",
        value: 3.142,
        unit: "m",
        points: [
          [0, 0, 0],
          [1, 0, 0],
        ],
      });
    });

    it("throws Supabase error unchanged", async () => {
      const err = { message: "meas insert failed" };
      insertMock.mockResolvedValue({ error: err });

      await expect(
        createFloorplanMeasurement({
          modelId: "m",
          projectId: "p",
          userId: "u",
          measurementType: "distance",
          value: 1,
          unit: "m",
          points: [],
        }),
      ).rejects.toBe(err);
    });
  });

  describe("deleteFloorplanMeasurement", () => {
    it("deletes by id", async () => {
      deleteEqMock.mockResolvedValue({ error: null });

      await deleteFloorplanMeasurement("meas-1");

      expect(fromMock).toHaveBeenCalledWith("floorplan_measurements");
      expect(deleteEqMock).toHaveBeenCalledWith("id", "meas-1");
    });
  });
});
