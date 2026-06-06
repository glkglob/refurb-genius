// 3D Floorplan feature domain types (camelCase for app use)
// Matches floorplan_models / annotations / measurements tables (UUIDv7 PKs)

export type FloorplanStatus = "draft" | "processing" | "ready" | "error";

export type FloorplanModel = {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  modelUrl: string | null;
  metadata: Record<string, unknown>;
  status: FloorplanStatus;
  createdAt: string;
  updatedAt: string;
};

export type FloorplanAnnotation = {
  id: string;
  modelId: string;
  annotationType: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FloorplanMeasurement = {
  id: string;
  modelId: string;
  measurementType: string;
  value: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
};

export type FloorplanModelWithAnnotations = FloorplanModel & {
  annotations: FloorplanAnnotation[];
  measurements: FloorplanMeasurement[];
};
