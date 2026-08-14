import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "selectRedesignConceptForClient.ts"),
  "utf8",
);

const { isNativePlatform, selectRedesignConceptNative, selectRedesignConceptServerFn } = vi.hoisted(
  () => ({
    isNativePlatform: vi.fn(() => false),
    selectRedesignConceptNative: vi.fn(),
    selectRedesignConceptServerFn: vi.fn(),
  }),
);

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/supabase/native-redesign-select", () => ({
  selectRedesignConceptNative: (...args: unknown[]) => selectRedesignConceptNative(...args),
}));

vi.mock("./serverFns", () => ({
  selectRedesignConceptServerFn: (...args: unknown[]) => selectRedesignConceptServerFn(...args),
}));

import { selectRedesignConceptForClient } from "./selectRedesignConceptForClient";
import {
  assertDurableRedesignConcept,
  type DurableRedesignConcept,
} from "../domain/redesignAuthority";

function concept(overrides: Partial<DurableRedesignConcept> = {}): DurableRedesignConcept {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    style: "Modern",
    tagline: "Clean",
    palette: [],
    flooring: "Oak",
    lighting: "Warm",
    furniture: "Sofa",
    afterGradient: "g",
    analysisIdentity: "p1",
    isSelected: true,
    ...overrides,
  };
}

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const CONCEPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

describe("selectRedesignConceptForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    selectRedesignConceptNative.mockReset();
    selectRedesignConceptServerFn.mockReset();
  });

  it("web uses cookie selectRedesignConceptServerFn", async () => {
    const selected = concept();
    selectRedesignConceptServerFn.mockResolvedValue(selected);

    await expect(
      selectRedesignConceptForClient({ projectId: PROJECT, conceptId: CONCEPT }),
    ).resolves.toEqual(selected);

    expect(selectRedesignConceptServerFn).toHaveBeenCalledWith({
      data: { projectId: PROJECT, conceptId: CONCEPT },
    });
    expect(selectRedesignConceptNative).not.toHaveBeenCalled();
  });

  it("web throws when the serverFn resolves a non-concept (does not coerce)", async () => {
    selectRedesignConceptServerFn.mockResolvedValue(new Response("<html></html>"));
    await expect(
      selectRedesignConceptForClient({ projectId: PROJECT, conceptId: CONCEPT }),
    ).rejects.toThrow(/not a concept/);
  });

  it("native uses Keychain select RPC helper", async () => {
    isNativePlatform.mockReturnValue(true);
    selectRedesignConceptNative.mockResolvedValue({
      id: CONCEPT,
      style: "Modern",
      title: "Clean",
      description: JSON.stringify({
        tagline: "Clean",
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
    });

    const out = await selectRedesignConceptForClient({ projectId: PROJECT, conceptId: CONCEPT });

    expect(selectRedesignConceptNative).toHaveBeenCalledWith({
      projectId: PROJECT,
      conceptId: CONCEPT,
    });
    expect(selectRedesignConceptServerFn).not.toHaveBeenCalled();
    expect(out.isSelected).toBe(true);
    expect(out.id).toBe(CONCEPT);
  });

  it("propagates native unauthorized and not-found errors", async () => {
    isNativePlatform.mockReturnValue(true);
    selectRedesignConceptNative.mockRejectedValueOnce(new Error("Not authorised for this project"));
    await expect(
      selectRedesignConceptForClient({ projectId: PROJECT, conceptId: CONCEPT }),
    ).rejects.toThrow(/Not authorised/);

    selectRedesignConceptNative.mockRejectedValueOnce(
      new Error("Redesign concept not found for this project"),
    );
    await expect(
      selectRedesignConceptForClient({ projectId: PROJECT, conceptId: CONCEPT }),
    ).rejects.toThrow(/not found/);
  });
});

describe("assertDurableRedesignConcept", () => {
  it("accepts a selected concept and rejects #151 Response/HTML shapes", () => {
    expect(assertDurableRedesignConcept(concept()).id).toBe(CONCEPT);
    expect(() => assertDurableRedesignConcept(new Response("<html></html>"))).toThrow(
      /not a concept/,
    );
    expect(() => assertDurableRedesignConcept([])).toThrow(/not a concept/);
  });
});

describe("selectRedesignConceptForClient source containment", () => {
  it("does not statically import native Keychain or server-only modules", () => {
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']@\/platform\/supabase\/native["']/);
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']@\/serverFns\/auth\.server["']/);
    expect(SRC).toMatch(/import\(\s*["']@\/platform\/supabase\/native-redesign-select["']\s*\)/);
    expect(SRC).toMatch(/selectRedesignConceptServerFn/);
  });
});
