import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NativeHttpError } from "@/platform/http/errors";
import type { ScopeAnalysisInput } from "../domain";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "runScopeAnalysisForClient.ts"),
  "utf8",
);
const HOOK_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "hooks/useScopeAnalysis.ts"),
  "utf8",
);

const { isNativePlatform, runScopeAnalysisNative, runScopeAnalysisServerFn } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  runScopeAnalysisNative: vi.fn(),
  runScopeAnalysisServerFn: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
}));

vi.mock("@/platform/http/mobile-scope-analyze", () => ({
  runScopeAnalysisNative: (...args: unknown[]) => runScopeAnalysisNative(...args),
}));

vi.mock("./serverFns", () => ({
  runScopeAnalysisServerFn: (...args: unknown[]) => runScopeAnalysisServerFn(...args),
}));

import { runScopeAnalysisForClient } from "./runScopeAnalysisForClient";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

function input(): ScopeAnalysisInput {
  return {
    projectId: PROJECT,
    photos: [{ id: "p1", url: "https://evil.example/stolen.jpg", name: "room.jpg" }],
    roomTags: ["Kitchen"],
    propertyType: "Terraced",
    bedrooms: 3,
    region: "London",
  };
}

function result() {
  return {
    overall_score: 6,
    summary: "Average condition terrace needing a medium refresh.",
    rooms: [
      {
        room: "Kitchen",
        condition_summary: "Dated but serviceable",
        issues: [
          {
            category: "Cosmetic",
            description: "Worn units",
            severity: "medium",
            recommended_action: "Replace units",
          },
        ],
        recommended_items: [
          {
            name: "Replace mid-range kitchen units",
            category: "both",
            quantity: 1,
            unit: "room",
            base_unit_cost: 8000,
          },
        ],
      },
    ],
  };
}

describe("runScopeAnalysisForClient", () => {
  beforeEach(() => {
    isNativePlatform.mockReturnValue(false);
    runScopeAnalysisNative.mockReset();
    runScopeAnalysisServerFn.mockReset();
  });

  it("web uses cookie runScopeAnalysisServerFn and does not call the mobile endpoint", async () => {
    const payload = result();
    runScopeAnalysisServerFn.mockResolvedValue(payload);

    const out = await runScopeAnalysisForClient(input());

    expect(runScopeAnalysisServerFn).toHaveBeenCalledWith({ data: input() });
    expect(runScopeAnalysisNative).not.toHaveBeenCalled();
    expect(out.rooms[0]?.room).toBe("Kitchen");
  });

  it("web throws when the serverFn resolves a non-result", async () => {
    runScopeAnalysisServerFn.mockResolvedValue(new Response("<html></html>"));
    await expect(runScopeAnalysisForClient(input())).rejects.toThrow(/not a result/);
  });

  it("native uses Bearer helper and never the cookie serverFn", async () => {
    isNativePlatform.mockReturnValue(true);
    runScopeAnalysisNative.mockResolvedValue(result());

    const out = await runScopeAnalysisForClient(input());

    expect(runScopeAnalysisNative).toHaveBeenCalledWith(input());
    expect(runScopeAnalysisServerFn).not.toHaveBeenCalled();
    expect(out.rooms).toHaveLength(1);
  });

  it("native rejects missing rooms and wrapped payloads", async () => {
    isNativePlatform.mockReturnValue(true);
    runScopeAnalysisNative.mockResolvedValue({ data: result() });
    await expect(runScopeAnalysisForClient(input())).rejects.toThrow(/not a result/);

    runScopeAnalysisNative.mockResolvedValue({ overall_score: 6, summary: "x" });
    await expect(runScopeAnalysisForClient(input())).rejects.toThrow(/not a result/);
  });

  it("propagates native 401", async () => {
    isNativePlatform.mockReturnValue(true);
    runScopeAnalysisNative.mockRejectedValue(
      new NativeHttpError("Unauthorized", { code: "unauthorized", status: 401 }),
    );
    await expect(runScopeAnalysisForClient(input())).rejects.toMatchObject({ status: 401 });
  });
});

describe("runScopeAnalysisForClient source containment", () => {
  it("dynamically imports the mobile helper and never OpenAI", () => {
    expect(SRC).toMatch(/import\(\s*["']@\/platform\/http\/mobile-scope-analyze["']\s*\)/);
    expect(SRC).toMatch(/import\(\s*["']\.\/serverFns["']\s*\)/);
    expect(SRC).not.toMatch(/import\s+[^;]*from\s+["']\.\/serverFns["']/);
    expect(SRC).not.toMatch(/OPENAI_API_KEY/);
    expect(SRC).not.toMatch(/ai-scope\.adapter\.server/);
    expect(HOOK_SRC).toMatch(/runScopeAnalysisForClient/);
    expect(HOOK_SRC).not.toMatch(/runScopeAnalysisServerFn/);
  });
});
