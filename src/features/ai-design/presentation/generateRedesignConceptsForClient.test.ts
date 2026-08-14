import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "@/platform/http/errors";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "generateRedesignConceptsForClient.ts"),
  "utf8",
);

const { isNativePlatform, generateRedesignConceptsNative, generateRedesignConceptsServerFn } =
  vi.hoisted(() => ({
    isNativePlatform: vi.fn(() => false),
    generateRedesignConceptsNative: vi.fn(),
    generateRedesignConceptsServerFn: vi.fn(),
  }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/http/mobile-redesign-generate", () => ({
  generateRedesignConceptsNative: (...args: unknown[]) => generateRedesignConceptsNative(...args),
}));

vi.mock("./serverFns", () => ({
  generateRedesignConceptsServerFn: (...args: unknown[]) =>
    generateRedesignConceptsServerFn(...args),
}));

import { generateRedesignConceptsForClient } from "./generateRedesignConceptsForClient";
import type { DurableRedesignConcept } from "../domain/redesignAuthority";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

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

describe("generateRedesignConceptsForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    generateRedesignConceptsNative.mockReset();
    generateRedesignConceptsServerFn.mockReset();
  });

  it("web uses cookie generateRedesignConceptsServerFn and does not call the mobile endpoint", async () => {
    const rows = [concept()];
    generateRedesignConceptsServerFn.mockResolvedValue(rows);

    const out = await generateRedesignConceptsForClient({ projectId: PROJECT, styles: ["Modern"] });

    expect(generateRedesignConceptsServerFn).toHaveBeenCalledWith({
      data: { projectId: PROJECT, styles: ["Modern"] },
    });
    expect(generateRedesignConceptsNative).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
  });

  it("web throws when the serverFn resolves a non-array", async () => {
    generateRedesignConceptsServerFn.mockResolvedValue(new Response("<html></html>"));
    await expect(generateRedesignConceptsForClient({ projectId: PROJECT })).rejects.toThrow(
      /not an array/,
    );
  });

  it("native uses Bearer generate helper", async () => {
    isNativePlatform.mockReturnValue(true);
    const rows = [concept({ id: "n1" })];
    generateRedesignConceptsNative.mockResolvedValue(rows);

    const out = await generateRedesignConceptsForClient({ projectId: PROJECT });

    expect(generateRedesignConceptsNative).toHaveBeenCalledWith({ projectId: PROJECT });
    expect(generateRedesignConceptsServerFn).not.toHaveBeenCalled();
    expect(out).toEqual(rows);
  });

  it("native rejects a non-array generate payload", async () => {
    isNativePlatform.mockReturnValue(true);
    generateRedesignConceptsNative.mockResolvedValue({ data: [] });
    await expect(generateRedesignConceptsForClient({ projectId: PROJECT })).rejects.toThrow(
      /not an array/,
    );
  });

  it("propagates native 401 and 429", async () => {
    isNativePlatform.mockReturnValue(true);
    generateRedesignConceptsNative.mockRejectedValueOnce(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(generateRedesignConceptsForClient({ projectId: PROJECT })).rejects.toMatchObject({
      status: 401,
    });

    generateRedesignConceptsNative.mockRejectedValueOnce(
      new NativeHttpError("Rate limit exceeded. Try again in 12s.", {
        code: "http_error",
        status: 429,
      }),
    );
    await expect(generateRedesignConceptsForClient({ projectId: PROJECT })).rejects.toMatchObject({
      status: 429,
      message: expect.stringMatching(/Rate limit exceeded/),
    });
  });
});

describe("generateRedesignConceptsForClient source containment", () => {
  it("dynamically imports the mobile generate helper and never OpenAI", () => {
    expect(SRC).toMatch(/import\(\s*["']@\/platform\/http\/mobile-redesign-generate["']\s*\)/);
    expect(SRC).toMatch(/generateRedesignConceptsServerFn/);
    expect(SRC).not.toMatch(/OPENAI_API_KEY/);
    expect(SRC).not.toMatch(/ai-redesign\.adapter\.server/);
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']@\/platform\/supabase\/native["']/);
  });
});
