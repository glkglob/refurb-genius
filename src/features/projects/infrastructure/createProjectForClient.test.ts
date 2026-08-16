import { describe, it, expect, vi, beforeEach } from "vitest";

const { isNativePlatform, createProjectServerFn, createProjectNative } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  createProjectServerFn: vi.fn(),
  createProjectNative: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/serverFns/projects", () => ({
  createProjectServerFn: (input: unknown) => createProjectServerFn(input),
}));

vi.mock("@/platform/supabase/native-projects", () => ({
  createProjectNative: (input: unknown) => createProjectNative(input),
}));

import { createProjectForClient } from "./createProjectForClient";

const INPUT = {
  name: "New House",
  address: "1 High St",
  postcode: "E1 1AA",
  region: "London" as const,
  property_type: "Terraced" as const,
  bedrooms: 3,
  bathrooms: 1,
  size_sqm: 90,
  purchase_price: 300_000,
  estimated_gdv: 400_000,
  notes: "",
};

describe("createProjectForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    createProjectServerFn.mockReset();
    createProjectNative.mockReset();
    createProjectServerFn.mockResolvedValue({ id: "web-1", name: INPUT.name });
    createProjectNative.mockResolvedValue({
      id: "nat-1",
      user_id: "u1",
      name: INPUT.name,
      address: INPUT.address,
      postcode: INPUT.postcode,
      region: INPUT.region,
      property_type: INPUT.property_type,
      bedrooms: INPUT.bedrooms,
      bathrooms: INPUT.bathrooms,
      size_sqm: INPUT.size_sqm,
      purchase_price: INPUT.purchase_price,
      estimated_gdv: INPUT.estimated_gdv,
      notes: INPUT.notes,
      created_at: "2026-01-01T00:00:00.000Z",
      status: "Draft",
      photos_done: false,
      analysis_done: false,
      estimate_done: false,
      report_done: false,
    });
  });

  it("web uses createProjectServerFn", async () => {
    await createProjectForClient(INPUT);
    expect(createProjectServerFn).toHaveBeenCalledWith({ data: INPUT });
    expect(createProjectNative).not.toHaveBeenCalled();
  });

  it("native uses createProjectNative and maps the row", async () => {
    isNativePlatform.mockReturnValue(true);
    const out = await createProjectForClient(INPUT);
    expect(createProjectNative).toHaveBeenCalledWith({
      name: INPUT.name,
      address: INPUT.address,
      postcode: INPUT.postcode,
      region: INPUT.region,
      property_type: INPUT.property_type,
      bedrooms: INPUT.bedrooms,
      bathrooms: INPUT.bathrooms,
      size_sqm: INPUT.size_sqm,
      purchase_price: INPUT.purchase_price,
      estimated_gdv: INPUT.estimated_gdv,
      notes: INPUT.notes,
    });
    expect(createProjectServerFn).not.toHaveBeenCalled();
    expect(out).toMatchObject({ id: "nat-1", name: INPUT.name, user_id: "u1" });
  });
});
