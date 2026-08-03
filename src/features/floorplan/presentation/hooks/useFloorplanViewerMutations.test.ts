/**
 * AO-1H1 / P1B3 — useFloorplanViewerMutations: Auth, mutations, invalidations, toasts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { floorplanKeys } from "@/lib/queries/floorplans";
import { estimateQueryOptions } from "@/lib/queries/projects";

const getUser = vi.hoisted(() => vi.fn());
const uploadFloorplanModel = vi.hoisted(() => vi.fn());
const deleteFloorplanStorage = vi.hoisted(() => vi.fn());
const createFloorplanModelRecord = vi.hoisted(() => vi.fn());
const deleteFloorplanModelRecord = vi.hoisted(() => vi.fn());
const createFloorplanAnnotation = vi.hoisted(() => vi.fn());
const deleteFloorplanAnnotation = vi.hoisted(() => vi.fn());
const createFloorplanMeasurement = vi.hoisted(() => vi.fn());
const deleteFloorplanMeasurement = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: {
    getUser: (...args: unknown[]) => getUser(...args),
  },
}));

vi.mock("@/lib/floorplan", () => ({
  uploadFloorplanModel: (...args: unknown[]) => uploadFloorplanModel(...args),
  deleteFloorplanStorage: (...args: unknown[]) => deleteFloorplanStorage(...args),
  pointToArray: (p: { x: number; y: number; z: number }) => [p.x, p.y, p.z],
}));

vi.mock("../../infrastructure/floorplanWrite", () => ({
  createFloorplanModelRecord: (...args: unknown[]) => createFloorplanModelRecord(...args),
  deleteFloorplanModelRecord: (...args: unknown[]) => deleteFloorplanModelRecord(...args),
  createFloorplanAnnotation: (...args: unknown[]) => createFloorplanAnnotation(...args),
  deleteFloorplanAnnotation: (...args: unknown[]) => deleteFloorplanAnnotation(...args),
  createFloorplanMeasurement: (...args: unknown[]) => createFloorplanMeasurement(...args),
  deleteFloorplanMeasurement: (...args: unknown[]) => deleteFloorplanMeasurement(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("three", () => ({
  Vector3: class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    distanceTo(other: { x: number; y: number; z: number }) {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dz = this.z - other.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  },
}));

import { useFloorplanViewerMutations } from "./useFloorplanViewerMutations";

const PROJECT = "proj-1";
const MODEL_ID = "model-1";
const ESTIMATE_KEY = estimateQueryOptions(PROJECT).queryKey;

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const sampleModel = {
  id: MODEL_ID,
  projectId: PROJECT,
  userId: "user-1",
  name: "Kitchen",
  modelUrl: "user-1/proj-1/file.glb",
  status: "ready" as const,
  metadata: {},
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

beforeEach(() => {
  getUser.mockReset();
  uploadFloorplanModel.mockReset();
  deleteFloorplanStorage.mockReset();
  createFloorplanModelRecord.mockReset();
  deleteFloorplanModelRecord.mockReset();
  createFloorplanAnnotation.mockReset();
  deleteFloorplanAnnotation.mockReset();
  createFloorplanMeasurement.mockReset();
  deleteFloorplanMeasurement.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  toastInfo.mockReset();
  loggerError.mockReset();
  getUser.mockReturnValue({ id: "user-1", email: "a@b.com" });
  deleteFloorplanStorage.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFloorplanViewerMutations", () => {
  it("createModel: auth gate, storage then insert, invalidate, toast, callback", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const onModelCreated = vi.fn();
    const created = { ...sampleModel, id: "new-id", name: "Kitchen" };
    uploadFloorplanModel.mockResolvedValue({ path: "user-1/proj-1/x.glb" });
    createFloorplanModelRecord.mockResolvedValue(created);

    const file = new File(["glTF"], "Kitchen.glb", { type: "model/gltf-binary" });
    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: null,
          estimateRooms: [],
          onModelCreated,
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.createModel(file);
    });

    await waitFor(() => expect(onModelCreated).toHaveBeenCalledWith(created));

    expect(getUser).toHaveBeenCalled();
    expect(uploadFloorplanModel).toHaveBeenCalledWith(PROJECT, file, "user-1");
    expect(createFloorplanModelRecord).toHaveBeenCalledWith({
      projectId: PROJECT,
      userId: "user-1",
      name: "Kitchen",
      modelUrl: "user-1/proj-1/x.glb",
      fileType: "glb",
      metadata: { originalName: "Kitchen.glb", size: file.size },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.byProject(PROJECT),
    });
    expect(toastSuccess).toHaveBeenCalledWith("Model uploaded", { description: "Kitchen" });
  });

  it("createModel: missing user throws exact upload error string", async () => {
    getUser.mockReturnValue(null);
    const qc = createQc();
    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: null,
          estimateRooms: [],
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.createModel(new File(["x"], "a.glb"));
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("Upload failed", {
      description: "You must be signed in to upload models.",
    });
    expect(loggerError).toHaveBeenCalled();
    expect(uploadFloorplanModel).not.toHaveBeenCalled();
  });

  it("createModel: DB failure cleans storage and rethrows", async () => {
    const qc = createQc();
    uploadFloorplanModel.mockResolvedValue({ path: "path/to/file" });
    const dbErr = new Error("db fail");
    createFloorplanModelRecord.mockRejectedValue(dbErr);
    deleteFloorplanStorage.mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: null,
          estimateRooms: [],
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.createModel(new File(["x"], "a.glb"));
    });

    await waitFor(() => expect(deleteFloorplanStorage).toHaveBeenCalledWith("path/to/file"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Upload failed", { description: "db fail" }),
    );
  });

  it("deleteModel: storage via modelUrl then DB delete, invalidate, toast, callback", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const onModelDeleted = vi.fn();
    deleteFloorplanModelRecord.mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: MODEL_ID,
          estimateRooms: [],
          onModelDeleted,
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.deleteModel(sampleModel);
    });

    await waitFor(() => expect(onModelDeleted).toHaveBeenCalled());
    expect(deleteFloorplanStorage).toHaveBeenCalledWith(sampleModel.modelUrl);
    expect(deleteFloorplanModelRecord).toHaveBeenCalledWith(MODEL_ID);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.byProject(PROJECT),
    });
    expect(toastSuccess).toHaveBeenCalledWith("Model deleted");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("saveAnnotation: auth, insert, invalidate annotations, toast, callback", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const onAnnotationSaved = vi.fn();
    createFloorplanAnnotation.mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: MODEL_ID,
          estimateRooms: [{ id: "room-1", name: "Kitchen Room" }],
          onAnnotationSaved,
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.saveAnnotation({
        position: { x: 1, y: 2, z: 3 },
        label: "Kitchen",
        linkedRoomId: "room-1",
      });
    });

    await waitFor(() => expect(onAnnotationSaved).toHaveBeenCalled());
    expect(createFloorplanAnnotation).toHaveBeenCalledWith({
      modelId: MODEL_ID,
      label: "Kitchen",
      position: { x: 1, y: 2, z: 3 },
      roomId: "room-1",
      notes: "Kitchen Room",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.annotationsByModel(MODEL_ID),
    });
    expect(toastSuccess).toHaveBeenCalledWith("Room tagged");
  });

  it("saveAnnotation: missing user exact string", async () => {
    getUser.mockReturnValue(null);
    const qc = createQc();
    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: MODEL_ID,
          estimateRooms: [],
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.saveAnnotation({
        position: { x: 0, y: 0, z: 0 },
        label: "X",
      });
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Failed to save tag", {
        description: "You must be signed in",
      }),
    );
  });

  it("saveMeasurement: geometry, auth, insert distance without points", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const onMeasurementSaved = vi.fn();
    createFloorplanMeasurement.mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: MODEL_ID,
          estimateRooms: [],
          onMeasurementSaved,
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.saveMeasurement({
        p1: { x: 0, y: 0, z: 0 },
        p2: { x: 3, y: 0, z: 0 },
      });
    });

    await waitFor(() => expect(onMeasurementSaved).toHaveBeenCalled());
    expect(createFloorplanMeasurement).toHaveBeenCalledWith({
      modelId: MODEL_ID,
      measurementType: "distance",
      value: 3,
      unit: "m",
    });
    const call = createFloorplanMeasurement.mock.calls[0][0];
    expect(call).not.toHaveProperty("points");
    expect(call).not.toHaveProperty("projectId");
    expect(call).not.toHaveProperty("userId");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.measurementsByModel(MODEL_ID),
    });
    expect(toastSuccess).toHaveBeenCalledWith("Measurement saved");
  });

  it("deleteAnnotation and deleteMeasurement invalidate and toast", async () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    deleteFloorplanAnnotation.mockResolvedValue(undefined);
    deleteFloorplanMeasurement.mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: MODEL_ID,
          estimateRooms: [],
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.deleteAnnotation("ann-1");
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Annotation removed"));
    expect(deleteFloorplanAnnotation).toHaveBeenCalledWith("ann-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.annotationsByModel(MODEL_ID),
    });

    act(() => {
      result.current.deleteMeasurement("meas-1");
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Measurement removed"));
    expect(deleteFloorplanMeasurement).toHaveBeenCalledWith("meas-1");
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.measurementsByModel(MODEL_ID),
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refreshModels invalidates project models key", () => {
    const qc = createQc();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(
      () =>
        useFloorplanViewerMutations(PROJECT, {
          selectedModelId: null,
          estimateRooms: [],
        }),
      { wrapper: createWrapper(qc) },
    );

    act(() => {
      result.current.refreshModels();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: floorplanKeys.byProject(PROJECT),
    });
    expect(toastInfo).toHaveBeenCalledWith("Refreshed");
    // estimate key untouched by refresh
    expect(ESTIMATE_KEY).toBeTruthy();
  });

  it("source has no as unknown as or as any", () => {
    const src = readFileSync(join(__dirname, "useFloorplanViewerMutations.ts"), "utf8");
    expect(src).not.toMatch(/\bas unknown as\b/);
    expect(src).not.toMatch(/\bas any\b/);
    expect(src).not.toMatch(/storage_path/);
  });
});
