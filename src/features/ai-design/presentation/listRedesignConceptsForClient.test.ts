import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "listRedesignConceptsForClient.ts"),
  "utf8",
);

const { isNativePlatform, listRedesignConceptsNative, listRedesignConceptsServerFn } = vi.hoisted(
  () => ({
    isNativePlatform: vi.fn(() => false),
    listRedesignConceptsNative: vi.fn(),
    listRedesignConceptsServerFn: vi.fn(),
  }),
);

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/native-redesign-concepts", () => ({
  listRedesignConceptsNative: (...args: unknown[]) => listRedesignConceptsNative(...args),
}));

vi.mock("./serverFns", () => ({
  listRedesignConceptsServerFn: (...args: unknown[]) => listRedesignConceptsServerFn(...args),
}));

import { listRedesignConceptsForClient } from "./listRedesignConceptsForClient";
import {
  assertRedesignConceptList,
  selectedRedesignIdFromList,
  type DurableRedesignConcept,
} from "../domain/redesignAuthority";

function concept(overrides: Partial<DurableRedesignConcept> = {}): DurableRedesignConcept {
  return {
    id: "c1",
    style: "Modern",
    tagline: "Clean",
    palette: [],
    flooring: "Oak",
    lighting: "Warm",
    furniture: "Sofa",
    afterGradient: "g",
    analysisIdentity: "p1",
    isSelected: false,
    ...overrides,
  };
}

describe("assertRedesignConceptList (#151 contract)", () => {
  it("accepts a normal array and empty array", () => {
    const rows = [concept({ isSelected: true })];
    expect(assertRedesignConceptList(rows)).toEqual(rows);
    expect(assertRedesignConceptList([])).toEqual([]);
  });

  it("finds the selected concept on a valid list", () => {
    const rows = [concept({ id: "a", isSelected: false }), concept({ id: "b", isSelected: true })];
    expect(selectedRedesignIdFromList(assertRedesignConceptList(rows))).toBe("b");
    expect(selectedRedesignIdFromList([])).toBeNull();
  });

  it("rejects the native serverFn non-array shapes that crashed #151", () => {
    // Pre-fix: (durable ?? []).find crashed because ?? only guards nullish.
    expect(() => assertRedesignConceptList({ isSelected: true })).toThrow(/not an array/);
    expect(() => assertRedesignConceptList(new Response("<html></html>"))).toThrow(/not an array/);
    expect(() => assertRedesignConceptList("[]")).toThrow(/not an array/);
  });
});

describe("listRedesignConceptsForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    listRedesignConceptsNative.mockReset();
    listRedesignConceptsServerFn.mockReset();
  });

  it("web uses cookie listRedesignConceptsServerFn and returns the array", async () => {
    const rows = [concept({ id: "web-1", isSelected: true })];
    listRedesignConceptsServerFn.mockResolvedValue(rows);

    const out = await listRedesignConceptsForClient("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");

    expect(listRedesignConceptsServerFn).toHaveBeenCalledWith({
      data: { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" },
    });
    expect(listRedesignConceptsNative).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
    expect(selectedRedesignIdFromList(out)).toBe("web-1");
  });

  it("web throws when the serverFn resolves a non-array (does not coerce to [])", async () => {
    listRedesignConceptsServerFn.mockResolvedValue({ result: [] });
    await expect(
      listRedesignConceptsForClient("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
    ).rejects.toThrow(/not an array/);
  });

  it("native uses Keychain listRedesignConceptsNative and the canonical mapper", async () => {
    isNativePlatform.mockReturnValue(true);
    listRedesignConceptsNative.mockResolvedValue([
      {
        id: "c-native",
        style: "Modern",
        title: "Native",
        description: JSON.stringify({
          tagline: "Native",
          palette: [],
          flooring: "Oak",
          lighting: "Warm",
          furniture: "Sofa",
          afterGradient: "g",
          analysisIdentity: "p1",
          isSelected: false,
        }),
        image_url: null,
        analysis_identity: "p1",
        is_selected: true,
      },
    ]);

    const out = await listRedesignConceptsForClient("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");

    expect(listRedesignConceptsNative).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
    expect(listRedesignConceptsServerFn).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("c-native");
    expect(out[0]?.isSelected).toBe(true);
    expect(out[0]?.analysisIdentity).toBe("p1");
    expect(selectedRedesignIdFromList(out)).toBe("c-native");
  });

  it("native empty list is a real array, not a fallback object", async () => {
    isNativePlatform.mockReturnValue(true);
    listRedesignConceptsNative.mockResolvedValue([]);
    await expect(
      listRedesignConceptsForClient("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
    ).resolves.toEqual([]);
  });

  it("propagates native query errors instead of swallowing them as []", async () => {
    isNativePlatform.mockReturnValue(true);
    listRedesignConceptsNative.mockRejectedValue(new Error("JWT expired"));
    await expect(
      listRedesignConceptsForClient("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
    ).rejects.toThrow(/JWT expired/);
  });
});

describe("listRedesignConceptsForClient source containment", () => {
  it("does not statically import native.ts or pkce-storage", () => {
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']@\/platform\/supabase\/native["']/);
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']@\/platform\/auth\/native\/pkce-storage["']/);
  });

  it("dynamically imports native-redesign-concepts on the native path", () => {
    expect(SRC).toMatch(/import\(\s*["']@\/platform\/supabase\/native-redesign-concepts["']\s*\)/);
    expect(SRC).toMatch(/listRedesignConceptsNative/);
    expect(SRC).toMatch(/listRedesignConceptsServerFn/);
  });
});
