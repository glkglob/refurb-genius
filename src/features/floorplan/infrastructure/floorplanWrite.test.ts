/**
 * AO-1H1 / P1B3 — floorplanWrite canonical table primitives.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { fromMock, insertMock, selectMock, singleMock, deleteMock, deleteEqMock } = vi.hoisted(
  () => {
    const singleMock = vi.fn();
    const selectMock = vi.fn(() => ({ single: singleMock }));
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

const OBSOLETE_MODEL_KEYS = ["storage_path", "uploaded_by", "file_type", "is_active"];
const OBSOLETE_ANN_KEYS = ["project_id", "created_by", "label", "position", "notes", "room_id"];
const OBSOLETE_MEAS_KEYS = ["project_id", "created_by", "points", "label"];

describe("floorplanWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockImplementation(() => ({ single: singleMock }));
    deleteMock.mockImplementation(() => ({ eq: deleteEqMock }));
  });

  describe("createFloorplanModelRecord", () => {
    it("inserts canonical floorplan_models payload and returns domain model", async () => {
      const dbRow = {
        id: "model-1",
        project_id: "proj-1",
        user_id: "user-1",
        name: "Kitchen",
        model_url: "user-1/proj-1/id-file.glb",
        metadata: { originalName: "Kitchen.glb", size: 100, fileType: "glb" },
        status: "ready",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };
      insertMock.mockImplementation(() => ({ select: selectMock }));
      singleMock.mockResolvedValue({ data: dbRow, error: null });

      const result = await createFloorplanModelRecord({
        projectId: "proj-1",
        userId: "user-1",
        name: "Kitchen",
        modelUrl: "user-1/proj-1/id-file.glb",
        fileType: "glb",
        metadata: { originalName: "Kitchen.glb", size: 100 },
      });

      expect(fromMock).toHaveBeenCalledWith("floorplan_models");
      const payload = insertMock.mock.calls[0][0];
      expect(payload).toEqual({
        project_id: "proj-1",
        user_id: "user-1",
        name: "Kitchen",
        model_url: "user-1/proj-1/id-file.glb",
        metadata: { originalName: "Kitchen.glb", size: 100, fileType: "glb" },
        status: "ready",
      });
      for (const key of OBSOLETE_MODEL_KEYS) {
        expect(payload).not.toHaveProperty(key);
      }
      expect(selectMock).toHaveBeenCalled();
      expect(singleMock).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: "model-1",
        projectId: "proj-1",
        userId: "user-1",
        name: "Kitchen",
        modelUrl: "user-1/proj-1/id-file.glb",
        status: "ready",
      });
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
          modelUrl: "path",
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
    it("inserts canonical annotation_type + data (no obsolete flat columns)", async () => {
      insertMock.mockResolvedValue({ error: null });

      await createFloorplanAnnotation({
        modelId: "m1",
        label: "Kitchen",
        position: [1, 2, 3],
        roomId: "room-1",
        notes: "Kitchen Room",
      });

      expect(fromMock).toHaveBeenCalledWith("floorplan_annotations");
      const payload = insertMock.mock.calls[0][0];
      expect(payload).toEqual({
        model_id: "m1",
        annotation_type: "room_tag",
        data: {
          label: "Kitchen",
          position: [1, 2, 3],
          notes: "Kitchen Room",
          room_id: "room-1",
        },
      });
      for (const key of OBSOLETE_ANN_KEYS) {
        expect(payload).not.toHaveProperty(key);
      }
      expect(selectMock).not.toHaveBeenCalled();
    });

    it("omits null roomId and notes from data JSON", async () => {
      insertMock.mockResolvedValue({ error: null });

      await createFloorplanAnnotation({
        modelId: "m1",
        label: "Tag",
        position: [0, 0, 0],
        roomId: null,
        notes: null,
      });

      expect(insertMock).toHaveBeenCalledWith({
        model_id: "m1",
        annotation_type: "room_tag",
        data: { label: "Tag", position: [0, 0, 0] },
      });
    });

    it("throws Supabase error unchanged", async () => {
      const err = { message: "ann insert failed" };
      insertMock.mockResolvedValue({ error: err });

      await expect(
        createFloorplanAnnotation({
          modelId: "m",
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
    it("inserts measurement_type/value/unit without points or attribution columns", async () => {
      insertMock.mockResolvedValue({ error: null });

      await createFloorplanMeasurement({
        modelId: "m1",
        measurementType: "distance",
        value: 3.142,
        unit: "m",
      });

      expect(fromMock).toHaveBeenCalledWith("floorplan_measurements");
      const payload = insertMock.mock.calls[0][0];
      expect(payload).toEqual({
        model_id: "m1",
        measurement_type: "distance",
        value: 3.142,
        unit: "m",
      });
      for (const key of OBSOLETE_MEAS_KEYS) {
        expect(payload).not.toHaveProperty(key);
      }
    });

    it("rejects non-finite value", async () => {
      await expect(
        createFloorplanMeasurement({
          modelId: "m",
          value: Number.NaN,
        }),
      ).rejects.toThrow(/finite/);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("throws Supabase error unchanged", async () => {
      const err = { message: "meas insert failed" };
      insertMock.mockResolvedValue({ error: err });

      await expect(
        createFloorplanMeasurement({
          modelId: "m",
          measurementType: "distance",
          value: 1,
          unit: "m",
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

  describe("static dual-baseline policy", () => {
    it("contains no prohibited assertions or obsolete payload keys in production write module", () => {
      const src = readFileSync(join(__dirname, "floorplanWrite.ts"), "utf8");
      expect(src).not.toMatch(/\bas any\b/);
      expect(src).not.toMatch(/\bas unknown as\b/);
      expect(src).not.toMatch(/@ts-ignore|@ts-expect-error|ts-nocheck/);
      // Obsolete columns must not appear as object keys in insert payloads
      expect(src).not.toMatch(/storage_path\s*:/);
      expect(src).not.toMatch(/uploaded_by\s*:/);
      expect(src).not.toMatch(/file_type\s*:/);
      expect(src).not.toMatch(/is_active\s*:/);
      expect(src).not.toMatch(/created_by\s*:/);
      expect(src).not.toMatch(/points\s*:/);
    });
  });
});
